"""Path helpers for agent-level structured config."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import contextvars

_DEFAULT_FILENAMES = ("agent.json", "agent.yaml", "agent.yml")

active_tenant_var = contextvars.ContextVar("active_tenant", default="default")
env_overrides_var = contextvars.ContextVar("env_overrides", default=None)


in_tenant_env_lookup = contextvars.ContextVar("in_tenant_env_lookup", default=False)


@lru_cache(maxsize=128)
def _read_tenant_env_file(env_path: Path, mtime: float) -> dict[str, str]:
    """Read active KEY=value entries from a dotenv file, cached by path and modification time."""
    values: dict[str, str] = {}
    if not env_path.exists():
        return values
    try:
        content = env_path.read_text(encoding="utf-8")
        for raw in content.splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            if key:
                val = val.strip()
                if " #" in val:
                    val = val.split(" #", 1)[0].rstrip()
                if len(val) >= 2 and val[0] == val[-1] and val[0] in {"'", '"'}:
                    val = val[1:-1]
                values[key] = val.strip()
    except Exception:
        pass
    return values


def get_tenant_env_values(tenant: str) -> dict[str, str]:
    """Retrieve settings from the tenant-specific .env file."""
    if tenant == "default":
        return {}
    # Use standard tenant path structure derived from home
    tenant_dir = Path.home() / ".vibe-trading-cnx" / "tenants" / tenant
    env_path = tenant_dir / ".env"
    if not env_path.exists():
        return {}
    try:
        mtime = env_path.stat().st_mtime
    except Exception:
        mtime = 0.0
    return _read_tenant_env_file(env_path, mtime)


_NOT_FOUND = object()


def _get_tenant_env(key: str) -> object:
    """Retrieve the value of an environment variable under the active tenant context."""
    if in_tenant_env_lookup.get():
        return _NOT_FOUND
        
    token = in_tenant_env_lookup.set(True)
    try:
        # 1. Check in-memory overrides for the current task/request
        overrides = env_overrides_var.get()
        if overrides is not None and key in overrides:
            return overrides[key]
        
        # 2. Check cached tenant-specific .env file
        tenant = active_tenant_var.get()
        if tenant != "default":
            vals = get_tenant_env_values(tenant)
            if key in vals:
                return vals[key]
    finally:
        in_tenant_env_lookup.reset(token)
            
    return _NOT_FOUND


# Monkeypatch os.getenv and os.environ
import os
from functools import lru_cache

_orig_getenv = os.getenv


def tenant_getenv(key: str, default: str | None = None) -> str | None:
    val = _get_tenant_env(key)
    if val is not _NOT_FOUND:
        return val  # type: ignore
    return _orig_getenv(key, default)


os.getenv = tenant_getenv


_orig_getitem = os.environ.__class__.__getitem__
_orig_get = os.environ.__class__.get
_orig_contains = os.environ.__class__.__contains__
_orig_iter = os.environ.__class__.__iter__
_orig_len = os.environ.__class__.__len__
_orig_copy = os.environ.__class__.copy


def tenant_getitem(self, key: str) -> str:
    val = _get_tenant_env(key)
    if val is not _NOT_FOUND:
        return val  # type: ignore
    return _orig_getitem(self, key)


def tenant_get(self, key: str, default: str | None = None) -> str | None:
    val = _get_tenant_env(key)
    if val is not _NOT_FOUND:
        return val  # type: ignore
    return _orig_get(self, key, default)


def tenant_contains(self, key: str) -> bool:
    val = _get_tenant_env(key)
    if val is not _NOT_FOUND:
        return True
    return _orig_contains(self, key)


def tenant_iter(self):
    tenant = active_tenant_var.get()
    overrides = env_overrides_var.get()
    
    extra_keys = set()
    if overrides:
        extra_keys.update(overrides.keys())
    if tenant != "default":
        extra_keys.update(get_tenant_env_values(tenant).keys())
        
    if extra_keys:
        all_keys = set(_orig_iter(self)) | extra_keys
        return iter(all_keys)
    return _orig_iter(self)


def tenant_len(self) -> int:
    tenant = active_tenant_var.get()
    overrides = env_overrides_var.get()
    
    extra_keys = set()
    if overrides:
        extra_keys.update(overrides.keys())
    if tenant != "default":
        extra_keys.update(get_tenant_env_values(tenant).keys())
        
    if extra_keys:
        all_keys = set(_orig_iter(self)) | extra_keys
        return len(all_keys)
    return _orig_len(self)


def tenant_copy(self) -> dict[str, str]:
    return {k: self[k] for k in self}


os.environ.__class__.__getitem__ = tenant_getitem
os.environ.__class__.get = tenant_get
os.environ.__class__.__contains__ = tenant_contains
os.environ.__class__.__iter__ = tenant_iter
os.environ.__class__.__len__ = tenant_len
os.environ.__class__.copy = tenant_copy


def get_runtime_root(config_path: Path | None = None) -> Path:
    """Return the runtime root directory for user-level agent state.

    Args:
        config_path: Optional explicit config file path. When provided, the
            runtime root is derived from that file's parent directory.

    Returns:
        The directory containing the explicit structured config file when one
        is provided, otherwise the default ``~/.vibe-trading-cnx`` runtime root,
        or a tenant-specific root under ``~/.vibe-trading-cnx/tenants/<tenant>``.
    """
    if config_path is not None:
        return config_path.expanduser().parent
    tenant = active_tenant_var.get()
    if tenant == "default":
        return Path.home() / ".vibe-trading-cnx"
    return Path.home() / ".vibe-trading-cnx" / "tenants" / tenant


def get_config_candidates(config_path: Path | None = None) -> list[Path]:
    """Return supported config path candidates in lookup order.

    Returns:
        Candidate config paths ordered by lookup priority. When an explicit
        config path is provided, only that path is returned.
    """
    if config_path is not None:
        return [config_path.expanduser()]
    root = get_runtime_root()
    return [root / filename for filename in _DEFAULT_FILENAMES]


def get_config_path(config_path: Path | None = None) -> Path:
    """Return the active config file path.

    Prefers the first existing candidate. If an explicit path is provided,
    returns that path directly. If no candidate exists yet, returns the
    recommended default JSON path.

    Args:
        config_path: Optional explicit config file path.

    Returns:
        The selected config file path for the current runtime context.
    """
    candidates = get_config_candidates(config_path)
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def get_data_dir(config_path: Path | None = None) -> Path:
    """Return and create the runtime data directory derived from config path.

    Args:
        config_path: Optional explicit config file path.

    Returns:
        The directory containing the active config file. The directory is
        created when it does not already exist.
    """
    data_dir = get_config_path(config_path).parent
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir