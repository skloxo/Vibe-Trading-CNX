"""Tongdaxin L1 realtime market quote gateway with latency-based TCP connection pooling,

heartbeat monitoring, automatic server rotation, and graceful fallback to Tencent HTTP API.
"""

from __future__ import annotations

import logging
import socket
import threading
import time
import urllib.request
from typing import Dict, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

from mootdx.quotes import Quotes

logger = logging.getLogger(__name__)

# List of official Tongdaxin public TCP servers
_TDX_SERVERS = [
    ('119.97.185.59', 7709),
    ('124.70.133.119', 7709),
    ('116.205.183.150', 7709),
    ('123.60.73.44', 7709),
    ('116.205.163.254', 7709),
    ('121.36.225.169', 7709),
    ('123.60.70.228', 7709),
    ('124.71.9.153', 7709),
    ('110.41.147.114', 7709),
    ('124.71.187.122', 7709),
]


class TdxConnectionError(Exception):
    """Raised when Tongdaxin TCP connections fail and cannot recover."""
    pass


def probe_server(ip: str, port: int, timeout: float = 2.0) -> float:
    """TCP handshake probe to measure round-trip time (RTT) in milliseconds."""
    start = time.perf_counter()
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return (time.perf_counter() - start) * 1000.0
    except Exception:
        return float('inf')


def clean_symbol(symbol: str) -> str:
    """Extract pure 6-digit stock code from original symbol string."""
    symbol = symbol.upper().strip()
    if symbol.startswith(("SH", "SZ", "BJ")):
        symbol = symbol[2:]
    if "." in symbol:
        symbol = symbol.split(".")[0]
    return "".join(c for c in symbol if c.isdigit())


def get_tencent_code(symbol: str) -> str:
    """Return Tencent HTTP API compatible symbol code (e.g. sh600519)."""
    code = clean_symbol(symbol)
    if code.startswith(("6", "9")):
        return f"sh{code}"
    elif code.startswith(("8", "4")):
        return f"bj{code}"
    else:
        return f"sz{code}"


