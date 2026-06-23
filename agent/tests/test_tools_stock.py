"""
Unit tests for stock tools - 14场景模拟

Tool参数格式:
- StockTechAnalysisTool: code, period
- StockRiskTool: codes (数组), check_types
- StockInfoSearchTool: codes (数组), search_types, days_back
- PortfolioMonitorTool: holdings, alert_threshold
- MarketScanTool: scan_type, threshold, limit
"""

import pytest
import json
from src.tools.stock_tech_analysis_tool import StockTechAnalysisTool
from src.tools.stock_risk_tool import StockRiskTool
from src.tools.stock_info_search_tool import StockInfoSearchTool
from src.tools.portfolio_monitor_tool import PortfolioMonitorTool
from src.tools.market_scan_tool import MarketScanTool


class TestPortfolioMonitorTool:
    """PortfolioMonitorTool单元测试"""
    
    def setup_method(self):
        self.tool = PortfolioMonitorTool()
    
    def test_list_input(self):
        """场景1: 盘前持仓监控 - 数组输入"""
        result = self.tool.execute(holdings=["600519", "000001"])
        data = json.loads(result)
        assert "portfolio" in data
        assert len(data["portfolio"]) == 2
    
    def test_json_string_input(self):
        """场景1: JSON字符串输入"""
        result = self.tool.execute(holdings='["600519", "000001"]')
        data = json.loads(result)
        assert "portfolio" in data
        assert len(data["portfolio"]) == 2
    
    def test_comma_separated_input(self):
        """场景1: 逗号分隔输入"""
        result = self.tool.execute(holdings="600519,000001")
        data = json.loads(result)
        assert "portfolio" in data
        assert len(data["portfolio"]) == 2
    
    def test_single_stock_input(self):
        """场景1: 单只股票"""
        result = self.tool.execute(holdings="600519")
        data = json.loads(result)
        assert "portfolio" in data
        assert len(data["portfolio"]) == 1
    
    def test_alert_threshold(self):
        """场景9: 风险预警触发"""
        result = self.tool.execute(holdings=["600519"], alert_threshold=1.0)
        data = json.loads(result)
        assert "alerts" in data
    
    def test_summary(self):
        """场景13: 收盘总结"""
        result = self.tool.execute(holdings=["600519", "000001", "601318"])
        data = json.loads(result)
        assert "summary" in data
        assert "total_stocks" in data["summary"]
        assert "avg_change_pct" in data["summary"]
        assert "total_alerts" in data["summary"]


class TestStockTechAnalysisTool:
    """StockTechAnalysisTool单元测试"""
    
    def setup_method(self):
        self.tool = StockTechAnalysisTool()
    
    def test_basic_analysis(self):
        """场景10: 技术指标分析"""
        result = self.tool.execute(code="600519", period="medium")
        data = json.loads(result)
        assert "code" in data
        assert "score" in data
    
    def test_different_periods(self):
        """场景10: 不同周期"""
        for period in ["short", "medium", "long"]:
            result = self.tool.execute(code="600519", period=period)
            data = json.loads(result)
            assert "code" in data


class TestStockRiskTool:
    """StockRiskTool单元测试"""
    
    def setup_method(self):
        self.tool = StockRiskTool()
    
    def test_basic_risk_check(self):
        """场景9: 风险预警触发"""
        result = self.tool.execute(codes=["600519"])
        data = json.loads(result)
        assert isinstance(data, list)
    
    def test_multiple_stocks(self):
        """场景9: 多只股票风险检查"""
        result = self.tool.execute(codes=["600519", "000001", "601318"])
        data = json.loads(result)
        assert isinstance(data, list)


class TestStockInfoSearchTool:
    """StockInfoSearchTool单元测试"""
    
    def setup_method(self):
        self.tool = StockInfoSearchTool()
    
    def test_basic_search(self):
        """场景11: 基本面查询"""
        result = self.tool.execute(codes=["600519"])
        data = json.loads(result)
        assert isinstance(data, list)
    
    def test_multiple_search(self):
        """场景11: 多只股票查询"""
        result = self.tool.execute(codes=["600519", "000001"])
        data = json.loads(result)
        assert isinstance(data, list)


class TestMarketScanTool:
    """MarketScanTool单元测试"""
    
    def setup_method(self):
        self.tool = MarketScanTool()
    
    def test_limit_up_scan(self):
        """场景3: 涨停股票分析"""
        result = self.tool.execute(scan_type="limit_up", limit=5)
        data = json.loads(result)
        assert "scan_type" in data
        assert data["scan_type"] == "limit_up"
        assert "results" in data
    
    def test_limit_down_scan(self):
        """场景4: 跌停股票风险"""
        result = self.tool.execute(scan_type="limit_down")
        data = json.loads(result)
        assert "scan_type" in data
    
    def test_active_scan(self):
        """场景7: 异动股票扫描"""
        result = self.tool.execute(scan_type="active", threshold=5.0, limit=5)
        data = json.loads(result)
        assert "scan_type" in data
    
    def test_index_scan(self):
        """场景5: 大盘指数监控"""
        result = self.tool.execute(scan_type="index")
        data = json.loads(result)
        assert "scan_type" in data
    
    def test_sector_scan(self):
        """场景6: 板块轮动检测"""
        result = self.tool.execute(scan_type="sector")
        data = json.loads(result)
        assert "scan_type" in data


