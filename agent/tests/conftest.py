"""Shared fixtures and sys.path setup for all tests."""

from __future__ import annotations

import sys
from pathlib import Path
import pytest

# Ensure agent/ is on sys.path so imports like `backtest.*` and `src.*` work.
AGENT_DIR = Path(__file__).resolve().parent.parent
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))


@pytest.fixture(autouse=True)
def reset_active_tenant() -> None:
    """Ensure active_tenant is always reset to default before and after each test to prevent test pollution."""
    from src.config.paths import active_tenant_var
    active_tenant_var.set("default")
    yield
    active_tenant_var.set("default")

