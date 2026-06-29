from __future__ import annotations

import urllib.request
from io import BytesIO
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from src.market.tdx_bridge import (
    TdxGateway,
    TdxConnectionError,
    clean_symbol,
    get_tencent_code,
    probe_server
)


class _FakeQuotes:
    def __init__(self, ip: str, port: int, healthy: bool = True):
        self.ip = ip
        self.port = port
        self.healthy = healthy

    def quotes(self, symbol: list[str]) -> pd.DataFrame:
        if not self.healthy:
            raise RuntimeError("TCP connection timeout")
        
        data = []
        for code in symbol:
            data.append({
                'market': 0,
                'code': code,
                'price': 100.0,
                'last_close': 95.0,
                'open': 96.0,
                'high': 102.0,
                'low': 94.0,
                'vol': 1000,
                'volume': 1000,
                'amount': 95000.0,
                'bid1': 99.0, 'ask1': 100.0, 'bid_vol1': 10, 'ask_vol1': 20,
                'bid2': 98.0, 'ask2': 101.0, 'bid_vol2': 15, 'ask_vol2': 25,
                'bid3': 97.0, 'ask3': 102.0, 'bid_vol3': 20, 'ask_vol3': 30,
                'bid4': 96.0, 'ask4': 103.0, 'bid_vol4': 25, 'ask_vol4': 35,
                'bid5': 95.0, 'ask5': 104.0, 'bid_vol5': 30, 'ask_vol5': 40,
            })
        return pd.DataFrame(data)


@pytest.fixture(autouse=True)
def reset_gateway_singleton():
    """Reset the singleton instance before and after each test."""
    TdxGateway._instance = None
    yield
    TdxGateway._instance = None


def test_symbol_helpers() -> None:
    assert clean_symbol("600519.SH") == "600519"
    assert clean_symbol("SH600519") == "600519"
    assert clean_symbol("000001") == "000001"
    
    assert get_tencent_code("600519.SH") == "sh600519"
    assert get_tencent_code("000001.SZ") == "sz000001"
    assert get_tencent_code("835174.BJ") == "bj835174"


@patch("src.market.tdx_bridge.probe_server")
@patch("src.market.tdx_bridge.Quotes.factory")
def test_gateway_initialization(mock_factory, mock_probe) -> None:
    # Set probe latencies for servers: first three are fastest, others are slow or unreachable
    latencies = {
        ('119.97.185.59', 7709): 10.0,
        ('124.70.133.119', 7709): 20.0,
        ('116.205.183.150', 7709): 30.0,
    }
    mock_probe.side_effect = lambda ip, port, timeout=2.0: latencies.get((ip, port), 200.0)

    # Mock Quotes client creation
    clients = {}
    def fake_factory(market, server):
        ip, port = server
        clients[server] = _FakeQuotes(ip, port)
        return clients[server]
    mock_factory.side_effect = fake_factory

    gateway = TdxGateway()
    gateway.initialize_pool()

    assert len(gateway.active_clients) == 3
    assert gateway.active_clients[0][0] == '119.97.185.59'
    assert gateway.active_clients[1][0] == '124.70.133.119'
    assert gateway.active_clients[2][0] == '116.205.183.150'
    assert not gateway.degraded

    status = gateway.get_status()
    assert status["status"] == "connected"
    assert status["active_connections"] == 3
    assert status["latency_ms"] == 20.0  # Average of 10, 20, 30


@patch("src.market.tdx_bridge.probe_server")
@patch("src.market.tdx_bridge.Quotes.factory")
def test_gateway_rotation(mock_factory, mock_probe) -> None:
    # Setup latencies
    latencies = {
        ('119.97.185.59', 7709): 10.0,
        ('124.70.133.119', 7709): 20.0,
        ('116.205.183.150', 7709): 30.0,
        ('123.60.73.44', 7709): 40.0, # next candidate
    }
    mock_probe.side_effect = lambda ip, port, timeout=2.0: latencies.get((ip, port), float('inf'))

    # Mock Quotes client creation
    clients = {}
    def fake_factory(market, server):
        ip, port = server
        # The first client ('119.97.185.59') will fail heartbeat
        healthy = (ip != '119.97.185.59')
        clients[server] = _FakeQuotes(ip, port, healthy=healthy)
        return clients[server]
    mock_factory.side_effect = fake_factory

    gateway = TdxGateway()
    gateway.initialize_pool()

    assert gateway.active_clients[0][0] == '119.97.185.59'

    # Run check and rotate
    gateway._check_and_rotate()

    # The failed client ('119.97.185.59') should be rotated to '123.60.73.44'
    active_ips = [ip for ip, port, client in gateway.active_clients]
    assert '119.97.185.59' not in active_ips
    assert '123.60.73.44' in active_ips
    assert len(gateway.active_clients) == 3


