import os
import sqlite3
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

import api_server
from src.market.ths_sync import ThsSyncManager, ThsSyncService, get_ths_cookie

@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    env_example = tmp_path / ".env.example"
    env_path = tmp_path / ".env"
    env_example.write_text(
        "\n".join([
            "TUSHARE_TOKEN=your-tushare-token",
            "THS_COOKIE=your-ths-cookie",
        ]) + "\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(api_server, "ENV_PATH", env_path)
    monkeypatch.setattr(api_server, "ENV_EXAMPLE_PATH", env_example)
    monkeypatch.setattr(api_server, "_baostock_supported", lambda: False)
    monkeypatch.setattr(api_server, "_baostock_installed", lambda: False)
    monkeypatch.delenv("API_AUTH_KEY", raising=False)
    return TestClient(api_server.app, client=("127.0.0.1", 50000))


def test_get_data_sources_returns_ths_cookie_status(client: TestClient) -> None:
    response = client.get("/settings/data-sources")
    assert response.status_code == 200
    body = response.json()
    assert "ths_cookie_configured" in body
    assert body["ths_cookie_configured"] is False
    assert body["ths_cookie_hint"] is None


def test_update_data_sources_persists_ths_cookie(client: TestClient, tmp_path: Path) -> None:
    # Update cookie
    response = client.put(
        "/settings/data-sources",
        json={
            "ths_cookie": "my-secret-ths-cookie",
        }
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ths_cookie_configured"] is True
    
    # Verify file content
    env_content = (tmp_path / ".env").read_text(encoding="utf-8")
    assert "THS_COOKIE=my-secret-ths-cookie" in env_content
    assert os.environ.get("THS_COOKIE") == "my-secret-ths-cookie"

    # Clear cookie
    response = client.put(
        "/settings/data-sources",
        json={
            "clear_ths_cookie": True,
        }
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ths_cookie_configured"] is False
    assert os.environ.get("THS_COOKIE") is None


def test_ths_cookie_connection_testing(client: TestClient) -> None:
    with patch("requests.get") as mock_get:
        # Success response mock
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_ok = lambda: {"error_code": 0, "result": {"list": [{"code": "600519", "name": "贵州茅台"}]}}
        mock_response.json.return_value = {"error_code": 0, "result": {"list": [{"code": "600519", "name": "贵州茅台"}]}}
        mock_get.return_value = mock_response

        response = client.post("/settings/ths/test", json={"cookie": "test-cookie"})
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["count"] == 1


def test_ths_sync_manager_diff_sync(tmp_path: Path) -> None:
    db_path = tmp_path / "stocks_default.db"
    manager = ThsSyncManager(tenant_id="default", db_path=db_path)

    # Verify tables created
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Watchlist'")
    assert cursor.fetchone() is not None
    conn.close()

    # Prepopulate local watchlist
    manager.add_to_local("000001", "平安银行")

    # Mock cloud watchlist fetching
    cloud_list = [
        {"code": "600519", "name": "贵州茅台"}, # Exists only in cloud
        {"code": "000001", "name": "平安银行"}, # Exists in both
    ]
    
    with patch.object(manager, "get_cloud_watchlist", return_value=cloud_list) as mock_get_cloud, \
         patch.object(manager, "sync_to_ths", return_value=True) as mock_sync_to:
        
        # First sync: union merge
        has_changes = manager.perform_sync("dummy-cookie")
        assert has_changes is True
        
        # Verify茅台 (600519) added to local
        local_codes = manager.get_local_watchlist_codes()
        assert "600519" in local_codes
        assert "000001" in local_codes

        # Verify平安银行 (000001) pushed to cloud during initial merge?
        # No,平安银行 was in both so it was not pushed.
        
        # Subsequent sync: no changes
        mock_get_cloud.return_value = [
            {"code": "600519", "name": "贵州茅台"},
            {"code": "000001", "name": "平安银行"},
        ]
        has_changes = manager.perform_sync("dummy-cookie")
        assert has_changes is False

        # Add locally -> Push to cloud
        manager.add_to_local("300750", "宁德时代")
        has_changes = manager.perform_sync("dummy-cookie")
        assert has_changes is True
        mock_sync_to.assert_any_call("dummy-cookie", "300750", action="add")

        # Delete from cloud -> Remove locally
        mock_get_cloud.return_value = [
            {"code": "600519", "name": "贵州茅台"},
            {"code": "300750", "name": "宁德时代"},
        ]
        has_changes = manager.perform_sync("dummy-cookie")
        assert has_changes is True
        assert "000001" not in manager.get_local_watchlist_codes()
