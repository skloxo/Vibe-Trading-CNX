"""Tests for service monitor endpoints and public tenant config separation."""

from __future__ import annotations

import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

import api_server


def _remote_client() -> TestClient:
    """Return a TestClient that simulates a non-loopback caller."""
    return TestClient(api_server.app, client=("203.0.113.10", 50000))


def _local_client() -> TestClient:
    """Return a TestClient that simulates a loopback caller."""
    return TestClient(api_server.app, client=("127.0.0.1", 50000))


@pytest.fixture(autouse=True)
def setup_test_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Initialize test folders, env path, and clear API keys."""
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    
    # Mock admin .env in home
    admin_dir = tmp_path / ".vibe-trading-cnx"
    admin_dir.mkdir(parents=True, exist_ok=True)
    admin_env = admin_dir / ".env"
    admin_env.write_text(
        "LANGCHAIN_PROVIDER=openai\n"
        "OPENAI_API_KEY=sk-admin-key-12345\n"
        "TUSHARE_TOKEN=tushare-global-token\n",
        encoding="utf-8"
    )
    monkeypatch.setattr(api_server, "AGENT_DIR", tmp_path)
    
    # Mock runs and sessions directories
    runs_dir = tmp_path / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    (runs_dir / "run_1").mkdir()
    (runs_dir / "run_2").mkdir()
    
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    (sessions_dir / "session_1").mkdir()
    
    monkeypatch.setattr(api_server, "RUNS_DIR", runs_dir)
    monkeypatch.setattr(api_server, "SESSIONS_DIR", sessions_dir)
    
    monkeypatch.delenv("API_AUTH_KEY", raising=False)
    monkeypatch.setattr(api_server, "_API_KEY", "")


def test_monitor_stats_logs_requires_admin_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    # 1. Set API_AUTH_KEY to require authentication
    monkeypatch.setenv("API_AUTH_KEY", "admin_secret")
    monkeypatch.setattr(api_server, "_API_KEY", "admin_secret")
    
    client = _local_client()
    
    # Without auth token, should get 401
    resp = client.get("/admin/monitor/stats")
    assert resp.status_code == 401
    
    resp = client.get("/admin/monitor/logs")
    assert resp.status_code == 401
    
    # With wrong auth token, should get 401
    resp = client.get("/admin/monitor/stats", headers={"Authorization": "Bearer wrong"})
    assert resp.status_code == 401
    
    # With correct auth token, should get 200
    headers = {"Authorization": "Bearer admin_secret"}
    resp = client.get("/admin/monitor/stats", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total_sessions"] == 1
    assert resp.json()["total_runs"] == 2


def test_monitor_stats_logs_blocked_externally(monkeypatch: pytest.MonkeyPatch) -> None:
    # Set API_AUTH_KEY
    monkeypatch.setenv("API_AUTH_KEY", "admin_secret")
    monkeypatch.setattr(api_server, "_API_KEY", "admin_secret")
    
    # Non-local client should get 403 even if they provide admin token if it is not LAN
    # Wait, require_admin checks:
    # if active_tenant_var.get() != "default" and not _is_local_or_lan_client(request): raise 403
    # If the token is admin_secret, active_tenant_var is set to "default" in require_auth.
    # If active_tenant_var is "default", require_admin does NOT block external requests
    # unless they are not authenticated.
    # Let's verify with a tenant key:
    import secrets
    import hashlib
    raw_key = "vibe_t_tenantsecret123"
    tenant_id = "tenant_" + hashlib.sha256(raw_key.encode("utf-8")).hexdigest()[:12]
    
    tenant_keys = [{
        "key": raw_key,
        "tenant_id": tenant_id,
        "name": "test-tenant",
        "is_active": True
    }]
    monkeypatch.setattr(api_server, "_load_tenant_keys", lambda: tenant_keys)
    
    # A tenant client calling monitor statistics should get 403
    remote_client = _remote_client()
    headers = {"Authorization": f"Bearer {raw_key}"}
    resp = remote_client.get("/admin/monitor/stats", headers=headers)
    assert resp.status_code == 403


def test_public_tenant_settings_isolation_vs_local(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    import hashlib
    raw_key = "vibe_t_tenantsecret123"
    tenant_id = "tenant_" + hashlib.sha256(raw_key.encode("utf-8")).hexdigest()[:12]
    tenant_keys = [{
        "key": raw_key,
        "tenant_id": tenant_id,
        "name": "test-tenant",
        "is_active": True
    }]
    monkeypatch.setattr(api_server, "_load_tenant_keys", lambda: tenant_keys)
    
    # Set up tenant directory with no override configuration (empty env file)
    tenant_dir = tmp_path / ".vibe-trading-cnx" / "tenants" / tenant_id
    tenant_dir.mkdir(parents=True, exist_ok=True)
    tenant_env = tenant_dir / ".env"
    tenant_env.write_text("# Empty override\n", encoding="utf-8")
    
    # 1. Local client access: should inherit global keys and show as configured/masked
    local_client = _local_client()
    local_headers = {"Authorization": f"Bearer {raw_key}"}
    
    resp = local_client.get("/settings/llm", headers=local_headers)
    assert resp.status_code == 200
    llm_data = resp.json()
    assert llm_data["api_key_configured"] is True
    assert llm_data["api_key_hint"] == "********"
    
    resp = local_client.get("/settings/data-sources", headers=local_headers)
    assert resp.status_code == 200
    ds_data = resp.json()
    assert ds_data["tushare_token_configured"] is True
    assert ds_data["tushare_token_hint"] == "********"

    # 2. Remote (Public) client access: should NOT inherit or show global config
    remote_client = _remote_client()
    remote_headers = {"Authorization": f"Bearer {raw_key}"}
    
    resp = remote_client.get("/settings/llm", headers=remote_headers)
    assert resp.status_code == 200
    llm_data = resp.json()
    assert llm_data["api_key_configured"] is False
    assert llm_data["api_key_hint"] is None
    
    resp = remote_client.get("/settings/data-sources", headers=remote_headers)
    assert resp.status_code == 200
    ds_data = resp.json()
    assert ds_data["tushare_token_configured"] is False
    assert ds_data["tushare_token_hint"] is None

    # 3. Add explicit tenant override for LLM provider and API key
    tenant_env.write_text(
        "LANGCHAIN_PROVIDER=openai\n"
        "OPENAI_API_KEY=sk-tenant-custom-key\n",
        encoding="utf-8"
    )
    
    # Now, remote client SHOULD see it as configured
    resp = remote_client.get("/settings/llm", headers=remote_headers)
    assert resp.status_code == 200
    llm_data = resp.json()
    assert llm_data["api_key_configured"] is True
    assert llm_data["api_key_hint"] is None  # no inherited hint since it's their own key!