@patch("src.market.tdx_bridge.probe_server")
@patch("src.market.tdx_bridge.Quotes.factory")
@patch("urllib.request.urlopen")
def test_gateway_quotes_and_fallback(mock_urlopen, mock_factory, mock_probe) -> None:
    # 1. Test successful Tdx quotes fetch
    latencies = {
        ('119.97.185.59', 7709): 10.0,
        ('124.70.133.119', 7709): 20.0,
        ('116.205.183.150', 7709): 30.0,
    }
    mock_probe.side_effect = lambda ip, port, timeout=2.0: latencies.get((ip, port), float('inf'))

    # All connections are healthy
    clients = {}
    mock_factory.side_effect = lambda market, server: _FakeQuotes(server[0], server[1], healthy=True)

    gateway = TdxGateway()
    gateway.initialize_pool()

    res = gateway.get_quotes(["600519.SH", "000001.SZ"])
    assert "600519.SH" in res
    assert "000001.SZ" in res
    assert res["600519.SH"]["price"] == 100.0
    assert res["600519.SH"]["source"] == "tdx"
    assert len(res["600519.SH"]["bid"]) == 5
    assert res["600519.SH"]["bid"][0]["price"] == 99.0

    # 2. Test fallback to Tencent HTTP API when all Tdx clients fail
    # Set all clients to unhealthy
    for ip, port, client in gateway.active_clients:
        client.healthy = False
    
    # Mock Tencent HTTP response
    tencent_data = (
        'v_sh600519="1~贵州茅台~600519~1194.96~1168.63~1169.00~66878~37365~29513~'
        '1194.96~10~1194.90~22~1194.89~1~1194.88~1~1194.87~3~'
        '1194.98~21~1194.99~23~1195.00~31~1195.01~6~1195.02~5~~20260629161429~'
        '26.33~2.25~1215.00~1151.01~1194.96/66878/7949237761~66878~794924~0.53~18.06~~'
        '1215.00~1151.01~5.48~14937.98~14937.98~6.41~1285.49~1051.77~1.29~-58~1188.62~'
        '13.71~18.15~~~0.35~794923.7761~0.0000~0~ ~GP-A~-11.43~-1.52~4.35~30.53~26.78~'
        '1539.98~1151.01~-5.45~-7.94~-14.15~1250081601~1250081601~-50.88~-14.37~1250081601'
        '~~~-11.56~-0.00~~CNY~0~___D__F__N~1194.80~9~";\n'
    )
    
    mock_response = MagicMock()
    mock_response.read.return_value = tencent_data.encode("gbk")
    mock_urlopen.return_value.__enter__.return_value = mock_response

    # get_quotes should raise TdxConnectionError
    with pytest.raises(TdxConnectionError):
        gateway.get_quotes(["600519.SH"])

    # Directly verify the tencent fallback query method works
    res2 = gateway.fetch_tencent_quotes(["600519.SH"])
    assert "600519.SH" in res2
    assert res2["600519.SH"]["price"] == 1194.96
    assert res2["600519.SH"]["source"] == "tencent"
    assert res2["600519.SH"]["name"] == "贵州茅台"
    assert res2["600519.SH"]["bid"][0]["price"] == 1194.96
    assert res2["600519.SH"]["bid"][0]["volume"] == 10
    assert res2["600519.SH"]["ask"][0]["price"] == 1194.98
    assert res2["600519.SH"]["ask"][0]["volume"] == 21


def test_api_endpoints() -> None:
    from fastapi.testclient import TestClient
    import api_server

    client = TestClient(api_server.app)

    mock_gateway = MagicMock()
    mock_gateway.get_quotes.return_value = {
        "600519.SH": {
            "code": "600519",
            "name": "贵州茅台",
            "price": 100.0,
            "last_close": 95.0,
            "open": 96.0,
            "high": 102.0,
            "low": 94.0,
            "change_amt": 5.0,
            "change_pct": 5.26,
            "volume": 1000,
            "amount": 95000.0,
            "bid": [],
            "ask": [],
            "source": "tdx"
        }
    }
    mock_gateway.get_status.return_value = {
        "status": "connected",
        "active_connections": 3,
        "latency_ms": 20.0,
        "pool": []
    }

    with patch("src.market.tdx_bridge.TdxGateway", return_value=mock_gateway):
        # Test GET /api/quote/realtime
        response = client.get("/api/quote/realtime?codes=600519.SH")
        assert response.status_code == 200
        data = response.json()
        assert "600519.SH" in data
        assert data["600519.SH"]["price"] == 100.0
        assert data["600519.SH"]["source"] == "tdx"

        # Test GET /api/quote/realtime/{code}
        response = client.get("/api/quote/realtime/600519.SH")
        assert response.status_code == 200
        data = response.json()
        assert data["price"] == 100.0
        assert data["source"] == "tdx"

        # Test GET /api/quote/gateway/status
        response = client.get("/api/quote/gateway/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "connected"
        assert data["latency_ms"] == 20.0
