"""Unit tests for WeChat channel configurations, adapter, and webhook routing."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import api_server
from src.platforms.base import IncomingMessage
from src.platforms.wechat import WechatAdapter


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    # Setup mock channels JSON file path
    mock_json_path = tmp_path / "wechat_channels.json"
    monkeypatch.setattr(api_server, "_get_wechat_channels_json_path", lambda: mock_json_path)
    
    # Mock platform manager reload to avoid starting actual background tasks
    mock_reload = AsyncMock()
    monkeypatch.setattr(api_server, "_reload_platform_manager", mock_reload)
    
    monkeypatch.delenv("API_AUTH_KEY", raising=False)
    
    return TestClient(api_server.app, client=("127.0.0.1", 50000))


def test_wechat_crud_endpoints(client: TestClient) -> None:
    # 1. List channels (should be empty initially)
    res = client.get("/settings/platforms/wechat/channels")
    assert res.status_code == 200
    assert res.json() == []
    
    # 2. Create channel (WeCom)
    res = client.post(
        "/settings/platforms/wechat/channels",
        json={
            "name": "WeCom Test",
            "mode": "wecom",
            "wecom_webhook": "https://qyapi.weixin.qq.com/...webhook",
            "wecom_corpid": "wwcorp123",
            "wecom_secret": "mysecret",
            "wecom_agentid": "10002",
            "enabled": True
        }
    )
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "WeCom Test"
    assert body["mode"] == "wecom"
    assert body["wecom_secret_configured"] is True
    chan_id = body["id"]
    
    # 3. Create channel (iLink)
    res = client.post(
        "/settings/platforms/wechat/channels",
        json={
            "name": "iLink Test",
            "mode": "ilink",
            "enabled": True
        }
    )
    assert res.status_code == 200
    body_ilink = res.json()
    assert body_ilink["name"] == "iLink Test"
    assert body_ilink["mode"] == "ilink"
    assert body_ilink["ilink_bot_token"] == ""
    chan_id_ilink = body_ilink["id"]
    
    # 4. List channels again (should have 2 channels)
    res = client.get("/settings/platforms/wechat/channels")
    assert res.status_code == 200
    channels = res.json()
    assert len(channels) == 2
    
    # 5. Update channel
    res = client.put(
        f"/settings/platforms/wechat/channels/{chan_id}",
        json={
            "name": "WeCom Updated",
            "mode": "wecom",
            "wecom_webhook": "https://qyapi.weixin.qq.com/...webhook2",
            "wecom_corpid": "wwcorp123",
            "wecom_agentid": "10002",
            "enabled": False
        }
    )
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "WeCom Updated"
    assert body["enabled"] is False
    assert body["wecom_secret_configured"] is True
    
    # 6. Delete channel
    res = client.delete(f"/settings/platforms/wechat/channels/{chan_id}")
    assert res.status_code == 200
    assert res.json() == {"status": "success"}
    
    # Clean up iLink channel
    res = client.delete(f"/settings/platforms/wechat/channels/{chan_id_ilink}")
    assert res.status_code == 200


def test_wechat_ilink_auth_flow(client: TestClient) -> None:
    # 1. Create iLink channel
    res = client.post(
        "/settings/platforms/wechat/channels",
        json={
            "name": "iLink Auth Test",
            "mode": "ilink",
            "ilink_bot_token": "test-mock-token",
            "enabled": True
        }
    )
    assert res.status_code == 200
    chan_id = res.json()["id"]
    
    # Mock official QR code fetch response
    mock_qr_response = MagicMock()
    mock_qr_response.status_code = 200
    mock_qr_response.json.return_value = {
        "qrcode": "mock_qrcode_token",
        "qrcode_img_content": "https://qr.weixin.qq.com/mock_img"
    }
    
    # 2. Get QR Code
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_qr_response
        res = client.get(f"/settings/platforms/wechat/channels/{chan_id}/qrcode")
        assert res.status_code == 200
        assert "create-qr-code" in res.json()["qrcode"]
        assert "mock_img" in res.json()["qrcode"]
        mock_post.assert_called_once()
        
    # Mock official status response (confirmed)
    mock_status_response = MagicMock()
    mock_status_response.status_code = 200
    mock_status_response.json.return_value = {
        "status": "confirmed",
        "bot_token": "my_bearer_token",
        "baseurl": "https://sgapi.ilinkai.weixin.qq.com",
        "ilink_bot_id": "bot_id_123@im.bot",
        "ilink_user_id": "user_id_456@im.wechat"
    }
    
    # 3. Poll Status
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_status_response
        res = client.get(f"/settings/platforms/wechat/channels/{chan_id}/status")
        assert res.status_code == 200
        assert res.json() == {"status": "logged_in"}
        mock_get.assert_called_once()
        
    # 4. Verify updated channel fields
    res = client.get("/settings/platforms/wechat/channels")
    channels = res.json()
    assert len(channels) == 1
    assert channels[0]["ilink_bot_token"] == "my_bearer_token"
    assert channels[0]["ilink_base_url"] == "https://sgapi.ilinkai.weixin.qq.com"
    assert channels[0]["ilink_bot_id"] == "bot_id_123@im.bot"
    assert channels[0]["ilink_user_id"] == "user_id_456@im.wechat"


@pytest.mark.anyio
async def test_wechat_adapter_message_sending():
    # Test WechatAdapter direct message sending logic (WeCom Webhook)
    adapter = WechatAdapter(
        channel_id="chan_test",
        name="Test WeChat",
        mode="wecom",
        wecom_webhook="https://mockwebhook.local/key"
    )
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()
    
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        msg_id = await adapter.send_message(chat_id="user123", content="Hello", title="Alert")
        assert msg_id == "wecom_webhook_msg_200"
        mock_post.assert_called_once()
        
    # Test iLink sending mode
    adapter_il = WechatAdapter(
        channel_id="chan_test",
        name="Test WeChat",
        mode="ilink",
        ilink_bot_token="my_token",
        ilink_base_url="https://base.ilink.local"
    )
    
    mock_response_il = MagicMock()
    mock_response_il.status_code = 200
    mock_response_il.raise_for_status = MagicMock()
    
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response_il
        msg_id = await adapter_il.send_message(chat_id="user123", content="Hello")
        assert msg_id.startswith("ilink_msg_")
        mock_post.assert_called_once()





@pytest.mark.anyio
async def test_wechat_commands_not_initialized(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from src.platforms.manager import PlatformManager
    
    # Setup PlatformManager with a mock adapter
    mock_session_service = MagicMock()
    pm = PlatformManager(mock_session_service, tenant_id="test_tenant")
    
    mock_adapter = AsyncMock()
    mock_adapter.tenant_id = "test_tenant"
    mock_adapter.platform_name = "wechat_test_tenant_chan1"
    pm.register_adapter(mock_adapter)
    
    # Mock runtime root to tmp_path
    monkeypatch.setattr("src.config.paths.get_runtime_root", lambda: tmp_path)
    
    # Send /position command
    incoming = IncomingMessage(
        platform="wechat_test_tenant_chan1",
        chat_id="wx_user_1",
        message_id="msg_01",
        content="/position",
        sender_id="wx_user_1",
        timestamp=1625000000.0
    )
    
    await pm.handle_incoming_message(incoming)
    mock_adapter.send_message.assert_called_once()
    args, kwargs = mock_adapter.send_message.call_args
    assert "模拟账户尚未初始化" in kwargs["content"]


@pytest.mark.anyio
async def test_wechat_commands_position_success(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from src.platforms.manager import PlatformManager
    import sqlite3
    
    mock_session_service = MagicMock()
    pm = PlatformManager(mock_session_service, tenant_id="test_tenant")
    
    mock_adapter = AsyncMock()
    mock_adapter.tenant_id = "test_tenant"
    mock_adapter.platform_name = "wechat_test_tenant_chan1"
    pm.register_adapter(mock_adapter)
    
    monkeypatch.setattr("src.config.paths.get_runtime_root", lambda: tmp_path)
    
    # Setup mock sqlite database
    db_path = tmp_path / "stocks_test_tenant.db"
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute("CREATE TABLE PaperTradingAccount (tenant_id TEXT, cash REAL, market_value REAL, locked_cash REAL, initial_cash REAL)")
        conn.execute("CREATE TABLE PaperHoldings (tenant_id TEXT, symbol TEXT, total_quantity INTEGER, available_quantity INTEGER, cost_price REAL)")
        conn.execute("INSERT INTO PaperTradingAccount VALUES ('test_tenant', 50000.0, 30000.0, 0.0, 100000.0)")
        conn.execute("INSERT INTO PaperHoldings VALUES ('test_tenant', 'SH600519', 100, 100, 1800.0)")
        conn.commit()
        
    incoming = IncomingMessage(
        platform="wechat_test_tenant_chan1",
        chat_id="wx_user_1",
        message_id="msg_01",
        content="持仓",
        sender_id="wx_user_1",
        timestamp=1625000000.0
    )
    
    await pm.handle_incoming_message(incoming)
    mock_adapter.send_message.assert_called_once()
    args, kwargs = mock_adapter.send_message.call_args
    content = kwargs["content"]
    assert "模拟账户持仓" in content
    assert "50,000.00" in content
    assert "SH600519" in content


@pytest.mark.anyio
async def test_wechat_commands_metrics_success(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from src.platforms.manager import PlatformManager
    import sqlite3
    
    mock_session_service = MagicMock()
    pm = PlatformManager(mock_session_service, tenant_id="test_tenant")
    
    mock_adapter = AsyncMock()
    mock_adapter.tenant_id = "test_tenant"
    mock_adapter.platform_name = "wechat_test_tenant_chan1"
    pm.register_adapter(mock_adapter)
    
    monkeypatch.setattr("src.config.paths.get_runtime_root", lambda: tmp_path)
    
    # Setup mock sqlite database
    db_path = tmp_path / "stocks_test_tenant.db"
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute("CREATE TABLE PerformanceMetrics (tenant_id TEXT, timestamp INTEGER, equity REAL, realized_pnl REAL, win_rate REAL, max_drawdown REAL)")
        conn.execute("INSERT INTO PerformanceMetrics VALUES ('test_tenant', 1625000000, 120000.0, 20000.0, 75.5, 5.2)")
        conn.commit()
        
    incoming = IncomingMessage(
        platform="wechat_test_tenant_chan1",
        chat_id="wx_user_1",
        message_id="msg_01",
        content="胜率",
        sender_id="wx_user_1",
        timestamp=1625000000.0
    )
    
    await pm.handle_incoming_message(incoming)
    mock_adapter.send_message.assert_called_once()
    args, kwargs = mock_adapter.send_message.call_args
    content = kwargs["content"]
    assert "模拟盘战绩报告" in content
    assert "120,000.00" in content
    assert "75.50%" in content
    assert "5.20%" in content


def test_wechat_transient_auth_flow(client: TestClient) -> None:
    # 1. Get transient QR Code
    mock_qr_response = MagicMock()
    mock_qr_response.status_code = 200
    mock_qr_response.json.return_value = {
        "qrcode": "mock_qrcode_token_transient",
        "qrcode_img_content": "https://qr.weixin.qq.com/mock_img_transient"
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_qr_response
        res = client.get("/settings/platforms/wechat/transient/qrcode?mode=ilink")
        assert res.status_code == 200
        data = res.json()
        assert "create-qr-code" in data["qrcode"]
        assert "mock_img_transient" in data["qrcode"]
        temp_id = data["temp_id"]
        mock_post.assert_called_once()

    # 2. Mock transient status response (confirmed)
    mock_status_response = MagicMock()
    mock_status_response.status_code = 200
    mock_status_response.json.return_value = {
        "status": "confirmed",
        "bot_token": "transient_bearer_token",
        "baseurl": "https://sgapi.ilinkai.weixin.qq.com",
        "ilink_bot_id": "bot_id_transient@im.bot",
        "ilink_user_id": "user_id_transient@im.wechat"
    }

    # 3. Poll Status
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_status_response
        res = client.get(f"/settings/platforms/wechat/transient/status?temp_id={temp_id}")
        assert res.status_code == 200
        assert res.json() == {
            "status": "success",
            "bot_token": "transient_bearer_token",
            "baseurl": "https://sgapi.ilinkai.weixin.qq.com",
            "ilink_bot_id": "bot_id_transient@im.bot",
            "ilink_user_id": "user_id_transient@im.wechat"
        }
        mock_get.assert_called_once()




