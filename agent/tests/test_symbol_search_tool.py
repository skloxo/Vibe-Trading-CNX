"""Tests for the search_symbol tool.

All HTTP is mocked at the client function the tool imports
(``eastmoney_client.get_json``), so no test ever reaches a live endpoint.
"""

from __future__ import annotations

import json
from unittest.mock import patch

from src.tools import symbol_search_tool as ss


def _eastmoney_payload() -> dict:
    """A suggest payload spanning A-share, HK, and US markets."""
    return {
        "QuotationCodeTable": {
            "Data": [
                {
                    "QuoteID": "1.600519",
                    "Code": "600519",
                    "Name": "贵州茅台",
                    "MktNum": "1",
                    "SecurityTypeName": "沪A",
                },
                {
                    "QuoteID": "116.00700",
                    "Code": "00700",
                    "Name": "腾讯控股",
                    "MktNum": "116",
                    "SecurityTypeName": "港股",
                },
                {
                    "QuoteID": "105.AAPL",
                    "Code": "AAPL",
                    "Name": "苹果",
                    "MktNum": "105",
                    "SecurityTypeName": "美股",
                },
                {
                    # Unmappable market (e.g. a fund/board) -> dropped, not fatal.
                    "QuoteID": "90.BK0001",
                    "Code": "BK0001",
                    "Name": "板块",
                    "MktNum": "90",
                    "SecurityTypeName": "板块",
                },
            ]
        }
    }


class TestSymbolSearchSuccess:
    """Happy-path fan-out, normalization, and merge."""

    def test_merges_and_normalizes(self):
        with patch.object(
            ss.eastmoney_client, "get_json", return_value=_eastmoney_payload()
        ):
            out = ss.SymbolSearchTool().execute(query="茅台", limit=10)

        payload = json.loads(out)
        assert payload["ok"] is True
        assert payload["market"] == "multi"
        assert payload["source"] == "symbol_search"

        data = payload["data"]
        assert data["query"] == "茅台"
        assert data["sources"]["eastmoney"] == "ok"

        by_symbol = {c["symbol"]: c for c in data["candidates"]}

        # A-share secid -> 600519.SH, market cn.
        assert by_symbol["600519.SH"]["market"] == "cn"
        assert by_symbol["600519.SH"]["name"] == "贵州茅台"

        # HK code zero-padded to 5 digits.
        assert "00700.HK" in by_symbol
        assert by_symbol["00700.HK"]["market"] == "hk"

        # US equity from Eastmoney.
        assert "AAPL.US" in by_symbol
        assert by_symbol["AAPL.US"]["market"] == "us"

        # Unmappable Eastmoney market dropped.
        assert "BK0001" not in by_symbol
        assert data["count"] == len(data["candidates"])

    def test_limit_clamped_and_applied(self):
        with patch.object(
            ss.eastmoney_client, "get_json", return_value=_eastmoney_payload()
        ):
            out = ss.SymbolSearchTool().execute(query="x", limit=2)
        payload = json.loads(out)
        assert payload["data"]["count"] == 2

    def test_empty_eastmoney_returns_empty(self):
        em = {"QuotationCodeTable": {"Data": []}}
        with patch.object(
            ss.eastmoney_client, "get_json", return_value=em
        ):
            out = ss.SymbolSearchTool().execute(query="不存在的公司")
        payload = json.loads(out)
        assert payload["ok"] is True
        assert payload["data"]["count"] == 0


class TestSymbolSearchErrors:
    """Error envelopes and per-source resilience."""

    def test_missing_query_returns_error_envelope(self):
        out = ss.SymbolSearchTool().execute(query="   ")
        payload = json.loads(out)
        assert payload["ok"] is False
        assert "required" in payload["error"]

    def test_eastmoney_failure_returns_error(self):
        with patch.object(
            ss.eastmoney_client,
            "get_json",
            side_effect=RuntimeError("HTTP 429 banned"),
        ):
            out = ss.SymbolSearchTool().execute(query="apple")

        payload = json.loads(out)
        assert payload["ok"] is True
        sources = payload["data"]["sources"]
        assert "eastmoney search failed" in sources["eastmoney"]
        assert "429" in sources["eastmoney"]
        assert payload["data"]["count"] == 0
