"""Tests for Xueqiu monitoring API endpoints."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

import api_server


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    # Mock data directory so we do not pollute the user's home folder ~/.vibe-trading-cnx
    monkeypatch.setattr("src.config.paths.get_data_dir", lambda *args, **kwargs: tmp_path)
    monkeypatch.delenv("API_AUTH_KEY", raising=False)
    return TestClient(api_server.app, client=("127.0.0.1", 50000))


def test_get_xueqiu_settings_default(client: TestClient) -> None:
    response = client.get("/settings/xueqiu")
    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is False
    assert body["feishu_webhook"] == ""
    assert body["combos"] == {}
    assert body["xq_tokens"] == []


def test_update_xueqiu_settings(client: TestClient, tmp_path: Path) -> None:
    payload = {
        "enabled": True,
        "feishu_webhook": "https://open.feishu.cn/hook/123",
        "combos": {"TestCombo": "ZH123456"},
        "xq_tokens": ["token1", "token2"]
    }
    response = client.put("/settings/xueqiu", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is True
    assert body["feishu_webhook"] == "https://open.feishu.cn/hook/123"
    assert body["combos"] == {"TestCombo": "ZH123456"}
    assert body["xq_tokens"] == ["token1", "token2"]

    # Verify file content written to tmp_path
    config_file = tmp_path / "xueqiu_monitor.json"
    assert config_file.exists()
    import json
    saved_data = json.loads(config_file.read_text(encoding="utf-8"))
    assert saved_data["enabled"] is True
    assert saved_data["feishu_webhook"] == "https://open.feishu.cn/hook/123"


@patch("requests.post")
def test_test_xueqiu_webhook_success(mock_post: MagicMock, client: TestClient) -> None:
    # Mock requests.post to return a successful status code
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_post.return_value = mock_response

    payload = {"webhook_url": "https://open.feishu.cn/hook/123"}
    response = client.post("/settings/xueqiu/test", json=payload)
    assert response.status_code == 200
    assert response.json() == {"status": "success"}

    mock_post.assert_called_once()
    args, kwargs = mock_post.call_args
    assert args[0] == "https://open.feishu.cn/hook/123"
    assert kwargs["headers"] == {"Content-Type": "application/json"}
    assert "msg_type" in kwargs["json"]


@patch("requests.post")
def test_test_xueqiu_webhook_failure(mock_post: MagicMock, client: TestClient) -> None:
    # Mock requests.post to return a failed status code
    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_post.return_value = mock_response

    payload = {"webhook_url": "https://open.feishu.cn/hook/123"}
    response = client.post("/settings/xueqiu/test", json=payload)
    assert response.status_code == 400
    assert "Failed to deliver test card" in response.json()["detail"]


def test_get_xueqiu_logs_empty(client: TestClient) -> None:
    response = client.get("/settings/xueqiu/logs")
    assert response.status_code == 200
    assert response.json() == []


def test_qrcode_flow(client: TestClient) -> None:
    # 1. Get QR code
    res_qr = client.get("/settings/xueqiu/qrcode")
    assert res_qr.status_code == 200
    qr_data = res_qr.json()
    qrcode_id = qr_data["qrcode_id"]
    assert qrcode_id is not None
    assert "xueqiu/auth?id=" in qr_data["auth_url"]

    # 2. Check initial status (should be waiting)
    res_status = client.get(f"/settings/xueqiu/qrcode/status?id={qrcode_id}")
    assert res_status.status_code == 200
    assert res_status.json() == {"status": "waiting"}

    # 3. Simulate scan event
    res_scan = client.post(f"/settings/xueqiu/qrcode/scan?id={qrcode_id}")
    assert res_scan.status_code == 200
    assert res_scan.json() == {"status": "success"}

    # 4. Check status after scan (should be scanned)
    res_status2 = client.get(f"/settings/xueqiu/qrcode/status?id={qrcode_id}")
    assert res_status2.status_code == 200
    assert res_status2.json() == {"status": "scanned"}

    # 5. Confirm authorization with a token
    confirm_payload = {"qrcode_id": qrcode_id, "token": "test-qr-token-123"}
    res_confirm = client.post("/settings/xueqiu/qrcode/confirm", json=confirm_payload)
    assert res_confirm.status_code == 200
    assert res_confirm.json() == {"status": "success"}

    # 6. Check status again, it should return confirmed and the token
    res_status3 = client.get(f"/settings/xueqiu/qrcode/status?id={qrcode_id}")
    assert res_status3.status_code == 200
    assert res_status3.json() == {"status": "confirmed", "token": "test-qr-token-123"}

    # 7. Verify the token was automatically injected into the settings
    res_settings = client.get("/settings/xueqiu")
    assert res_settings.status_code == 200
    assert "test-qr-token-123" in res_settings.json()["xq_tokens"]


def test_inject_token_success(client: TestClient) -> None:
    response = client.get("/settings/xueqiu/inject?token=injected-bookmarklet-token")
    assert response.status_code == 200
    assert response.json() == {"status": "success"}
    
    res_settings = client.get("/settings/xueqiu")
    assert res_settings.status_code == 200
    assert "injected-bookmarklet-token" in res_settings.json()["xq_tokens"]


