# -*- coding: utf-8 -*-
"""
同花顺自选股双向同步模块 (Task 1.5)
"""
import os
import sqlite3
import logging
import requests
import asyncio
from typing import List, Dict, Any, Optional, Set
from pathlib import Path

logger = logging.getLogger("ths_sync")

def get_ths_cookie(tenant_id: str) -> Optional[str]:
    """
    自足获取指定租户的 THS_COOKIE
    """
    cookie = os.environ.get("THS_COOKIE")
    if cookie:
        return cookie

    if tenant_id == "default":
        env_path = Path.home() / ".vibe-trading-cnx" / ".env"
    else:
        env_path = Path.home() / ".vibe-trading-cnx" / "tenants" / tenant_id / ".env"

    if env_path.exists():
        try:
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                if k.strip() == "THS_COOKIE":
                    return v.strip().strip("'\"")
        except Exception as e:
            logger.error(f"[ThsSync] Failed to read THS_COOKIE from {env_path}: {e}")
    return None


class ThsSyncManager:
    """
    同花顺自选股同步管理器
    支持基于 Web Cookie 进行自选股列表的双向同步。
    如果未配置 Cookie，则自动降级为本地自选股管理。
    """
    
    def __init__(self, tenant_id: str, db_path: Optional[Path] = None):
        self.tenant_id = tenant_id
        if db_path:
            self.db_path = db_path
        else:
            from src.config.paths import get_runtime_root
            self.db_path = get_runtime_root() / f"stocks_{tenant_id}.db"
            
        self.last_synced_watchlist: Optional[Set[str]] = None
        self._init_db()

    def _init_db(self):
        """初始化租户自选股数据库表"""
        try:
            os.makedirs(self.db_path.parent, exist_ok=True)
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            # 创建自选股表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS Watchlist (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT NOT NULL,
                    name TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(code)
                );
            """)
            
            # 创建预警规则表 (为 Task 1.6 准备)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS AlertRules (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT NOT NULL,
                    rule_type TEXT NOT NULL, -- 'price_above', 'price_below', 'pct_change'
                    threshold REAL NOT NULL,
                    is_active INTEGER DEFAULT 1,
                    last_triggered_at TEXT,
                    UNIQUE(code, rule_type, threshold)
                );
            """)
            
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"[{self.tenant_id}] 初始化自选股数据库失败: {e}")

    def get_local_watchlist(self) -> List[Dict[str, str]]:
        """获取本地自选股列表"""
        try:
            conn = sqlite3.connect(str(self.db_path))
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT code, name FROM Watchlist ORDER BY id DESC")
            rows = cursor.fetchall()
            conn.close()
            return [{"code": r["code"], "name": r["name"]} for r in rows]
        except Exception as e:
            logger.error(f"[{self.tenant_id}] 获取本地自选股列表失败: {e}")
            return []

    def get_local_watchlist_codes(self) -> Set[str]:
        """获取本地自选股代码集合"""
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT code FROM Watchlist")
            codes = {r[0] for r in cursor.fetchall()}
            conn.close()
            return codes
        except Exception as e:
            logger.error(f"[{self.tenant_id}] 获取本地自选股代码集合失败: {e}")
            return set()

    def add_to_local(self, code: str, name: str = "") -> bool:
        """向本地自选股添加一只股票"""
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            cursor.execute(
                "INSERT OR IGNORE INTO Watchlist (code, name) VALUES (?, ?)",
                (code.strip(), name.strip())
            )
            conn.commit()
            conn.close()
            logger.info(f"[{self.tenant_id}] 本地自选股已添加: {code} ({name})")
            return True
        except Exception as e:
            logger.error(f"[{self.tenant_id}] 添加本地自选股失败: {e}")
            return False

    def remove_from_local(self, code: str) -> bool:
        """从本地自选股移出一只股票"""
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            cursor.execute("DELETE FROM Watchlist WHERE code = ?", (code.strip(),))
            conn.commit()
            conn.close()
            logger.info(f"[{self.tenant_id}] 本地自选股已移除: {code}")
            return True
        except Exception as e:
            logger.error(f"[{self.tenant_id}] 移除本地自选股失败: {e}")
            return False

    @staticmethod
    def _parse_cookie_dict(cookie: str) -> Dict[str, str]:
        """将 cookie 字符串解析为字典"""
        result = {}
        for part in cookie.split(";"):
            part = part.strip()
            if "=" in part:
                k, v = part.split("=", 1)
                result[k.strip()] = v.strip()
        return result

    @staticmethod
    def _parse_selfstock_v1(raw: str) -> List[Dict[str, str]]:
        """解析同花顺 V1 自选股数据格式: 'code1|code2,...,type1|type2'"""
        stocks = []
        if not raw:
            return stocks
        comma_idx = raw.rfind(",")
        if comma_idx < 0:
            return stocks
        codes_segment = raw[:comma_idx]
        types_segment = raw[comma_idx + 1:]
        codes = [c for c in codes_segment.split("|") if c]
        types = [t for t in types_segment.split("|") if t]
        for i, code in enumerate(codes):
            market_type = types[i] if i < len(types) else ""
            stocks.append({"code": code, "name": "", "market_type": market_type})
        return stocks

    # THS V1 API constants
    _THS_UA = (
        "Hexin_Gphone/11.28.03 (Royal Flush) hxtheme/0 innerversion/G037.09.028.1.32 "
        "followPhoneSystemTheme/0 userid/000000000 getHXAPPAccessibilityMode/0 "
        "hxNewFont/1 isVip/0 getHXAPPFontSetting/normal getHXAPPAdaptOldSetting/0 okhttp/3.14.9"
    )
    _THS_V1_BASE_URL = "https://ugc.10jqka.com.cn"
    _THS_V1_QUERY_PATH = "/optdata/selfstock/open/api/v1/query"
    _THS_V1_MODIFY_PATH = "/optdata/selfstock/open/api/v1/modify"

    def get_cloud_watchlist(self, cookie: str) -> Optional[List[Dict[str, str]]]:
        """获取同花顺云端自选股列表（使用 V1 API）"""
        url = self._THS_V1_BASE_URL + self._THS_V1_QUERY_PATH
        cookie_dict = self._parse_cookie_dict(cookie)
        userid = cookie_dict.get("userid", "")
        headers = {
            "User-Agent": self._THS_UA,
            "userid": userid,
        }
        params = {"support_all": "0", "from": "thspc_hevo"}
        try:
            response = requests.get(url, headers=headers, params=params, cookies=cookie_dict, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status_code") == 0:
                    raw = data.get("data", {}).get("selfstock", "")
                    return self._parse_selfstock_v1(raw)
                else:
                    logger.error(f"[{self.tenant_id}] 同花顺云端接口返回错误: {data.get('status_msg')}")
            else:
                logger.error(f"[{self.tenant_id}] 访问同花顺云端接口失败，HTTP 状态码: {response.status_code}")
        except Exception as e:
            logger.error(f"[{self.tenant_id}] 访问同花顺云端接口异常: {e}")
        return None

    def sync_to_ths(self, cookie: str, code: str, action: str = "add") -> bool:
        """
        将本地自选股的变动同步到同花顺云端 (Push) — 使用 V1 全量覆写接口
        先拉取云端最新列表，增删后全量 PUT 回去。
        action: 'add' (添加) 或 'del' (删除)
        """
        if not cookie or cookie.strip() in ("", ""):
            return False

        logger.info(f"[{self.tenant_id}] 正在将自选股变动 [{action}] {code} 同步至同花顺云端...")

        # 1. 拉取当前云端列表
        cloud_stocks = self.get_cloud_watchlist(cookie)
        if cloud_stocks is None:
            logger.error(f"[{self.tenant_id}] 同步前拉取云端列表失败，取消本次 sync_to_ths")
            return False

        cloud_list = [(s.get("code", ""), s.get("market_type", "")) for s in cloud_stocks if s.get("code")]
        code_map = {c: mt for c, mt in cloud_list}

        if action == "add":
            if code not in code_map:
                # 默认 market_type 为 "33"（深A）
                code_map[code] = "33"
        elif action == "del":
            code_map.pop(code, None)

        # 2. 构造新列表并 POST
        new_codes = list(code_map.keys())
        new_types = [code_map[c] for c in new_codes]
        selfstock_value = "|".join(new_codes) + "," + "|".join(new_types)

        url = self._THS_V1_BASE_URL + self._THS_V1_MODIFY_PATH
        cookie_dict = self._parse_cookie_dict(cookie)
        userid = cookie_dict.get("userid", "")
        headers = {
            "User-Agent": self._THS_UA,
            "Content-Type": "application/x-www-form-urlencoded",
            "userid": userid,
        }

        # 获取当前版本
        version = self._get_cloud_version(cookie, cookie_dict)

        from urllib.parse import urlencode
        data = urlencode({
            "selfstock": selfstock_value,
            "from": "thspc_hevo",
            "version": version,
            "num": str(len(new_codes)),
        })
        try:
            response = requests.post(url, data=data, headers=headers, cookies=cookie_dict, timeout=10)
            if response.status_code == 200:
                result = response.json()
                if result.get("status_code") == 0:
                    logger.info(f"[{self.tenant_id}] 自选股变动已成功同步至同花顺云端。")
                    return True
                else:
                    logger.error(f"[{self.tenant_id}] 同步至同花顺云端失败: {result.get('status_msg')}")
            else:
                logger.error(f"[{self.tenant_id}] 同步至同花顺接口失败，HTTP 状态码: {response.status_code}")
        except Exception as e:
            logger.error(f"[{self.tenant_id}] 同步至同花顺发生异常: {e}")
        return False

    def _get_cloud_version(self, cookie: str, cookie_dict: Dict[str, str]) -> str:
        """获取当前云端自选股版本号（用于 V1 修改接口）"""
        url = self._THS_V1_BASE_URL + self._THS_V1_QUERY_PATH
        userid = cookie_dict.get("userid", "")
        headers = {"User-Agent": self._THS_UA, "userid": userid}
        params = {"support_all": "0", "from": "thspc_hevo"}
        try:
            response = requests.get(url, headers=headers, params=params, cookies=cookie_dict, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status_code") == 0:
                    return str(data.get("data", {}).get("version", "1"))
        except Exception:
            pass
        return "1"

    def test_connection(self, cookie: str) -> Dict[str, Any]:
        """测试同花顺 Cookie 的连接有效性（使用 V1 API）"""
        url = self._THS_V1_BASE_URL + self._THS_V1_QUERY_PATH
        cookie_dict = self._parse_cookie_dict(cookie)
        userid = cookie_dict.get("userid", "")
        headers = {
            "User-Agent": self._THS_UA,
            "userid": userid,
        }
        params = {"support_all": "0", "from": "thspc_hevo"}
        try:
            response = requests.get(url, headers=headers, params=params, cookies=cookie_dict, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status_code") == 0:
                    raw = data.get("data", {}).get("selfstock", "")
                    stocks = self._parse_selfstock_v1(raw)
                    return {"success": True, "count": len(stocks), "message": f"连接成功，获取到 {len(stocks)} 只自选股"}
                else:
                    return {"success": False, "message": f"同花顺返回错误: {data.get('status_msg')}"}
            else:
                return {"success": False, "message": f"HTTP 请求失败，状态码: {response.status_code}"}
        except Exception as e:
            return {"success": False, "message": f"请求异常: {str(e)}"}

    def perform_sync(self, cookie: str) -> bool:
        """
        执行双向状态化同步算法
        """
        cloud_stocks = self.get_cloud_watchlist(cookie)
        if cloud_stocks is None:
            raise RuntimeError("Failed to fetch cloud watchlist from THS")

        cloud_set = {s.get("code", "").strip() for s in cloud_stocks if s.get("code")}
        cloud_names = {s.get("code", "").strip(): s.get("name", "").strip() for s in cloud_stocks if s.get("code")}
        local_set = self.get_local_watchlist_codes()

        # 1. 首次运行：执行并集对账
        if self.last_synced_watchlist is None:
            logger.info(f"[{self.tenant_id}] 同花顺首次双向对账，合并并集...")
            to_add_to_local = cloud_set - local_set
            to_add_to_cloud = local_set - cloud_set

            if to_add_to_local:
                conn = sqlite3.connect(str(self.db_path))
                cursor = conn.cursor()
                for code in to_add_to_local:
                    name = cloud_names.get(code, "")
                    cursor.execute(
                        "INSERT OR IGNORE INTO Watchlist (code, name) VALUES (?, ?)",
                        (code, name)
                    )
                conn.commit()
                conn.close()
                logger.info(f"[{self.tenant_id}] 首次对账：拉取云端新增自选股到本地: {to_add_to_local}")

            for code in to_add_to_cloud:
                import time
                import random
                time.sleep(random.uniform(0.2, 0.5))
                self.sync_to_ths(cookie, code, action="add")
                logger.info(f"[{self.tenant_id}] 首次对账：推送本地自选股到云端: {code}")

            self.last_synced_watchlist = local_set.union(cloud_set)
            return len(to_add_to_local) > 0 or len(to_add_to_cloud) > 0

        # 2. 后续轮询：状态差分双向同步
        local_added = local_set - self.last_synced_watchlist
        local_deleted = self.last_synced_watchlist - local_set
        cloud_added = cloud_set - self.last_synced_watchlist
        cloud_deleted = self.last_synced_watchlist - cloud_set

        has_changes = False
        conn = None

        # 本地新增 -> 推送云端
        if local_added:
            for code in local_added:
                import time
                import random
                time.sleep(random.uniform(0.2, 0.5))
                if self.sync_to_ths(cookie, code, action="add"):
                    has_changes = True
                    logger.info(f"[{self.tenant_id}] 发现本地新增，同步推送云端: {code}")

        # 本地删除 -> 移出云端
        if local_deleted:
            for code in local_deleted:
                import time
                import random
                time.sleep(random.uniform(0.2, 0.5))
                if self.sync_to_ths(cookie, code, action="del"):
                    has_changes = True
                    logger.info(f"[{self.tenant_id}] 发现本地删除，同步移出云端: {code}")

        # 云端新增 -> 拉取本地
        if cloud_added:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            for code in cloud_added:
                name = cloud_names.get(code, "")
                cursor.execute(
                    "INSERT OR IGNORE INTO Watchlist (code, name) VALUES (?, ?)",
                    (code, name)
                )
                has_changes = True
                logger.info(f"[{self.tenant_id}] 发现云端新增，拉取写入本地: {code} ({name})")
            conn.commit()

        # 云端删除 -> 移出本地
        if cloud_deleted:
            if conn is None:
                conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            for code in cloud_deleted:
                cursor.execute("DELETE FROM Watchlist WHERE code = ?", (code,))
                has_changes = True
                logger.info(f"[{self.tenant_id}] 发现云端删除，同步移出本地: {code}")
            conn.commit()

        if conn:
            conn.close()

        # 重新校准内存中的上次同步集
        self.last_synced_watchlist = self.get_local_watchlist_codes()
        return has_changes


class ThsSyncService:
    """
    同花顺后台实时同步守护单例
    """
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(ThsSyncService, cls).__new__(cls, *args, **kwargs)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._task = None
        self._running = False
        self._managers: Dict[str, ThsSyncManager] = {}
        self._failure_counts: Dict[str, int] = {}

    def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("[ThsSync] 同花顺自选股双向同步守护服务已启动")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("[ThsSync] 同花顺自选股双向同步守护服务已停止")

    @staticmethod
    def _get_sleep_interval() -> int:
        """
        计算下一轮同步的等待秒数：
        - 交易日 9:30-15:00 (CST，UTC+8): 5 分钟
        - 其余时间段（非交易时段、周末）: 30 分钟
        """
        import datetime
        # 中国标准时间 UTC+8
        cst = datetime.timezone(datetime.timedelta(hours=8))
        now = datetime.datetime.now(tz=cst)
        # weekday(): 0=Mon, 4=Fri, 5=Sat, 6=Sun
        if now.weekday() >= 5:
            return 1800  # 周末 30 分钟
        market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
        market_close = now.replace(hour=15, minute=0, second=0, microsecond=0)
        if market_open <= now <= market_close:
            return 300   # 盘中 5 分钟
        return 1800      # 盘前/盘后 30 分钟

    async def _loop(self):
        # Startup delay to let api server spin up and env variables load properly
        await asyncio.sleep(5)
        while self._running:
            try:
                await self._sync_all_tenants()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("[ThsSync] 同花顺同步循环遇到意外异常: %s", e)
            interval = self._get_sleep_interval()
            logger.debug("[ThsSync] 下一轮同步等待 %d 秒", interval)
            await asyncio.sleep(interval)

    async def manual_sync_tenant(self, tenant_id: str) -> dict:
        """手动触发指定租户立即同步，返回同步结果。"""
        from src.config.paths import get_runtime_root
        from src.market.ths_sync import get_ths_cookie
        cookie = get_ths_cookie(tenant_id)
        if not cookie or cookie.strip() in ("", "None"):
            return {"success": False, "message": "未配置同花顺 Cookie，请先在设置页保存"}
        runtime_root = get_runtime_root()
        db_path = runtime_root / f"stocks_{tenant_id}.db"
        if tenant_id not in self._managers:
            self._managers[tenant_id] = ThsSyncManager(tenant_id=tenant_id, db_path=db_path)
        manager = self._managers[tenant_id]
        loop = asyncio.get_running_loop()
        try:
            await loop.run_in_executor(None, manager.perform_sync, cookie)
            self._failure_counts[tenant_id] = 0
            # 获取同步后本地自选数
            import sqlite3
            try:
                conn = sqlite3.connect(str(db_path))
                (count,) = conn.execute("SELECT COUNT(*) FROM Watchlist").fetchone()
                conn.close()
            except Exception:
                count = 0
            return {"success": True, "message": f"同步成功，当前自选股数量：{count} 只"}
        except Exception as e:
            self._failure_counts[tenant_id] = self._failure_counts.get(tenant_id, 0) + 1
            logger.warning(f"[ThsSync] 手动同步租户 {tenant_id} 失败: {e}")
            return {"success": False, "message": f"同步失败: {e}"}

    async def _sync_all_tenants(self):
        from src.config.paths import get_runtime_root
        runtime_root = get_runtime_root()
        db_files = list(runtime_root.glob("stocks_*.db"))

        if not db_files:
            db_files = [runtime_root / "stocks_default.db"]

        loop = asyncio.get_running_loop()
        for db_file in db_files:
            tenant_id = db_file.stem.replace("stocks_", "")
            
            # 连续失败 3 次挂起自愈
            if self._failure_counts.get(tenant_id, 0) >= 3:
                continue

            cookie = get_ths_cookie(tenant_id)
            if not cookie or cookie.strip() in ("", "None"):
                continue

            if tenant_id not in self._managers:
                self._managers[tenant_id] = ThsSyncManager(tenant_id=tenant_id, db_path=db_file)

            manager = self._managers[tenant_id]

            try:
                # 放入 executor 防止 requests 同步请求阻塞 async 环
                await loop.run_in_executor(None, manager.perform_sync, cookie)
                self._failure_counts[tenant_id] = 0
            except Exception as e:
                self._failure_counts[tenant_id] = self._failure_counts.get(tenant_id, 0) + 1
                logger.warning(f"[ThsSync] 同步租户 {tenant_id} 发生失败 ({self._failure_counts[tenant_id]}/3): {e}")
                if self._failure_counts[tenant_id] >= 3:
                    logger.error(f"[ThsSync] 租户 {tenant_id} 同花顺自选同步连续 3 次报错，同步功能挂起。请在设置中更新有效 Cookie。")