class TestIntegrationScenarios:
    """14场景集成测试"""
    
    def test_scenario_1_morning_portfolio_check(self):
        """场景1: 盘前持仓监控"""
        tool = PortfolioMonitorTool()
        result = tool.execute(holdings=["600519", "000001", "601318"])
        data = json.loads(result)
        assert "portfolio" in data
        assert data["holdings_count"] == 3
    
    def test_scenario_2_realtime_monitoring(self):
        """场景2: 开盘后实时监控"""
        tool = PortfolioMonitorTool()
        result = tool.execute(holdings=["600519", "000001"], alert_threshold=2.0)
        data = json.loads(result)
        assert "alerts" in data
    
    def test_scenario_3_limit_up_analysis(self):
        """场景3: 涨停股票分析"""
        tool = MarketScanTool()
        result = tool.execute(scan_type="limit_up", limit=5)
        data = json.loads(result)
        assert "results" in data
    
    def test_scenario_4_limit_down_risk(self):
        """场景4: 跌停股票风险"""
        tool = MarketScanTool()
        result = tool.execute(scan_type="limit_down")
        data = json.loads(result)
        assert "results" in data
    
    def test_scenario_5_index_monitoring(self):
        """场景5: 大盘指数监控"""
        tool = MarketScanTool()
        result = tool.execute(scan_type="index")
        data = json.loads(result)
        assert "results" in data
    
    def test_scenario_6_sector_rotation(self):
        """场景6: 板块轮动检测"""
        tool = MarketScanTool()
        result = tool.execute(scan_type="sector")
        data = json.loads(result)
        assert "results" in data
    
    def test_scenario_7_active_stocks(self):
        """场景7: 异动股票扫描"""
        tool = MarketScanTool()
        result = tool.execute(scan_type="active", threshold=5.0)
        data = json.loads(result)
        assert "results" in data
    
    def test_scenario_8_portfolio_pnl(self):
        """场景8: 持仓盈亏计算"""
        tool = PortfolioMonitorTool()
        result = tool.execute(holdings=["600519", "000001", "601318", "600036", "601888"])
        data = json.loads(result)
        assert "summary" in data
        assert "avg_change_pct" in data["summary"]
    
    def test_scenario_9_risk_alert(self):
        """场景9: 风险预警触发"""
        tool = PortfolioMonitorTool()
        result = tool.execute(holdings=["600519", "000001"], alert_threshold=1.0)
        data = json.loads(result)
        assert "alerts" in data
    
    def test_scenario_10_tech_analysis(self):
        """场景10: 技术指标分析"""
        tool = StockTechAnalysisTool()
        result = tool.execute(code="600519", period="medium")
        data = json.loads(result)
        assert "code" in data
    
    def test_scenario_11_fundamental_query(self):
        """场景11: 基本面查询"""
        tool = StockInfoSearchTool()
        result = tool.execute(codes=["600519"])
        data = json.loads(result)
        assert isinstance(data, list)
    
    def test_scenario_12_stock_pool_rotation(self):
        """场景12: 股票池轮动"""
        tool = MarketScanTool()
        result = tool.execute(scan_type="active", threshold=3.0, limit=10)
        data = json.loads(result)
        assert "results" in data
    
    def test_scenario_13_closing_summary(self):
        """场景13: 收盘总结"""
        tool = PortfolioMonitorTool()
        holdings = ["600519", "000001", "601318"]
        result = tool.execute(holdings=holdings)
        data = json.loads(result)
        assert "summary" in data
        assert data["summary"]["total_stocks"] == 3
    
    def test_scenario_14_post_market_review(self):
        """场景14: 盘后复盘"""
        portfolio_tool = PortfolioMonitorTool()
        tech_tool = StockTechAnalysisTool()
        risk_tool = StockRiskTool()
        
        holdings = ["600519", "000001"]
        
        portfolio_result = json.loads(portfolio_tool.execute(holdings=holdings))
        tech_result = json.loads(tech_tool.execute(code="600519", period="medium"))
        risk_result = json.loads(risk_tool.execute(codes=["600519"]))
        
        assert "portfolio" in portfolio_result
        assert "code" in tech_result
        assert isinstance(risk_result, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
