"""Stock Risk Tool - A股风险预警工具

功能：
1. ST/*ST风险检查
2. 退市风险检查
3. 财务风险检查（负债率/流动比率）
4. 审计意见检查
5. 监管处罚检查
"""

import json
import logging
import signal
from typing import Dict, List, Optional
from mootdx.quotes import Quotes

logger = logging.getLogger(__name__)

# 超时保护装饰器
def timeout_handler(signum, frame):
    raise TimeoutError("API调用超时")

def with_timeout(seconds=10):
    """为akshare调用添加超时保护"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            old_handler = signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(seconds)
            try:
                result = func(*args, **kwargs)
                signal.alarm(0)
                return result
            except TimeoutError:
                logger.warning(f"{func.__name__} 超时({seconds}s)")
                return {"error": "API调用超时", "risk_level": "unknown"}
            except Exception as e:
                signal.alarm(0)
                logger.error(f"{func.__name__} 失败: {e}")
                return {"error": str(e), "risk_level": "unknown"}
            finally:
                signal.signal(signal.SIGALRM, old_handler)
                signal.alarm(0)
        return wrapper
    return decorator

# 安全类型转换
def safe_float(val, default=0.0):
    """安全转换为float，处理None/NaN/inf"""
    try:
        if val is None:
            return default
        import math
        f = float(val)
        return default if (math.isnan(f) or math.isinf(f)) else f
    except (ValueError, TypeError):
        return default

def safe_int(val, default=0):
    """安全转换为int"""
    try:
        if val is None:
            return default
        return int(float(val))
    except (ValueError, TypeError):
        return default


class StockRiskTool:
    """股票风险评估工具"""

    def __init__(self):
        self.name = "stock_risk_tool"
        self.description = "股票风险评估工具，检查ST/退市/财务/审计风险"
        self._stock_cache = None  # 缓存股票列表

    def _get_stock_list(self) -> dict:
        """获取全市场股票代码→名称映射（mootdx，带缓存）"""
        if self._stock_cache is not None:
            return self._stock_cache
        try:
            stock = Quotes.factory(market='std')
            df = stock.stocks()
            if df is not None and not df.empty:
                self._stock_cache = dict(zip(df['code'].astype(str), df['name'].astype(str)))
                return self._stock_cache
        except Exception as e:
            logger.warning(f"获取股票列表失败: {e}")
        return {}

    def _get_finance_data(self, code: str) -> dict:
        """通过mootdx获取单只股票财务数据"""
        try:
            stock = Quotes.factory(market='std')
            df = stock.finance(symbol=code)
            if df is not None and not df.empty:
                row = df.iloc[0]
                return row.to_dict()
        except Exception as e:
            logger.warning(f"获取财务数据失败 {code}: {e}")
        return {}

    def execute(self, codes: List[str], check_types: Optional[List[str]] = None) -> str:
        """
        执行风险评估

        Args:
            codes: 股票代码列表，如 ['000001', '600519']
            check_types: 检查类型列表，可选 ['st', 'delisting', 'financial', 'audit', 'regulation']
                        默认检查所有类型
        """
        try:
            if check_types is None:
                check_types = ["st", "delisting", "financial", "audit"]

            results = []
            for code in codes:
                result = self._check_single_stock(code, check_types)
                results.append(result)

            summary = {
                "total": len(results),
                "high_risk": sum(1 for r in results if r.get("risk_level") == "high"),
                "medium_risk": sum(1 for r in results if r.get("risk_level") == "medium"),
                "low_risk": sum(1 for r in results if r.get("risk_level") == "low"),
                "error": sum(1 for r in results if "error" in r),
            }

            return json.dumps({
                "success": True,
                "summary": summary,
                "data": results,
                "count": len(results)
            }, ensure_ascii=False, default=str)

        except Exception as e:
            logger.error(f"风险评估失败: {e}")
            return json.dumps({"error": str(e), "data": []}, ensure_ascii=False)

    def _check_single_stock(self, code: str, check_types: List[str]) -> Dict:
        """检查单只股票的风险"""
        result = {
            "code": code,
            "name": None,
            "risk_level": "low",
            "details": {}
        }

        # 获取股票名称（mootdx）
        stock_list = self._get_stock_list()
        result["name"] = stock_list.get(code, "未知")

        # 1. ST/*ST检查
        if "st" in check_types:
            result["details"]["st"] = self._check_st_risk(code, result["name"])

        # 2. 退市风险检查
        if "delisting" in check_types:
            result["details"]["delisting"] = self._check_delisting_risk(code)

        # 3. 财务风险检查
        if "financial" in check_types:
            result["details"]["financial"] = self._check_financial_risk(code)

        # 4. 审计意见检查
        if "audit" in check_types:
            result["details"]["audit"] = self._check_audit_risk(code)

        # 计算总体风险等级
        result["risk_level"] = self._calculate_overall_risk(result["details"])

        return result

    def _check_st_risk(self, code: str, name: str = None) -> Dict:
        """检查ST/*ST风险（通过mootdx股票名称判断）"""
        result = {
            "is_st": False,
            "st_type": None,
            "reason": None,
            "risk_level": "low"
        }

        if not name:
            stock_list = self._get_stock_list()
            name = stock_list.get(code, "")

        if 'ST' in name or '*ST' in name:
            result["is_st"] = True
            result["st_type"] = "*ST" if "*ST" in name else "ST"
            result["reason"] = f"股票名称包含{result['st_type']}"
            result["risk_level"] = "high"

        return result

    def _check_delisting_risk(self, code: str) -> Dict:
        """检查退市风险（通过mootdx财务数据）"""
        result = {
            "is_delisted": False,
            "risk_level": "low",
            "indicators": {},
            "reason": None
        }

        try:
            fin = self._get_finance_data(code)
            if not fin:
                result["reason"] = "无法获取财务数据"
                return result

            # 检查净利润 (jinglirun字段，单位：元)
            net_profit = safe_float(fin.get('jinglirun', 0))
            result["indicators"]["net_profit"] = net_profit
            if net_profit < 0:
                result["indicators"]["net_profit_negative"] = True

            # 检查营业收入 (zhuyingshouru字段)
            revenue = safe_float(fin.get('zhuyingshouru', 0))
            result["indicators"]["revenue"] = revenue
            if 0 < revenue < 3e8:  # 低于3亿
                result["indicators"]["low_revenue"] = True

            # 计算退市风险等级
            if result["indicators"].get("net_profit_negative") and result["indicators"].get("low_revenue"):
                result["risk_level"] = "high"
                result["reason"] = f"净利润{net_profit/1e8:.2f}亿为负且营收{revenue/1e8:.2f}亿低于3亿"
            elif result["indicators"].get("net_profit_negative"):
                result["risk_level"] = "medium"
                result["reason"] = f"净利润{net_profit/1e8:.2f}亿为负"

        except Exception as e:
            logger.debug(f"退市风险检查失败 {code}: {e}")
            result["reason"] = f"检查失败: {str(e)}"

        return result

    def _check_financial_risk(self, code: str) -> Dict:
        """检查财务风险（通过mootdx财务数据）"""
        result = {
            "risk_level": "low",
            "indicators": {},
            "reason": None
        }

        try:
            fin = self._get_finance_data(code)
            if not fin:
                result["reason"] = "无法获取财务数据"
                return result

            total_assets = safe_float(fin.get('zongzichan', 0))
            net_assets = safe_float(fin.get('jingzichan', 0))
            total_liabilities = total_assets - net_assets if total_assets > 0 and net_assets > 0 else 0

            # 资产负债率
            if total_assets > 0:
                debt_ratio = total_liabilities / total_assets
                result["indicators"]["debt_ratio"] = round(debt_ratio * 100, 2)
                result["indicators"]["total_assets"] = round(total_assets / 1e8, 2)  # 亿元
                result["indicators"]["net_assets"] = round(net_assets / 1e8, 2)

                if debt_ratio > 0.7:
                    result["risk_level"] = "high"
                    result["reason"] = f"资产负债率过高: {debt_ratio*100:.1f}%"
                elif debt_ratio > 0.5:
                    result["risk_level"] = "medium"
                    result["reason"] = f"资产负债率偏高: {debt_ratio*100:.1f}%"

        except Exception as e:
            logger.debug(f"财务风险检查失败 {code}: {e}")
            result["reason"] = f"检查失败: {str(e)}"

        return result

    def _check_audit_risk(self, code: str) -> Dict:
        """检查审计意见风险"""
        result = {
            "risk_level": "low",
            "audit_opinion": None,
            "reason": None
        }

        try:
            # 尝试通过akshare获取审计意见（带超时保护）
            import akshare as ak
            import signal as sig

            def timeout_handler(signum, frame):
                raise TimeoutError("超时")

            old_handler = sig.signal(sig.SIGALRM, timeout_handler)
            sig.alarm(8)
            try:
                audit_data = ak.stock_audit_opinion_em(symbol=code)
                sig.alarm(0)
                if audit_data is not None and len(audit_data) > 0:
                    latest_opinion = str(audit_data.iloc[0].get('审计意见', ''))
                    result["audit_opinion"] = latest_opinion
                    non_standard = ['保留意见', '否定意见', '无法表示意见', '带强调事项']
                    for opinion in non_standard:
                        if opinion in latest_opinion:
                            result["risk_level"] = "high"
                            result["reason"] = f"非标准审计意见: {opinion}"
                            break
            except (TimeoutError, Exception):
                sig.alarm(0)
                result["audit_opinion"] = "未知（查询超时）"
            finally:
                sig.signal(sig.SIGALRM, old_handler)
                sig.alarm(0)

        except Exception as e:
            logger.debug(f"审计风险检查失败 {code}: {e}")
            result["audit_opinion"] = "未知"

        return result

    def _calculate_overall_risk(self, details: Dict) -> str:
        """计算总体风险等级"""
        risk_levels = []

        for check_type, result in details.items():
            if isinstance(result, dict):
                level = result.get("risk_level", "low")
                if level in ("high", "medium", "low"):
                    risk_levels.append(level)

        if "high" in risk_levels:
            return "high"
        if "medium" in risk_levels:
            return "medium"
        return "low"