class TdxGateway:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(TdxGateway, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return
        self._initialized = True
        self.lock = threading.Lock()
        self.active_clients: List[Tuple[str, int, Quotes]] = []
        self.servers_rtt: List[Tuple[str, int, float]] = []
        self.running = False
        self.heartbeat_thread: Optional[threading.Thread] = None
        self.degraded = False

    def initialize_pool(self) -> None:
        """Probe all TDX servers, sort by latency, and establish the top 3 connections."""
        logger.info("Initializing TdxGateway connection pool...")
        probed = []
        
        with ThreadPoolExecutor(max_workers=len(_TDX_SERVERS)) as executor:
            future_to_server = {
                executor.submit(probe_server, ip, port): (ip, port)
                for ip, port in _TDX_SERVERS
            }
            for future in as_completed(future_to_server):
                ip, port = future_to_server[future]
                try:
                    rtt = future.result()
                    probed.append((ip, port, rtt))
                except Exception as e:
                    logger.warning("Error probing %s:%d: %s", ip, port, e)
                    probed.append((ip, port, float('inf')))

        probed.sort(key=lambda x: x[2])
        self.servers_rtt = probed

        valid_servers = [s for s in probed if s[2] < float('inf')]
        
        with self.lock:
            self.active_clients = []
            to_connect = valid_servers[:3]
            for ip, port, rtt in to_connect:
                try:
                    client = Quotes.factory(market='std', server=(ip, port))
                    self.active_clients.append((ip, port, client))
                    logger.info("Connected to TDX server %s:%d with RTT %.1fms", ip, port, rtt)
                except Exception as e:
                    logger.error("Failed to connect to TDX server %s:%d: %s", ip, port, e)
            
            if not self.active_clients:
                self.degraded = True
                logger.error("No TDX servers could be connected. Degraded mode active.")
            else:
                self.degraded = False
                logger.info("TdxGateway initialized with %d connections.", len(self.active_clients))

    def start(self) -> None:
        """Start the gateway and launch the background heartbeat保活 thread."""
        with self.lock:
            if self.running:
                return
            self.running = True
        
        self.initialize_pool()
        self.heartbeat_thread = threading.Thread(
            target=self._heartbeat_loop,
            daemon=True,
            name="tdx-gateway-heartbeat"
        )
        self.heartbeat_thread.start()
        logger.info("TdxGateway heartbeat thread started.")

    def stop(self) -> None:
        """Stop the heartbeat loop and release connections."""
        with self.lock:
            self.running = False
            self.active_clients = []
        logger.info("TdxGateway stopped.")

    def _heartbeat_loop(self) -> None:
        while self.running:
            # Sleep 30s but check running flag frequently
            for _ in range(30):
                if not self.running:
                    return
                time.sleep(1)
            try:
                self._check_and_rotate()
            except Exception as e:
                logger.error("Error in TdxGateway heartbeat: %s", e)

    def _check_and_rotate(self) -> None:
        """Heartbeat check for all active connections. Replaces dead ones using rotation."""
        to_replace = []
        with self.lock:
            for idx, (ip, port, client) in enumerate(self.active_clients):
                healthy = False
                try:
                    df = client.quotes(symbol=['000001'])
                    if df is not None and not df.empty:
                        healthy = True
                except Exception as e:
                    logger.warning("Active client %s:%d failed heartbeat check: %s", ip, port, e)
                
                if not healthy:
                    to_replace.append(idx)
            
            if not to_replace:
                return

            used = {(ip, port) for ip, port, _ in self.active_clients}
            candidates = [
                s for s in self.servers_rtt
                if s[2] < float('inf') and (s[0], s[1]) not in used
            ]

            for idx in to_replace:
                old_ip, old_port, _ = self.active_clients[idx]
                logger.info("Rotating failed connection %s:%d...", old_ip, old_port)
                
                replaced = False
                while candidates:
                    ip, port, rtt = candidates.pop(0)
                    try:
                        client = Quotes.factory(market='std', server=(ip, port))
                        self.active_clients[idx] = (ip, port, client)
                        logger.info("Rotated successfully to %s:%d (RTT %.1fms)", ip, port, rtt)
                        replaced = True
                        break
                    except Exception as e:
                        logger.warning("Failed to connect to candidate %s:%d: %s", ip, port, e)
                
                if not replaced:
                    logger.error("Could not find replacement for %s:%d", old_ip, old_port)

            # Keep only verified functional clients
            verified = []
            for ip, port, client in self.active_clients:
                try:
                    df = client.quotes(symbol=['000001'])
                    if df is not None and not df.empty:
                        verified.append((ip, port, client))
                except Exception:
                    pass
            self.active_clients = verified

            if not self.active_clients:
                self.degraded = True
                logger.error("All TDX servers failed. Degraded to Tencent HTTP fallback.")
            else:
                self.degraded = False

    def get_quotes(self, symbols: List[str]) -> Dict[str, dict]:
        """Fetch quotes for A-share symbols. If TDX fails, raises TdxConnectionError."""
        if not symbols:
            return {}

        clean_to_orig = {}
        for s in symbols:
            clean = clean_symbol(s)
            if clean:
                clean_to_orig[clean] = s

        clean_codes = list(clean_to_orig.keys())
        if not clean_codes:
            return {}

        if self.degraded:
            raise TdxConnectionError("TdxGateway is currently degraded.")

        result_df = None
        with self.lock:
            clients = list(self.active_clients)
        
        for ip, port, client in clients:
            try:
                df = client.quotes(symbol=clean_codes)
                if df is not None and not df.empty:
                    result_df = df
                    break
            except Exception as e:
                logger.warning("Query quotes failed on Tdx server %s:%d: %s", ip, port, e)

        if result_df is None:
            # Trigger a check and rotation in a background thread
            threading.Thread(target=self._check_and_rotate, daemon=True).start()
            self.degraded = True
            raise TdxConnectionError("All TDX clients failed quotes call.")

        return self._parse_tdx_df(result_df, clean_to_orig)

    def _parse_tdx_df(self, df, clean_to_orig: Dict[str, str]) -> Dict[str, dict]:
        result = {}
        for _, row in df.iterrows():
            code = str(row.get('code', ''))
            orig = clean_to_orig.get(code)
            if not orig:
                continue

            price = float(row.get('price', 0))
            last_close = float(row.get('last_close', 0))
            open_val = float(row.get('open', 0))
            high = float(row.get('high', 0))
            low = float(row.get('low', 0))
            vol = int(row.get('volume', row.get('vol', 0)))
            amount = float(row.get('amount', 0))

            change_amt = price - last_close
            change_pct = (change_amt / last_close * 100.0) if last_close else 0.0

            bid = []
            ask = []
            for i in range(1, 6):
                bid.append({
                    "price": float(row.get(f"bid{i}", 0)),
                    "volume": int(row.get(f"bid_vol{i}", 0))
                })
                # Mootdx ask_vol1 uses name 'ask_vol1' in columns list
                vol_col = f"ask_vol{i}"
                ask.append({
                    "price": float(row.get(f"ask{i}", 0)),
                    "volume": int(row.get(vol_col, 0))
                })

            result[orig] = {
                "code": code,
                "name": "",
                "price": price,
                "last_close": last_close,
                "open": open_val,
                "high": high,
                "low": low,
                "change_amt": round(change_amt, 4),
                "change_pct": round(change_pct, 2),
                "volume": vol,
                "amount": amount,
                "bid": bid,
                "ask": ask,
                "source": "tdx"
            }
        return result

    def fetch_tencent_quotes(self, symbols: List[str]) -> Dict[str, dict]:
        prefixed = [get_tencent_code(s) for s in symbols]
        url = "https://qt.gtimg.cn/q=" + ",".join(prefixed)
        
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = resp.read().decode("gbk")
        except Exception as e:
            logger.error("Failed to fetch quotes from Tencent API: %s", e)
            return {}

        result = {}
        for line in data.strip().split(";"):
            if not line.strip() or "=" not in line or '"' not in line:
                continue
            try:
                key = line.split("=")[0].split("_")[-1]
                code_only = key[2:]
                orig = None
                for s in symbols:
                    if clean_symbol(s) == code_only:
                        orig = s
                        break
                if not orig:
                    continue

                vals = line.split('"')[1].split("~")
                if len(vals) < 30:
                    continue

                price = float(vals[3]) if vals[3] else 0.0
                last_close = float(vals[4]) if vals[4] else 0.0
                open_val = float(vals[5]) if vals[5] else 0.0
                high = float(vals[33]) if vals[33] else 0.0
                low = float(vals[34]) if vals[34] else 0.0
                volume = int(vals[6]) if vals[6] else 0
                amount = float(vals[37]) * 10000.0 if vals[37] else 0.0
                name = vals[1]

                change_amt = float(vals[31]) if vals[31] else 0.0
                change_pct = float(vals[32]) if vals[32] else 0.0

                bid = []
                for i in range(5):
                    p_idx = 9 + i * 2
                    v_idx = 10 + i * 2
                    bid.append({
                        "price": float(vals[p_idx]) if vals[p_idx] else 0.0,
                        "volume": int(vals[v_idx]) if vals[v_idx] else 0
                    })
                
                ask = []
                for i in range(5):
                    p_idx = 19 + i * 2
                    v_idx = 20 + i * 2
                    ask.append({
                        "price": float(vals[p_idx]) if vals[p_idx] else 0.0,
                        "volume": int(vals[v_idx]) if vals[v_idx] else 0
                    })

                result[orig] = {
                    "code": code_only,
                    "name": name,
                    "price": price,
                    "last_close": last_close,
                    "open": open_val,
                    "high": high,
                    "low": low,
                    "change_amt": round(change_amt, 4),
                    "change_pct": round(change_pct, 2),
                    "volume": volume,
                    "amount": amount,
                    "bid": bid,
                    "ask": ask,
                    "source": "tencent"
                }
            except Exception as e:
                logger.warning("Error parsing Tencent line: %s. Error: %s", line, e)
                continue
        
        return result

    def get_status(self) -> dict:
        """Get status of the TDX gateway connection pool."""
        with self.lock:
            pool_servers = []
            for ip, port, _ in self.active_clients:
                latency = next(
                    (rtt for s_ip, s_port, rtt in self.servers_rtt if s_ip == ip and s_port == port),
                    999.0
                )
                pool_servers.append({
                    "ip": ip,
                    "port": port,
                    "latency_ms": round(latency, 1) if latency != float('inf') else 999.0,
                    "status": "active"
                })
            
            active_rtts = [s["latency_ms"] for s in pool_servers if s["latency_ms"] < 999.0]
            avg_latency = sum(active_rtts) / len(active_rtts) if active_rtts else 0.0

            return {
                "status": "degraded" if self.degraded else ("connected" if self.active_clients else "disconnected"),
                "active_connections": len(self.active_clients),
                "latency_ms": round(avg_latency, 1),
                "pool": pool_servers
            }
