"""Read-only symbol-search tool: resolve a name/ticker to symbols + market.

Backed by the frozen, IP-throttled Eastmoney public-API client so the agent
never hits a provider un-throttled and never re-implements transport plumbing:

* :mod:`backtest.loaders.eastmoney_client` — Eastmoney's free suggest endpoint
  matches Chinese/English names and tickers across A-shares (.SH/.SZ/.BJ),
  Hong Kong (.HK) and U.S. (.US) listings, each carrying a fully-qualified
  ``secid`` already in ``<market>.<code>`` form.

The tool normalizes every hit into one compact candidate row in the project's
symbol convention, de-duplicates by symbol, and caps the payload. A single
failing source never aborts the others; its error is recorded under
``sources`` and the surviving candidates still return.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from backtest.loaders import eastmoney_client
from src.agent.tools import BaseTool

logger = logging.getLogger(__name__)

# Eastmoney's free, no-auth suggest endpoint (the same one the quote site calls)
# returns multi-market candidates under ``QuotationCodeTable.Data`` with a
# ready-made ``QuoteID`` secid. Requests route through the frozen, throttled
# Eastmoney client; this is just the documented endpoint URL + query shape.
_EASTMONEY_SUGGEST_URL = "https://searchapi.eastmoney.com/api/suggest/get"

# Eastmoney market-number -> our symbol suffix. Anything else is left unmapped
# (those candidates are skipped rather than emitted with a wrong suffix).
_EASTMONEY_SUFFIX_BY_MARKET: Dict[str, str] = {
    "1": "SH",   # Shanghai
    "0": "SZ",   # Shenzhen / Beijing share the 0 prefix on Eastmoney
    "116": "HK",
    "105": "US",  # NASDAQ
    "106": "US",  # NYSE
    "107": "US",  # AMEX
}

# Coarse market label for the candidate row, keyed by symbol suffix.
_MARKET_BY_SUFFIX: Dict[str, str] = {
    "SH": "cn",
    "SZ": "cn",
    "BJ": "cn",
    "HK": "hk",
    "US": "us",
}

# Hard caps so a broad query cannot bloat the envelope.
_MAX_LIMIT = 25
_DEFAULT_LIMIT = 10
# Per-source fan-out ceiling before de-dup/merge keeps each provider bounded.
_PER_SOURCE_CAP = 25


class SymbolSearchTool(BaseTool):
    """Resolve a company name or ticker fragment to candidate symbols."""

    name = "search_symbol"
    description = (
        "Resolve a company name or ticker fragment to candidate trading symbols "
        "with their market, in the project's symbol convention (A-shares "
        "600519.SH, Hong Kong 00700.HK, U.S. AAPL.US). Searches Eastmoney "
        "(China/HK/US names and tickers). Use this to turn an ambiguous name "
        'into a concrete symbol before calling get_market_data. '
        'Example: search_symbol(query="茅台", limit=5).'
    )
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": (
                    "Free-text company name or ticker fragment to resolve, e.g. "
                    "'apple', '贵州茅台', '茅台', 'AAPL', '00700'. Chinese and "
                    "English both accepted."
                ),
            },
            "limit": {
                "type": "integer",
                "description": (
                    f"Maximum number of merged candidates to return "
                    f"(1-{_MAX_LIMIT}). Defaults to {_DEFAULT_LIMIT}."
                ),
                "default": _DEFAULT_LIMIT,
            },
        },
        "required": ["query"],
    }

    def execute(self, **kwargs: Any) -> str:
        """Fan out across providers and return a merged candidate envelope.

        Args:
            **kwargs: ``query`` (str, required free-text name/ticker) and
                ``limit`` (int, optional; clamped to ``1.._MAX_LIMIT``).

        Returns:
            A JSON envelope string. On success:
            ``{"ok": true, "market": "multi", "source": "symbol_search",
            "data": {"query": str, "count": int, "candidates": [...],
            "sources": {<name>: "ok"|<error>}}}``. On failure (only when the
            query itself is invalid):
            ``{"ok": false, "error": str}``.
        """
        query = str(kwargs.get("query") or "").strip()
        if not query:
            return _error("'query' is required and must be a non-empty string")

        limit = _clamp_limit(kwargs.get("limit", _DEFAULT_LIMIT))

        candidates: List[Dict[str, Any]] = []
        sources: Dict[str, str] = {}

        em_hits, sources["eastmoney"] = _search_eastmoney(query)
        candidates.extend(em_hits)

        merged = _merge_candidates(candidates)
        merged = merged[:limit]

        return json.dumps(
            {
                "ok": True,
                "market": "multi",
                "source": "symbol_search",
                "data": {
                    "query": query,
                    "count": len(merged),
                    "candidates": merged,
                    "sources": sources,
                },
            },
            ensure_ascii=False,
        )


def _clamp_limit(value: Any) -> int:
    """Coerce a requested count into the supported ``1.._MAX_LIMIT`` range."""
    try:
        n = int(value)
    except (TypeError, ValueError):
        return _DEFAULT_LIMIT
    return max(1, min(n, _MAX_LIMIT))


def _search_eastmoney(query: str) -> tuple[List[Dict[str, Any]], str]:
    """Query Eastmoney's suggest endpoint and normalize the candidates.

    Args:
        query: Free-text name or ticker fragment.

    Returns:
        ``(candidates, status)`` where ``status`` is ``"ok"`` on success or a
        short error string when the source failed (candidates is then empty).
    """
    try:
        payload = eastmoney_client.get_json(
            _EASTMONEY_SUGGEST_URL,
            params={"input": query, "type": "14", "count": str(_PER_SOURCE_CAP)},
        )
    except Exception as exc:  # noqa: BLE001 - one source failing is non-fatal
        logger.warning("eastmoney suggest failed for %r: %s", query, exc)
        return [], f"eastmoney search failed: {exc}"

    rows = _eastmoney_data_rows(payload)
    candidates = [c for c in (_eastmoney_candidate(r) for r in rows) if c is not None]
    return candidates, "ok"


def _eastmoney_data_rows(payload: Any) -> List[Dict[str, Any]]:
    """Extract the ``QuotationCodeTable.Data`` rows from a suggest payload."""
    if not isinstance(payload, dict):
        return []
    table = payload.get("QuotationCodeTable")
    if not isinstance(table, dict):
        return []
    data = table.get("Data")
    if not isinstance(data, list):
        return []
    return [row for row in data if isinstance(row, dict)]


def _eastmoney_candidate(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Map one Eastmoney suggest row to a normalized candidate, or ``None``.

    Eastmoney rows carry ``QuoteID`` (``<market>.<code>``), ``Code``, ``Name``,
    ``MktNum`` and ``SecurityTypeName``. A row whose market we cannot map to a
    project suffix is dropped rather than emitted with a wrong symbol.

    Args:
        row: One ``QuotationCodeTable.Data`` element.

    Returns:
        A candidate dict, or ``None`` when the row is unusable.
    """
    quote_id = row.get("QuoteID")
    market = ""
    code = str(row.get("Code") or "").strip()
    if isinstance(quote_id, str) and "." in quote_id:
        market, _, qid_code = quote_id.partition(".")
        code = code or qid_code.strip()
    else:
        market = str(row.get("MktNum") or "").strip()
    suffix = _EASTMONEY_SUFFIX_BY_MARKET.get(market)
    if not suffix or not code:
        return None

    symbol = _format_symbol(code, suffix)
    if symbol is None:
        return None
    name = str(row.get("Name") or "").strip() or None
    sec_type = str(row.get("SecurityTypeName") or "").strip() or None
    return {
        "symbol": symbol,
        "name": name,
        "market": _MARKET_BY_SUFFIX.get(suffix, suffix.lower()),
        "type": sec_type,
        "source": "eastmoney",
    }


