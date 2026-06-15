"""Shadow Account — strategy extraction from profitable roundtrips.

Pipeline:
    trades_df → FIFO pair → filter (pnl > 0) → feature engineer
    → KMeans cluster (k auto 2-5) → per-cluster decision tree (max_depth=3)
    → path extraction → structured entry_condition dict
    → LLM-light natural-language translation (template fallback if no LLM)

Design constraints:
    * No external price-data calls in v1. All features are derivable from
      the journal itself (holding_days, pnl_pct, entry hour/weekday, market).
      Price-dependent features (prior_N_return, rsi) are stubbed with None
      and dropped from the feature matrix if unavailable.
    * Must survive tiny samples: <5 profitable roundtrips → explicit error.
      <2 clusters → degrade to a single-cluster heuristic rule.
    * Rules are immutable ShadowRule objects — codegen's only input.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from src.shadow_account.models import ShadowProfile, ShadowRule
from src.shadow_account.storage import hash_journal, new_shadow_id, now_iso
from src.tools.trade_journal_parsers import parse_file, records_to_dataframe
from src.tools.trade_journal_tool import pair_trades_fifo

logger = logging.getLogger(__name__)

MIN_PROFITABLE_ROUNDTRIPS = 5
DEFAULT_MAX_RULES = 5
DEFAULT_MIN_SUPPORT = 3
_NUMERIC_FEATURES = ("holding_days", "pnl_pct", "entry_hour", "entry_weekday")
_CATEGORICAL_FEATURES = ("market",)


# ---------------- Public API ----------------

def extract_shadow_profile(
    journal_path: str | Path,
    *,
    min_support: int = DEFAULT_MIN_SUPPORT,
    max_rules: int = DEFAULT_MAX_RULES,
    llm_translator: Any | None = None,
) -> ShadowProfile:
    """Extract a ShadowProfile from a broker journal file.

    Args:
        journal_path: CSV/Excel exported from a supported broker.
        min_support: Minimum profitable roundtrips backing any single rule.
        max_rules: Cap on the number of rules returned.
        llm_translator: Optional callable (dict) -> str for translating
            structured entry_condition into natural-language text. If None,
            a deterministic f-string fallback is used.

    Returns:
        ShadowProfile (not yet persisted — caller decides whether to save).

    Raises:
        ValueError: Fewer than MIN_PROFITABLE_ROUNDTRIPS profitable roundtrips.
    """
    path = Path(journal_path)
    fmt, records = parse_file(path)
    if not records:
        raise ValueError(f"No trade records parsed from {path} (format={fmt})")
    trades_df = records_to_dataframe(records)

    roundtrips = pair_trades_fifo(trades_df)
    total = len(roundtrips)
    if total == 0:
        raise ValueError("No complete buy→sell roundtrips found in journal.")

    profitable = [rt for rt in roundtrips if rt["pnl"] > 0]
    if len(profitable) < MIN_PROFITABLE_ROUNDTRIPS:
        raise ValueError(
            f"Insufficient profitable roundtrips: {len(profitable)} "
            f"(need ≥{MIN_PROFITABLE_ROUNDTRIPS}).",
        )

    features_df = _compute_features(profitable, trades_df)
    rules = _extract_rules(
        features_df,
        min_support=min_support,
        max_rules=max_rules,
        llm_translator=llm_translator,
    )

    source_market = _dominant(trades_df["market"])
    preferred_markets = tuple(trades_df["market"].value_counts().index.tolist())
    hold = features_df["holding_days"].dropna()
    typical_holding = (
        round(float(hold.median()), 2) if len(hold) else 0.0,
        round(float(hold.quantile(0.75)), 2) if len(hold) else 0.0,
    )
    date_range = (
        str(trades_df["datetime"].min()),
        str(trades_df["datetime"].max()),
    )
    profile_text = _render_profile_text(
        total_profitable=len(profitable),
        total_all=total,
        typical_holding=typical_holding,
        source_market=source_market,
        preferred_markets=preferred_markets,
    )

    return ShadowProfile(
        shadow_id=new_shadow_id(),
        created_at=now_iso(),
        journal_hash=hash_journal(path),
        source_market=source_market,
        profitable_roundtrips=len(profitable),
        total_roundtrips=total,
        date_range=date_range,
        profile_text=profile_text,
        rules=tuple(rules),
        preferred_markets=preferred_markets,
        typical_holding_days=typical_holding,
    )


# ---------------- Feature engineering ----------------

def _compute_features(
    roundtrips: list[dict[str, Any]],
    trades_df: pd.DataFrame,
) -> pd.DataFrame:
    """Compute a features row per profitable roundtrip.

    Columns: symbol, market, holding_days, pnl, pnl_pct, entry_hour,
    entry_weekday, buy_dt, sell_dt.
    """
    market_by_symbol = (
        trades_df.drop_duplicates("symbol").set_index("symbol")["market"].to_dict()
    )
    rows: list[dict[str, Any]] = []
    for rt in roundtrips:
        buy_dt = pd.Timestamp(rt["buy_dt"])
        sell_dt = pd.Timestamp(rt["sell_dt"])
        rows.append({
            "symbol": rt["symbol"],
            "market": market_by_symbol.get(rt["symbol"], "other"),
            "holding_days": float(rt["hold_days"]),
            "pnl": float(rt["pnl"]),
            "pnl_pct": float(rt["pnl_pct"]),
            "entry_hour": int(buy_dt.hour),
            "entry_weekday": int(buy_dt.weekday()),
            "buy_dt": buy_dt,
            "sell_dt": sell_dt,
        })
    return pd.DataFrame(rows)


# ---------------- Cluster + decision-tree rule extraction ----------------

def _extract_rules(
    features_df: pd.DataFrame,
    *,
    min_support: int,
    max_rules: int,
    llm_translator: Any | None,
) -> list[ShadowRule]:
    """Cluster profitable roundtrips, derive one rule per dense cluster."""
    if len(features_df) < min_support:
        return [_heuristic_single_rule(features_df, min_support, llm_translator)]

    cluster_labels = _auto_cluster(features_df, max_k=min(max_rules, 5))
    rules: list[ShadowRule] = []
    total_profitable = len(features_df)
    used_markets: set[str] = set()

    for cluster_id in sorted(set(cluster_labels)):
        cluster_mask = cluster_labels == cluster_id
        cluster_df = features_df[cluster_mask]
        if len(cluster_df) < min_support:
            continue
        rule = _cluster_to_rule(
            cluster_df=cluster_df,
            rule_index=len(rules) + 1,
            total_profitable=total_profitable,
            llm_translator=llm_translator,
        )
        # Deduplicate near-identical rules (same market + same holding band)
        key = (rule.entry_condition.get("market"), rule.holding_days_range)
        if key in used_markets:
            continue
        used_markets.add(key)
        rules.append(rule)
        if len(rules) >= max_rules:
            break

    if not rules:
        rules = [_heuristic_single_rule(features_df, min_support, llm_translator)]
    return rules


def _auto_cluster(features_df: pd.DataFrame, *, max_k: int) -> np.ndarray:
    """Pick a cluster count via simple silhouette heuristic (fallback k=2).

    Uses only numeric features; scales by z-score to avoid holding_days
    dominating pnl_pct.
    """
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    numeric = features_df[list(_NUMERIC_FEATURES)].astype(float).to_numpy()
    if len(numeric) <= 2 or max_k < 2:
        return np.zeros(len(numeric), dtype=int)
    scaled = StandardScaler().fit_transform(numeric)

    best_k, best_score = 2, -1.0
    try:
        from sklearn.metrics import silhouette_score
        for k in range(2, min(max_k, len(numeric) - 1) + 1):
            labels = KMeans(n_clusters=k, n_init=5, random_state=42).fit_predict(scaled)
            if len(set(labels)) < 2:
                continue
            score = silhouette_score(scaled, labels)
            if score > best_score:
                best_k, best_score = k, score
    except Exception as exc:  # pragma: no cover — sklearn edge cases
        logger.debug("silhouette selection failed, fallback k=2: %s", exc)

    return KMeans(n_clusters=best_k, n_init=5, random_state=42).fit_predict(scaled)


def _cluster_to_rule(
    *,
    cluster_df: pd.DataFrame,
    rule_index: int,
    total_profitable: int,
    llm_translator: Any | None,
) -> ShadowRule:
    """Summarize a cluster as one ShadowRule.

    Entry condition uses p10–p90 numeric bounds + dominant market. This is
    lighter than a decision tree and stays interpretable with tiny samples;
    we can swap to DecisionTreeClassifier in v2 when features widen.
    """
    market = _dominant(cluster_df["market"])
    hold_days = cluster_df["holding_days"]
    hold_lo = max(1, int(round(float(hold_days.quantile(0.10)))))
    hold_hi = max(hold_lo, int(round(float(hold_days.quantile(0.90)))))
    hours = cluster_df["entry_hour"]
    hour_lo = int(round(float(hours.quantile(0.10))))
    hour_hi = int(round(float(hours.quantile(0.90))))

    entry_condition: dict[str, Any] = {
        "market": market,
        "entry_hour": {"min": hour_lo, "max": hour_hi},
    }
    exit_condition: dict[str, Any] = {
        "holding_days": {"min": hold_lo, "max": hold_hi},
    }

    samples = tuple(
        f"{row.symbol}@{pd.Timestamp(row.buy_dt).date().isoformat()}"
        for row in cluster_df.head(3).itertuples(index=False)
    )
    support = int(len(cluster_df))
    coverage = round(support / max(total_profitable, 1), 3)

    human = _translate_rule(
        entry_condition=entry_condition,
        exit_condition=exit_condition,
        holding_range=(hold_lo, hold_hi),
        translator=llm_translator,
    )

    return ShadowRule(
        rule_id=f"R{rule_index}",
        human_text=human,
        entry_condition=entry_condition,
        exit_condition=exit_condition,
        holding_days_range=(hold_lo, hold_hi),
        support_count=support,
        coverage_rate=coverage,
        sample_trades=samples,
    )


def _heuristic_single_rule(
    features_df: pd.DataFrame,
    min_support: int,
    llm_translator: Any | None,
) -> ShadowRule:
    """Degenerate fallback when clustering/tree yield nothing usable."""
    return _cluster_to_rule(
        cluster_df=features_df,
        rule_index=1,
        total_profitable=max(len(features_df), min_support),
        llm_translator=llm_translator,
    )


# ---------------- Natural-language translation ----------------

_MARKET_LABELS = {
    "china_a": "China A-share",
    "other": "Other",
}

RULE_TEXT_MAX = 80


def _translate_rule(
    *,
    entry_condition: dict[str, Any],
    exit_condition: dict[str, Any],
    holding_range: tuple[int, int],
    translator: Any | None,
) -> str:
    """Turn a structured rule dict into a concise English sentence (<=80 chars)."""
    if translator is not None:
        try:
            text = translator({
                "entry_condition": entry_condition,
                "exit_condition": exit_condition,
                "holding_range": holding_range,
            })
            if isinstance(text, str) and text.strip():
                return text.strip()[:RULE_TEXT_MAX]
        except Exception as exc:  # pragma: no cover — LLM failure, fallback
            logger.warning("LLM rule translator failed, falling back: %s", exc)

    market_label = _MARKET_LABELS.get(entry_condition.get("market", "other"), "Other")
    hour_range = entry_condition.get("entry_hour", {})
    hour_text = ""
    if hour_range:
        lo, hi = hour_range.get("min"), hour_range.get("max")
        hour_text = f" at {lo}:00" if lo == hi else f" between {lo}:00-{hi}:00"
    hold_lo, hold_hi = holding_range
    hold_text = f"hold {hold_lo}-{hold_hi}d" if hold_lo != hold_hi else f"hold {hold_lo}d"
    entry_text = f"Enter {market_label}{hour_text}"
    return f"{entry_text}, {hold_text}"[:RULE_TEXT_MAX]


# ---------------- Utilities ----------------

def _dominant(series: pd.Series) -> str:
    """Most frequent value in a series, or the first if tied."""
    if series.empty:
        return "other"
    return str(series.value_counts().idxmax())


def _render_profile_text(
    *,
    total_profitable: int,
    total_all: int,
    typical_holding: tuple[float, float],
    source_market: str,
    preferred_markets: tuple[str, ...],
) -> str:
    """Build the Section 1 one-paragraph portrait (English)."""
    median, p75 = typical_holding
    markets_label = ", ".join(_MARKET_LABELS.get(m, m) for m in preferred_markets[:3])
    source_label = _MARKET_LABELS.get(source_market, source_market)
    return (
        f"{total_profitable} of your {total_all} closed roundtrips were profitable. "
        f"Primary market: {source_label} (also active in {markets_label}). "
        f"Median holding period {median:.1f}d; most positions closed within {p75:.1f}d."
    )
