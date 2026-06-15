"""L6 — quantity->quote pricing (SPEC.md S4, S7.5).

Covers quantity-only quote derivation: broker ``get_quotes`` preferred,
data-loader fallback, fail-closed DENY when no quote is obtainable.
Never hits the network (the loader path is stubbed).

Robinhood catalog and extractor tests removed during foreign-market cleanup
(connector modules deleted).
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest

import src.live.enforcement as enforcement
import src.live.order_guard as order_guard
import src.live.paths as paths
from src.live.mandate.model import (
    MANDATE_SCHEMA_VERSION,
    AssetClass,
    InstrumentType,
)
from src.tools.mcp import MCPRemoteToolSpec


# --------------------------------------------------------------------------- #
# L6 — quantity-only quote derivation through the gate                         #
# --------------------------------------------------------------------------- #


@pytest.fixture
def live_runtime(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(paths, "get_runtime_root", lambda: tmp_path)
    return tmp_path


def _spec() -> MCPRemoteToolSpec:
    return MCPRemoteToolSpec(
        server_name="robinhood",
        remote_name="place_order",
        local_name="mcp_robinhood_place_order",
        description="Place an order.",
        parameters={"type": "object", "properties": {}, "additionalProperties": True},
    )


def _write_mandate(live_runtime: Path, *, max_order_notional_usd: float = 750.0) -> None:
    broker = live_runtime / "live" / "robinhood"
    broker.mkdir(parents=True, exist_ok=True)
    created = datetime.now(timezone.utc)
    payload = {
        "schema_version": MANDATE_SCHEMA_VERSION,
        "hard_caps": {
            "account_funding_usd": 100000.0,
            "max_order_notional_usd": max_order_notional_usd,
            "max_total_exposure_usd": 1e9,
            "max_leverage": 100.0,
            "allowed_instruments": ["equity", "etf"],
            "max_trades_per_day": 50,
        },
        "universe": {
            "asset_classes": ["us_equity", "us_etf"],
            "min_market_cap_usd": None,
            "min_avg_daily_volume_usd": None,
            "exclude_symbols": [],
        },
        "consent": {
            "created_at": created.isoformat(),
            "consent_token_sha256": "deadbeef",
            "broker": "robinhood",
            "account_ref": "acct_ref",
            "expires_at": (created + timedelta(days=30)).isoformat(),
        },
    }
    (broker / "mandate.json").write_text(json.dumps(payload), encoding="utf-8")


class _BrokerQuoteAdapter:
    """Adapter whose ``get_quotes`` returns a price; loader path is never needed."""

    def __init__(self, *, price: float) -> None:
        self.server_name = "robinhood"
        self._price = price
        self.order_calls: list[dict[str, Any]] = []
        self.quote_calls = 0

    def call_tool(self, remote_name: str, arguments: dict, *, local_name: str | None = None) -> dict:
        if remote_name == "get_positions":
            return {"positions": [], "status": "ok"}
        if remote_name == "get_account":
            return {"equity": 100000.0, "status": "ok"}
        if remote_name == "get_quotes":
            self.quote_calls += 1
            return {"status": "ok", "results": [{"symbol": arguments.get("symbol"), "last_price": self._price}]}
        self.order_calls.append({"remote": remote_name, "arguments": arguments})
        return {"status": "ok", "order_id": "rh_q", "state": "accepted"}


class _NoBrokerQuoteAdapter:
    """Adapter whose ``get_quotes`` errors -- forces the data-loader fallback."""

    def __init__(self) -> None:
        self.server_name = "robinhood"
        self.order_calls: list[dict[str, Any]] = []

    def call_tool(self, remote_name: str, arguments: dict, *, local_name: str | None = None) -> dict:
        if remote_name == "get_positions":
            return {"positions": [], "status": "ok"}
        if remote_name == "get_account":
            return {"equity": 100000.0, "status": "ok"}
        if remote_name == "get_quotes":
            return {"status": "error", "error": "quotes unavailable"}
        self.order_calls.append({"remote": remote_name, "arguments": arguments})
        return {"status": "ok", "order_id": "rh_q", "state": "accepted"}


def _guard(adapter):
    return order_guard.LiveOrderGuardTool(adapter, _spec(), broker="robinhood", session_id="s1")


def test_quantity_only_uses_broker_quote_and_enforces_notional(live_runtime: Path) -> None:
    _write_mandate(live_runtime, max_order_notional_usd=750.0)
    adapter = _BrokerQuoteAdapter(price=100.0)  # 10 * 100 = 1000 > 750
    guard = _guard(adapter)
    out = json.loads(
        guard.execute(symbol="AAPL", side="buy", instrument_type="equity", quantity=10.0)
    )
    assert adapter.quote_calls == 1
    assert out["status"] == "blocked"
    assert out["breach"]["limit"] == "max_order_notional_usd"
    assert out["breach"]["attempted_value"] == 1000.0
    assert adapter.order_calls == []


def test_quantity_only_in_mandate_forwards(live_runtime: Path) -> None:
    _write_mandate(live_runtime, max_order_notional_usd=2000.0)
    adapter = _BrokerQuoteAdapter(price=100.0)  # 10 * 100 = 1000 <= 2000
    guard = _guard(adapter)
    out = json.loads(
        guard.execute(symbol="AAPL", side="buy", instrument_type="equity", quantity=10.0)
    )
    assert out.get("status") == "ok"
    assert len(adapter.order_calls) == 1


def test_quantity_falls_back_to_data_loader(live_runtime: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """When the broker quote tool errors, the gate derives price from the data
    loaders (stubbed -- no network)."""
    _write_mandate(live_runtime, max_order_notional_usd=750.0)
    monkeypatch.setattr(order_guard, "last_price_usd", lambda sym, ac: 100.0)
    adapter = _NoBrokerQuoteAdapter()
    guard = _guard(adapter)
    out = json.loads(
        guard.execute(symbol="AAPL", side="buy", instrument_type="equity", quantity=10.0)
    )
    assert out["status"] == "blocked"
    assert out["breach"]["limit"] == "max_order_notional_usd"
    assert adapter.order_calls == []


def test_quantity_no_quote_anywhere_denies_fail_closed(live_runtime: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Quantity order + broker quote errors + loader returns nothing -> DENY,
    never waved through."""
    _write_mandate(live_runtime)
    monkeypatch.setattr(order_guard, "last_price_usd", lambda sym, ac: None)
    adapter = _NoBrokerQuoteAdapter()
    guard = _guard(adapter)
    out = json.loads(
        guard.execute(symbol="AAPL", side="buy", instrument_type="equity", quantity=10.0)
    )
    assert out["status"] == "blocked"
    assert out["decision"] == "deny"
    assert "priced" in out["reason"].lower()
    assert adapter.order_calls == []


def test_last_price_usd_fail_closed_on_loader_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    """The loader-backed price helper denies (returns None) when no loader is
    available -- never a network call in tests."""
    def _raise(_ac):
        raise enforcement.UniverseDataUnavailable("no loader")

    monkeypatch.setattr(enforcement, "_resolve_loader", _raise)
    assert enforcement.last_price_usd("AAPL", AssetClass.US_EQUITY) is None