def _format_symbol(code: str, suffix: str) -> Optional[str]:
    """Render a bare code + suffix into the project symbol convention.

    HK codes are zero-padded to five digits to match the loader/secid scheme.

    Args:
        code: Bare instrument code (e.g. ``"600519"``, ``"700"``, ``"AAPL"``).
        suffix: One of ``SH``/``SZ``/``BJ``/``HK``/``US``.

    Returns:
        The formatted symbol (``"600519.SH"``, ``"00700.HK"``, ``"AAPL.US"``),
        or ``None`` when the code is empty.
    """
    code = code.strip().upper()
    if not code:
        return None
    if suffix == "HK":
        return f"{code.zfill(5)}.HK"
    return f"{code}.{suffix}"



def _merge_candidates(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """De-duplicate candidates by symbol, preserving first-seen order.

    When two sources resolve the same symbol the first hit wins and the second
    source name is appended to a ``also_from`` list so provenance is not lost.

    Args:
        candidates: Raw candidates from every source, in fan-out order.

    Returns:
        A de-duplicated candidate list (immutable inputs are copied, not mutated).
    """
    by_symbol: Dict[str, Dict[str, Any]] = {}
    order: List[str] = []
    for candidate in candidates:
        symbol = candidate.get("symbol")
        if not symbol:
            continue
        if symbol not in by_symbol:
            by_symbol[symbol] = dict(candidate)
            order.append(symbol)
            continue
        existing = by_symbol[symbol]
        other = candidate.get("source")
        if other and other != existing.get("source"):
            also = list(existing.get("also_from") or [])
            if other not in also:
                also.append(other)
            merged = dict(existing)
            merged["also_from"] = also
            # Backfill a missing name from the duplicate hit.
            if not merged.get("name") and candidate.get("name"):
                merged["name"] = candidate["name"]
            by_symbol[symbol] = merged
    return [by_symbol[sym] for sym in order]



def _error(message: str) -> str:
    """Render a failure envelope as a JSON string."""
    return json.dumps({"ok": False, "error": message}, ensure_ascii=False)
