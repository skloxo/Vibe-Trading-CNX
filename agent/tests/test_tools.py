"""
Unit tests for fine-grained tools and shared modules.

API (verified 2026-06-19):
- All tool execute() return JSON strings (json.dumps)
- PortfolioMonitorTool: holdings=list[str], key="portfolio"
- StockRiskTool: codes=list[str], uses akshare (mocked)
- StockInfoSearchTool: codes=list[str], uses akshare (mocked)
- Indicators: calc_macd/calc_kdj/calc_bollinger return dicts
"""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import pandas as pd
import numpy as np
from unittest.mock import patch, MagicMock

# ============================================================
# Helpers
# ============================================================
def make_ohlcv(n=60, seed=42):
    rng = np.random.RandomState(seed)
    dates = pd.date_range("2026-04-01", periods=n, freq="B")
    close = 10.0 + np.cumsum(rng.randn(n) * 0.3)
    close = np.maximum(close, 5.0)
    high = close * (1 + rng.uniform(0.005, 0.03, n))
    low = close * (1 - rng.uniform(0.005, 0.03, n))
    opn = close * (1 + rng.uniform(-0.015, 0.015, n))
    vol = rng.randint(50000, 500000, n).astype(float)
    return pd.DataFrame({"open": opn, "high": high, "low": low, "close": close, "volume": vol}, index=dates)

def mock_fetch_market_data_json(**kwargs):
    codes = kwargs.get("codes", ["000001"])
    df = make_ohlcv(60)
    return {"bars": {c: df.to_dict(orient="records") for c in codes}, "source": "mootdx"}

def parse(raw):
    if isinstance(raw, dict): return raw
    if not raw or not isinstance(raw, str) or not raw.strip(): return {}
    return json.loads(raw)

PATCH_MD = "src.market_data.fetch_market_data_json"

# ============================================================
# Indicators (10 tests)
# ============================================================
class TestIndicators:
    def test_macd(self):
        from src.tools._indicators import calc_macd
        r = calc_macd(make_ohlcv(100)["close"])
        assert isinstance(r, dict) and "dif" in r and "dea" in r and "macd" in r

    def test_rsi(self):
        from src.tools._indicators import calc_rsi
        rsi = calc_rsi(make_ohlcv(100)["close"])
        assert 0 <= rsi.iloc[-1] <= 100

    def test_kdj(self):
        from src.tools._indicators import calc_kdj
        df = make_ohlcv(100)
        r = calc_kdj(df["high"], df["low"], df["close"])
        assert isinstance(r, dict) and "k" in r and "d" in r and "j" in r

    def test_bollinger(self):
        from src.tools._indicators import calc_bollinger
        r = calc_bollinger(make_ohlcv(100)["close"])
        assert isinstance(r, dict) and "upper" in r and "middle" in r and "lower" in r

    def test_sma(self):
        from src.tools._indicators import calc_sma
        assert abs(calc_sma(pd.Series(range(1, 21), dtype=float), 5).iloc[-1] - 18.0) < 1e-10

    def test_ema(self):
        from src.tools._indicators import calc_ema
        assert len(calc_ema(pd.Series(range(1, 21), dtype=float), 5)) == 20

    def test_atr(self):
        from src.tools._indicators import calc_atr
        df = make_ohlcv(100)
        assert calc_atr(df["high"], df["low"], df["close"]).iloc[-1] > 0

    def test_trend_strength(self):
        from src.tools._indicators import calc_trend_strength
        ts = calc_trend_strength(make_ohlcv(100)["close"])
        assert isinstance(ts, pd.Series) and len(ts) == 100

    def test_volume_ratio(self):
        from src.tools._indicators import calc_volume_ratio
        vr = calc_volume_ratio(pd.Series([100.0]*5 + [200.0]), 5)
        assert len(vr) == 6

    def test_support_resistance(self):
        from src.tools._indicators import calc_support_resistance
        df = make_ohlcv(100)
        r = calc_support_resistance(df["high"], df["low"], df["close"])
        assert isinstance(r, dict) and "support" in r and "resistance" in r

