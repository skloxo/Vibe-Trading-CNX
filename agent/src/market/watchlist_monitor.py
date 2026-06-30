# -*- coding: utf-8 -*-
"""
自选股秒级监控预警服务 (Task 1.6)
"""
import asyncio
import logging
import os
import sqlite3
import time
import requests
from datetime import datetime, time as dt_time
from typing import List, Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger("watchlist_monitor")

class WatchlistMonitorService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(WatchlistMonitorService, cls).__new__(cls, *args, **kwargs)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, check_interval_seconds: float = 5.0):
        if self._initialized:
            return
        self._initialized = True
        self.check_interval = check_interval_seconds
        self._task = None
        self._running = False
        self.cooldown_seconds = 300  # 预警冷却时间：5分钟

    def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("[WatchlistMonitor] 自选股实时监控预警服务已启动")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("[WatchlistMonitor] 自选股实时监控预警服务已停止")

    def _is_trading_hours(self) -> bool:
        """判断当前是否为交易时间（周一至周五 09:30-11:30, 13:00-15:00）"""
        # 测试模式：如果环境变量设置了 VIBE_TRADING_TEST_MONITOR=1，则无视交易时间限制
        if os.getenv("VIBE_TRADING_TEST_MONITOR") == "1":
            return True
            
        now = datetime.now()
        if now.weekday() >= 5:  # 周六日不交易
            return False
            
        current_time = now.time()
        morning_start = dt_time(9, 30)
        morning_end = dt_time(11, 30)
        afternoon_start = dt_time(13, 0)
        afternoon_end = dt_time(15, 0)
        
        return (morning_start <= current_time <= morning_end) or (afternoon_start <= current_time <= afternoon_end)

    async def _loop(self):
        from src.config.paths import get_runtime_root
        from src.market.shared_data_hub import SharedMemoryHub
        
        hub = SharedMemoryHub()
        
        while self._running:
            try:
                if not self._is_trading_hours():
                    # 非交易时间，等待 30 秒后再次检查
                    await asyncio.sleep(30)
                    continue
                
                # 1. 扫描所有租户的数据库
                runtime_root = get_runtime_root()
                db_files = list(runtime_root.glob("stocks_*.db"))
                
                for db_file in db_files:
                    tenant_id = db_file.stem.replace("stocks_", "")
                    await self._monitor_tenant(tenant_id, db_file, hub)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("[WatchlistMonitor] 监控循环发生异常: %s", e)
                
            await asyncio.sleep(self.check_interval)

    async def _monitor_tenant(self, tenant_id: str, db_path: Path, hub: Any):
        """对单个租户的自选股执行监控检查"""
        try:
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # 读取该租户的自选股列表
            cursor.execute("SELECT code, name FROM Watchlist")
            watchlist = {row["code"]: row["name"] for row in cursor.fetchall()}
            if not watchlist:
                conn.close()
                return
                
            # 读取该租户的有效预警规则
            cursor.execute("SELECT id, code, rule_type, threshold, last_triggered_at FROM AlertRules WHERE is_active = 1")
            rules = cursor.fetchall()
            if not rules:
                conn.close()
                return
                
            # 从 SharedMemoryHub 批量获取实时行情
            symbols = list(watchlist.keys())
            quotes = hub.get_quotes(symbols)
            
            now_str = datetime.now().isoformat()
            
            for rule in rules:
                rule_id = rule["id"]
                code = rule["code"]
                rule_type = rule["rule_type"]
                threshold = rule["threshold"]
                last_triggered = rule["last_triggered_at"]
                
                # 如果没有实时行情，则跳过
                quote = quotes.get(code)
                if not quote or "price" not in quote:
                    continue
                    
                current_price = float(quote["price"])
                pct_chg = float(quote.get("pct_chg", 0.0))
                stock_name = watchlist.get(code, code)
                
                # 检查是否冷却中
                if last_triggered:
                    last_time = datetime.fromisoformat(last_triggered)
                    if (datetime.now() - last_time).total_seconds() < self.cooldown_seconds:
                        continue
                
                # 触发判定
                triggered = False
                trigger_detail = ""
                
                if rule_type == "price_above" and current_price >= threshold:
                    triggered = True
                    trigger_detail = f"股价突破 {threshold:.2f} 元 (当前价: {current_price:.2f} 元)"
                elif rule_type == "price_below" and current_price <= threshold:
                    triggered = True
                    trigger_detail = f"股价跌破 {threshold:.2f} 元 (当前价: {current_price:.2f} 元)"
                elif rule_type == "pct_change":
                    # 涨跌幅绝对值突破阈值 (例如设置 5 代表涨跌幅超过 5% 或低于 -5%)
                    if abs(pct_chg) >= abs(threshold):
                        triggered = True
                        trigger_detail = f"今日涨跌幅达到 {pct_chg:+.2f}% (阈值: {threshold:+.2f}%)"
                
                if triggered:
                    # 触发预警推送
                    success = self._send_alert_notification(tenant_id, code, stock_name, trigger_detail, pct_chg, current_price)
                    if success:
                        # 更新触发时间，进入冷却
                        cursor.execute("UPDATE AlertRules SET last_triggered_at = ? WHERE id = ?", (now_str, rule_id))
                        conn.commit()
                        
            conn.close()
        except Exception as e:
            logger.error(f"[WatchlistMonitor] 监控租户 {tenant_id} 发生错误: {e}")

    def _send_alert_notification(self, tenant_id: str, code: str, name: str, detail: str, pct_chg: float, price: float) -> bool:
        """通过飞书/钉钉 Webhook 发送预警卡片"""
        # 优先读取租户专属的 Webhook 配置，无则读取全局配置
        feishu_url = os.getenv(f"FEISHU_WEBHOOK_URL_{tenant_id}") or os.getenv("FEISHU_WEBHOOK_URL")
        dingtalk_url = os.getenv(f"DINGTALK_WEBHOOK_URL_{tenant_id}") or os.getenv("DINGTALK_WEBHOOK_URL")
        
        if not feishu_url and not dingtalk_url:
            logger.warning(f"[{tenant_id}] 触发了 {name} ({code}) 预警，但未配置飞书/钉钉 Webhook 地址。")
            return False
            
        time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        color = "green" if pct_chg >= 0 else "red"
        trend_symbol = "📈" if pct_chg >= 0 else "📉"
        
        # 1. 发送飞书富文本消息
        if feishu_url:
            payload = {
                "msg_type": "post",
                "content": {
                    "post": {
                        "zh_cn": {
                            "title": f"🚨 Vibe-Trading 实时自选预警",
                            "content": [
                                [
                                    {"tag": "text", "text": f"股票代码: {code}\n"},
                                    {"tag": "text", "text": f"股票名称: {name} {trend_symbol}\n"},
                                    {"tag": "text", "text": f"当前价格: {price:.2f} 元 (涨跌幅: {pct_chg:+.2f}%)\n"},
                                    {"tag": "text", "text": f"触发条件: "},
                                    {"tag": "text", "style": ["bold"], "text": f"{detail}\n"},
                                    {"tag": "text", "text": f"触发时间: {time_str}"}
                                ]
                            ]
                        }
                    }
                }
            }
            try:
                res = requests.post(feishu_url, json=payload, timeout=5)
                logger.info(f"[{tenant_id}] 飞书预警发送结果: {res.status_code}")
            except Exception as e:
                logger.error(f"[{tenant_id}] 发送飞书预警异常: {e}")

        # 2. 发送钉钉 Markdown 消息
        if dingtalk_url:
            payload = {
                "msgtype": "markdown",
                "markdown": {
                    "title": "🚨 Vibe-Trading 实时自选预警",
                    "text": (
                        f"### 🚨 Vibe-Trading 实时自选预警\n\n"
                        f"- **股票代码**: `{code}`\n"
                        f"- **股票名称**: **{name}** {trend_symbol}\n"
                        f"- **当前价格**: `{price:.2f} 元` (涨跌幅: `{pct_chg:+.2f}%`)\n"
                        f"- **触发条件**: <font color='{color}'>**{detail}**</font>\n"
                        f"- **触发时间**: {time_str}"
                    )
                }
            }
            try:
                res = requests.post(dingtalk_url, json=payload, timeout=5)
                logger.info(f"[{tenant_id}] 钉钉预警发送结果: {res.status_code}")
            except Exception as e:
                logger.error(f"[{tenant_id}] 发送钉钉预警异常: {e}")
                
        return True
