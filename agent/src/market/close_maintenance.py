# -*- coding: utf-8 -*-
"""
收盘数据自动维护与对账自愈服务
"""
import asyncio
import logging
import os
import subprocess
import sys
import time
from datetime import datetime, time as dt_time, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger("close_maintenance")

class CloseDataMaintenanceService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(CloseDataMaintenanceService, cls).__new__(cls, *args, **kwargs)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._task = None
        self._running = False

    def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("[CloseMaintenance] 收盘数据维护服务已启动")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("[CloseMaintenance] 收盘数据维护服务已停止")

    async def _loop(self):
        # Gap Healing on Startup: execute immediately to heal any gap caused by downtime
        logger.info("[CloseMaintenance] 服务启动，执行初次收盘维护与对账自愈（Gap Healing）...")
        try:
            await self._execute_maintenance()
        except Exception as e:
            logger.exception("[CloseMaintenance] 启动初次收盘维护失败: %s", e)

        while self._running:
            try:
                now = datetime.now()
                # Compute next 15:35 trigger time
                target_time = datetime.combine(now.date(), dt_time(15, 35))
                if now >= target_time:
                    target_time += timedelta(days=1)
                
                delay = (target_time - now).total_seconds()
                logger.info(f"[CloseMaintenance] 下次收盘维护任务将于 {target_time} 执行，等待 {delay:.1f} 秒...")
                
                # Wait asynchronously
                await asyncio.sleep(delay)
                
                # Execute daily maintenance
                await self._execute_maintenance()
                
                # Schedule reconciliation and self-healing tasks (16:00, 18:00, 20:00)
                await self._schedule_reconciliation()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("[CloseMaintenance] 维护循环发生异常: %s", e)
                # Wait 1 minute before retrying on error to avoid tight cpu loop
                await asyncio.sleep(60)

    async def _execute_maintenance(self):
        logger.info("[CloseMaintenance] 开始扫描各租户数据库，执行收盘数据全量维护与对账任务...")
        from src.config.paths import get_runtime_root
        
        runtime_root = get_runtime_root()
        db_files = list(runtime_root.glob("stocks_*.db"))
        
        if not db_files:
            logger.info("[CloseMaintenance] 未发现 stocks_*.db 租户数据库，将对默认租户 default 进行维护")
            db_files = [runtime_root / "stocks_default.db"]
            
        loop = asyncio.get_running_loop()
        for db_file in db_files:
            tenant_id = db_file.stem.replace("stocks_", "")
            logger.info(f"[CloseMaintenance] 启动租户 {tenant_id} 的同步对账自愈...")
            # Run the synchronization in the thread executor to avoid blocking the event loop
            await loop.run_in_executor(None, self._run_sync_script_with_retry, tenant_id)

    def _run_sync_script_with_retry(self, tenant_id: str) -> bool:
        script_path = Path(__file__).parent.parent.parent / "scripts" / "initialize_history_data.py"
        max_attempts = 3
        delay = 5.0
        
        for attempt in range(1, max_attempts + 1):
            try:
                logger.info(f"[CloseMaintenance] 运行数据同步脚本 (租户: {tenant_id}, 尝试: {attempt}/{max_attempts})...")
                # Run script with tenant arg and backfill 1 year for daily maintenance
                result = subprocess.run(
                    [sys.executable, str(script_path), "--tenant", tenant_id, "--years", "1"],
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    logger.info(f"[CloseMaintenance] 租户 {tenant_id} 同步脚本在尝试 {attempt} 成功执行")
                    return True
                else:
                    logger.error(f"[CloseMaintenance] 租户 {tenant_id} 同步脚本失败 (错误码: {result.returncode}):\n{result.stderr}")
            except Exception as e:
                logger.exception(f"[CloseMaintenance] 执行租户 {tenant_id} 同步脚本发生异常: %s", e)
                
            if attempt < max_attempts:
                wait_time = delay * (2 ** (attempt - 1))
                logger.info(f"[CloseMaintenance] 将在 {wait_time:.1f} 秒后重试...")
                time.sleep(wait_time)
                
        # Send Feishu Webhook Alert if all attempts failed
        logger.error(f"[CloseMaintenance] 租户 {tenant_id} 的收盘同步任务连续 {max_attempts} 次失败，触发报警！")
        self._send_feishu_alert(tenant_id)
        return False

    def _send_feishu_alert(self, tenant_id: str):
        feishu_url = os.getenv(f"FEISHU_WEBHOOK_URL_{tenant_id}") or os.getenv("FEISHU_WEBHOOK_URL")
        if not feishu_url:
            logger.warning(f"[CloseMaintenance] 租户 {tenant_id} 的飞书报警 Webhook URL 未配置，跳过发送")
            return
            
        time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        payload = {
            "msg_type": "post",
            "content": {
                "post": {
                    "zh_cn": {
                        "title": "🚨 Vibe-Trading 收盘同步维护失败",
                        "content": [
                            [
                                {"tag": "text", "text": f"租户 ID: {tenant_id}\n"},
                                {"tag": "text", "text": "报警详情: 每日收盘行情同步脚本执行连续 3 次失败，未能完成当日收盘行情同步与维护，请检查网络或数据源接口。\n"},
                                {"tag": "text", "text": f"触发时间: {time_str}"}
                             ]
                         ]
                     }
                 }
             }
         }
        try:
            import requests
            res = requests.post(feishu_url, json=payload, timeout=10)
            logger.info(f"[CloseMaintenance] 报警消息已发送至飞书，响应状态: {res.status_code}")
        except Exception as e:
            logger.error(f"[CloseMaintenance] 发送飞书报警消息失败: {e}")

    async def _schedule_reconciliation(self):
        # Reconciliation and self-healing timepoints: 16:00, 18:00, 20:00
        reconcile_hours = [16, 18, 20]
        now = datetime.now()
        for hour in reconcile_hours:
            target_time = datetime.combine(now.date(), dt_time(hour, 0))
            if now < target_time:
                delay = (target_time - now).total_seconds()
                logger.info(f"[CloseMaintenance] 安排对账自愈任务于 {target_time} 执行，等待 {delay:.1f} 秒...")
                await asyncio.sleep(delay)
                await self._execute_reconciliation(hour)

    async def _execute_reconciliation(self, hour: int):
        logger.info(f"[CloseMaintenance] 开始执行 {hour}:00 对账自愈检查与补偿拉取...")
        await self._execute_maintenance()