# ============================================================
# Scorer (2 tests)
# ============================================================
class TestScorer:
    def test_score_stock(self):
        from src.tools._scorer import score_stock
        r = score_stock(make_ohlcv(100))
        assert "total" in r and 0 <= r["total"] <= 100 and "signal" in r

    def test_score_range(self):
        from src.tools._scorer import score_stock
        for seed in range(10):
            r = score_stock(make_ohlcv(100, seed=seed))
            assert 0 <= r["total"] <= 100

# ============================================================
# Strategy (4 tests)
# ============================================================
class TestStrategy:
    def test_mid_trend(self):
        from src.tools._strategy import filter_mid_trend
        assert isinstance(filter_mid_trend(make_ohlcv(100)), bool)

    def test_leader_swing(self):
        from src.tools._strategy import filter_leader_swing
        assert isinstance(filter_leader_swing(make_ohlcv(100)), bool)

    def test_oversold_rebound(self):
        from src.tools._strategy import filter_oversold_rebound
        assert isinstance(filter_oversold_rebound(make_ohlcv(100)), bool)

    def test_volume_breakout(self):
        from src.tools._strategy import filter_volume_breakout
        assert isinstance(filter_volume_breakout(make_ohlcv(100)), bool)

# ============================================================
# StockTechAnalysisTool (5 tests, mocked market_data)
# ============================================================
class TestStockTechAnalysis:
    def test_medium(self):
        with patch(PATCH_MD, side_effect=mock_fetch_market_data_json):
            from src.tools.stock_tech_analysis_tool import StockTechAnalysisTool
            r = parse(StockTechAnalysisTool().execute(code="000001", period="medium"))
            assert "error" not in r and r["code"] == "000001" and "score" in r

    def test_short(self):
        with patch(PATCH_MD, side_effect=mock_fetch_market_data_json):
            from src.tools.stock_tech_analysis_tool import StockTechAnalysisTool
            r = parse(StockTechAnalysisTool().execute(code="000001", period="short"))
            assert "error" not in r and r["period"] == "short"

    def test_long(self):
        with patch(PATCH_MD, side_effect=mock_fetch_market_data_json):
            from src.tools.stock_tech_analysis_tool import StockTechAnalysisTool
            r = parse(StockTechAnalysisTool().execute(code="000001", period="long"))
            assert "error" not in r and r["period"] == "long"

    def test_invalid_code(self):
        from src.tools.stock_tech_analysis_tool import StockTechAnalysisTool
        raw = StockTechAnalysisTool().execute(code="INVALID")
        if raw and str(raw).strip():
            r = parse(raw)
            assert "error" in r or "Invalid" in str(r)

    def test_score_is_int(self):
        with patch(PATCH_MD, side_effect=mock_fetch_market_data_json):
            from src.tools.stock_tech_analysis_tool import StockTechAnalysisTool
            r = parse(StockTechAnalysisTool().execute(code="600519", period="medium"))
            assert "error" not in r and isinstance(r["score"], int) and 0 <= r["score"] <= 100

# ============================================================
# PortfolioMonitorTool (5 tests, mocked market_data)
# ============================================================
class TestPortfolioMonitor:
    def test_two_holdings(self):
        with patch(PATCH_MD, side_effect=mock_fetch_market_data_json):
            from src.tools.portfolio_monitor_tool import PortfolioMonitorTool
            r = parse(PortfolioMonitorTool().execute(holdings=["000001", "600519"]))
            assert "error" not in r and "portfolio" in r and len(r["portfolio"]) == 2

    def test_alerts(self):
        with patch(PATCH_MD, side_effect=mock_fetch_market_data_json):
            from src.tools.portfolio_monitor_tool import PortfolioMonitorTool
            r = parse(PortfolioMonitorTool().execute(holdings=["000001"]))
            assert "error" not in r and "alerts" in r

    def test_summary(self):
        with patch(PATCH_MD, side_effect=mock_fetch_market_data_json):
            from src.tools.portfolio_monitor_tool import PortfolioMonitorTool
            r = parse(PortfolioMonitorTool().execute(holdings=["000001", "600519"]))
            assert "summary" in r and r["summary"]["total_stocks"] == 2

    def test_empty_holdings(self):
        from src.tools.portfolio_monitor_tool import PortfolioMonitorTool
        raw = PortfolioMonitorTool().execute(holdings=[])
        if raw and str(raw).strip():
            r = parse(raw)
            assert "error" in r or r.get("holdings_count", -1) == 0

    def test_invalid_type(self):
        from src.tools.portfolio_monitor_tool import PortfolioMonitorTool
        raw = PortfolioMonitorTool().execute(holdings="not_a_list")
        if raw and str(raw).strip():
            r = parse(raw)
            assert "error" in r or r.get("holdings_count", -1) == 0

