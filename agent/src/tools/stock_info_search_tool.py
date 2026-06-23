"""
Stock Information Search Tool

职责:
- 个股新闻搜索
- 公司公告搜索
- 市场舆情搜索
- 投资者互动搜索

使用: web_search + read_url + akshare
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
import logging
import re

from src.agent.tools import BaseTool
from ._stock_utils import fmt_stock, validate_code, normalize_code, get_stock_name

logger = logging.getLogger(__name__)


class StockInfoSearchTool(BaseTool):
    """个股信息搜索工具 - 新闻/公告/舆情"""

    name = "stock_info_search"
    description = (
        "搜索个股相关信息：新闻、公告、投资者互动、市场舆情。"
        "支持单股或多股搜索。"
        "返回结构化信息摘要和关键信号。"
    )
    parameters = {
        "type": "object",
        "properties": {
            "codes": {
                "type": "array",
                "items": {"type": "string"},
                "description": "股票代码列表",
            },
            "search_types": {
                "type": "array",
                "items": {"type": "string"},
                "description": "搜索类型: news, announcement, interaction, sentiment",
                "default": ["news", "announcement"],
            },
            "days_back": {
                "type": "integer",
                "description": "搜索最近N天的信息",
                "default": 7,
            },
        },
        "required": ["codes"],
    }

    def execute(self, **kwargs: Any) -> str:
        import json
        
        codes = kwargs.get("codes", [])
        search_types = kwargs.get("search_types", ["news", "announcement"])
        days_back = kwargs.get("days_back", 7)
        
        if not codes:
            return json.dumps({"error": "未提供股票代码", "data": []}, ensure_ascii=False)
        
        try:
            results = []
            
            for code in codes:
                if not validate_code(code):
                    results.append({
                        "code": code,
                        "error": f"无效股票代码: {code}"
                    })
                    continue
                
                code = normalize_code(code)
                stock_name = get_stock_name(code)
                
                stock_info = {
                    "code": code,
                    "name": stock_name or "unknown",
                    "display": fmt_stock(code, stock_name),
                    "search_time": datetime.now().isoformat(),
                    "days_back": days_back,
                    "info": {}
                }
                
                # 搜索新闻
                if "news" in search_types:
                    news_result = self._search_news(code, stock_name, days_back)
                    stock_info["info"]["news"] = news_result
                
                # 搜索公告
                if "announcement" in search_types:
                    announcement_result = self._search_announcements(code, days_back)
                    stock_info["info"]["announcements"] = announcement_result
                
                # 搜索投资者互动
                if "interaction" in search_types:
                    interaction_result = self._search_interactions(code, days_back)
                    stock_info["info"]["interactions"] = interaction_result
                
                # 搜索市场舆情
                if "sentiment" in search_types:
                    sentiment_result = self._search_sentiment(code, stock_name, days_back)
                    stock_info["info"]["sentiment"] = sentiment_result
                
                # 提取关键信号
                stock_info["signals"] = self._extract_signals(stock_info["info"])
                
                results.append(stock_info)
            
            # 汇总统计
            summary = {
                "total": len(results),
                "with_news": sum(1 for r in results if r.get("info", {}).get("news", {}).get("count", 0) > 0),
                "with_announcements": sum(1 for r in results if r.get("info", {}).get("announcements", {}).get("count", 0) > 0),
                "high_signal": sum(1 for r in results if len(r.get("signals", [])) > 0),
            }
            
            return json.dumps({
                "success": True,
                "summary": summary,
                "data": results,
                "count": len(results)
            }, ensure_ascii=False, default=str)
            
        except Exception as e:
            logger.error(f"信息搜索失败: {e}")
            return json.dumps({"error": str(e), "data": []}, ensure_ascii=False)
    
    def _search_news(self, code: str, stock_name: str, days_back: int) -> Dict:
        """搜索个股新闻"""
        result = {
            "count": 0,
            "items": [],
            "source": "akshare",
            "error": None
        }
        
        try:
            import akshare as ak
            
            # 使用akshare获取新闻
            try:
                news_data = ak.stock_news_em(symbol=code)
                
                if news_data is not None and len(news_data) > 0:
                    # 过滤最近N天的新闻
                    cutoff_date = datetime.now() - timedelta(days=days_back)
                    
                    for _, row in news_data.head(10).iterrows():
                        news_item = {
                            "title": row.get("新闻标题", ""),
                            "source": row.get("新闻来源", ""),
                            "time": str(row.get("发布时间", "")),
                            "url": row.get("新闻链接", ""),
                        }
                        result["items"].append(news_item)
                    
                    result["count"] = len(result["items"])
            except Exception as e:
                logger.debug(f"akshare新闻获取失败: {e}")
                result["error"] = str(e)
            
        except Exception as e:
            logger.debug(f"新闻搜索失败 {code}: {e}")
            result["error"] = str(e)
        
        return result
    
    def _search_announcements(self, code: str, days_back: int) -> Dict:
        """搜索公司公告"""
        result = {
            "count": 0,
            "items": [],
            "source": "akshare",
            "error": None
        }
        
        try:
            import akshare as ak
            
            # 使用akshare获取公告
            try:
                announcement_data = ak.stock_zh_a_alerts_cls(symbol=code)
                
                if announcement_data is not None and len(announcement_data) > 0:
                    cutoff_date = datetime.now() - timedelta(days=days_back)
                    
                    for _, row in announcement_data.head(10).iterrows():
                        announcement_item = {
                            "title": row.get("公告标题", ""),
                            "type": row.get("公告类型", ""),
                            "time": str(row.get("公告时间", "")),
                            "url": row.get("公告链接", ""),
                        }
                        result["items"].append(announcement_item)
                    
                    result["count"] = len(result["items"])
            except Exception as e:
                logger.debug(f"akshare公告获取失败: {e}")
                result["error"] = str(e)
            
        except Exception as e:
            logger.debug(f"公告搜索失败 {code}: {e}")
            result["error"] = str(e)
        
        return result
    
    def _search_interactions(self, code: str, days_back: int) -> Dict:
        """搜索投资者互动"""
        result = {
            "count": 0,
            "items": [],
            "source": "akshare",
            "error": None
        }
        
        try:
            import akshare as ak
            
            # 使用akshare获取投资者互动
            try:
                interaction_data = ak.stock_irm_cninfo(symbol=code)
                
                if interaction_data is not None and len(interaction_data) > 0:
                    cutoff_date = datetime.now() - timedelta(days=days_back)
                    
                    for _, row in interaction_data.head(10).iterrows():
                        interaction_item = {
                            "question": row.get("提问内容", ""),
                            "answer": row.get("回复内容", ""),
                            "time": str(row.get("提问时间", "")),
                        }
                        result["items"].append(interaction_item)
                    
                    result["count"] = len(result["items"])
            except Exception as e:
                logger.debug(f"akshare投资者互动获取失败: {e}")
                result["error"] = str(e)
            
        except Exception as e:
            logger.debug(f"投资者互动搜索失败 {code}: {e}")
            result["error"] = str(e)
        
        return result
    
    def _search_sentiment(self, code: str, stock_name: str, days_back: int) -> Dict:
        """搜索市场舆情"""
        result = {
            "count": 0,
            "items": [],
            "sentiment_score": None,
            "source": "web_search",
            "error": None
        }
        
        try:
            # 使用web_search搜索舆情
            # 这里需要调用Agent的web_search工具
            # 由于Tool之间不互相调用，这里返回搜索建议
            result["search_queries"] = [
                f"{stock_name} 最新消息",
                f"{stock_name} 股吧",
                f"{stock_name} 投资者关系",
            ]
            result["count"] = 0
            result["note"] = "需要通过Agent调用web_search获取舆情"
            
        except Exception as e:
            logger.debug(f"舆情搜索失败 {code}: {e}")
            result["error"] = str(e)
        
        return result
    
    def _extract_signals(self, info: Dict) -> List[Dict]:
        """从搜索结果中提取关键信号"""
        signals = []
        
        # 检查公告中的重大事件
        announcements = info.get("announcements", {})
        if announcements.get("items"):
            for ann in announcements["items"]:
                title = ann.get("title", "")
                # 检测重大事件关键词
                major_keywords = ["业绩", "分红", "增持", "减持", "重组", "收购", "合作", "中标"]
                for keyword in major_keywords:
                    if keyword in title:
                        signals.append({
                            "type": "announcement",
                            "keyword": keyword,
                            "title": title,
                            "importance": "high"
                        })
                        break
        
        # 检查新闻中的重要信息
        news = info.get("news", {})
        if news.get("items"):
            for news_item in news["items"]:
                title = news_item.get("title", "")
                # 检测重要新闻关键词
                important_keywords = ["涨停", "跌停", "利好", "利空", "突破", "新高", "新低"]
                for keyword in important_keywords:
                    if keyword in title:
                        signals.append({
                            "type": "news",
                            "keyword": keyword,
                            "title": title,
                            "importance": "medium"
                        })
                        break
        
        return signals