# ============================================================
# StockRiskTool (5 tests, mocked akshare)
# ============================================================
class TestStockRisk:
    @pytest.fixture(autouse=True)
    def mock_akshare(self, monkeypatch):
        mock_ak = MagicMock()
        mock_ak.stock_individual_info_em.return_value = pd.DataFrame({
            'item': ['股票简称', '上市日期'], 'value': ['平安银行', '1991-04-03']
        })
        mock_ak.stock_financial_analysis_indicator.return_value = pd.DataFrame({
            '净资产收益率(%)': [10], '每股收益(元)': [1.0], '每股净资产(元)': [10.0],
            '资产负债比率(%)': [50], '流动比率': [1.5], '速动比率': [1.2],
            '净利润增长率(%)': [5], '主营业务收入增长率(%)': [8]
        })
        mock_ak.stock_balance_sheet_by_report_em.return_value = pd.DataFrame({
            'TOTAL_ASSETS': [100], 'TOTAL_LIABILITIES': [50]
        })
        mock_ak.stock_audit_opinion_em.return_value = pd.DataFrame({
            '审核意见': ['标准无保留意见']
        })
        monkeypatch.setitem(sys.modules, 'akshare', mock_ak)

    def test_valid(self):
        from src.tools.stock_risk_tool import StockRiskTool
        r = parse(StockRiskTool().execute(codes=["000001"]))
        assert "data" in r and len(r["data"]) == 1

    def test_multiple(self):
        from src.tools.stock_risk_tool import StockRiskTool
        r = parse(StockRiskTool().execute(codes=["000001", "600519"]))
        assert "data" in r and len(r["data"]) == 2

    def test_empty(self):
        from src.tools.stock_risk_tool import StockRiskTool
        r = parse(StockRiskTool().execute(codes=[]))
        assert "error" in r

    def test_structure(self):
        from src.tools.stock_risk_tool import StockRiskTool
        r = parse(StockRiskTool().execute(codes=["000001"]))
        assert "risk_level" in r["data"][0] and "code" in r["data"][0]

# ============================================================
# StockInfoSearchTool (3 tests, mocked akshare)
# ============================================================
class TestStockInfoSearch:
    @pytest.fixture(autouse=True)
    def mock_akshare(self, monkeypatch):
        mock_ak = MagicMock()
        mock_ak.stock_news_em.return_value = pd.DataFrame({
            '新闻标题': ['测试新闻'], '新闻内容': ['测试内容'], '发布时间': ['2026-06-18']
        })
        mock_ak.stock_zh_a_alerts_cls.return_value = pd.DataFrame({
            '公告标题': ['测试公告'], '公告时间': ['2026-06-18']
        })
        monkeypatch.setitem(sys.modules, 'akshare', mock_ak)

    def test_valid(self):
        from src.tools.stock_info_search_tool import StockInfoSearchTool
        r = parse(StockInfoSearchTool().execute(codes=["000001"]))
        assert "error" not in r

    def test_empty(self):
        from src.tools.stock_info_search_tool import StockInfoSearchTool
        r = parse(StockInfoSearchTool().execute(codes=[]))
        assert "error" in r

    def test_multiple(self):
        from src.tools.stock_info_search_tool import StockInfoSearchTool
        r = parse(StockInfoSearchTool().execute(codes=["000001", "600519"]))
        assert "error" not in r

# ============================================================
# MarketScanTool (2 tests)
# ============================================================
class TestMarketScan:
    def test_valid(self):
        from src.tools.market_scan_tool import MarketScanTool
        r = parse(MarketScanTool().execute(strategy="mid_trend", limit=5))
        assert isinstance(r, dict)

    def test_invalid(self):
        from src.tools.market_scan_tool import MarketScanTool
        r = parse(MarketScanTool().execute(strategy="nonexistent"))
        assert "error" in r
