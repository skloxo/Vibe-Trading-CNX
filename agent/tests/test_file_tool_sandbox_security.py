"""Security regression tests for run_dir-based file tools."""

from __future__ import annotations

import json
from pathlib import Path

from src.tools.backtest_tool import run_backtest
from src.tools.edit_file_tool import EditFileTool
from src.tools.read_file_tool import ReadFileTool
from src.tools.write_file_tool import WriteFileTool


def _body(raw: str) -> dict:
    """Parse a JSON tool response."""
    return json.loads(raw)


def test_write_file_rejects_unconfigured_absolute_run_dir(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("VIBE_TRADING_ALLOWED_RUN_ROOTS", raising=False)

    body = _body(WriteFileTool().execute(
        path="code/signal_engine.py",
        content="print('nope')",
        run_dir=str(tmp_path),
    ))

    assert body["status"] == "error"
    assert "outside allowed run roots" in body["error"]
    assert not (tmp_path / "code" / "signal_engine.py").exists()


def test_read_and_edit_file_accept_configured_run_root(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("VIBE_TRADING_ALLOWED_RUN_ROOTS", str(tmp_path))
    target = tmp_path / "run" / "notes.md"
    target.parent.mkdir(parents=True)
    target.write_text("alpha beta", encoding="utf-8")

    read_body = _body(ReadFileTool().execute(path="notes.md", run_dir=str(target.parent)))
    edit_body = _body(EditFileTool().execute(
        path="notes.md",
        old_text="beta",
        new_text="gamma",
        run_dir=str(target.parent),
    ))

    assert read_body["status"] == "ok"
    assert "alpha beta" in read_body["content"]
    assert edit_body["status"] == "ok"
    assert target.read_text(encoding="utf-8") == "alpha gamma"


def test_backtest_rejects_unconfigured_absolute_run_dir(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("VIBE_TRADING_ALLOWED_RUN_ROOTS", raising=False)
    (tmp_path / "code").mkdir()
    (tmp_path / "config.json").write_text('{"source":"auto","codes":["AAPL"]}', encoding="utf-8")
    (tmp_path / "code" / "signal_engine.py").write_text(
        "class SignalEngine:\n    def generate(self, data_map):\n        return {}\n",
        encoding="utf-8",
    )

    body = _body(run_backtest(str(tmp_path)))

    assert body["status"] == "error"
    assert "outside allowed run roots" in body["error"]


def test_file_tools_support_allowed_file_roots_when_run_dir_missing(tmp_path: Path, monkeypatch) -> None:
    # Set allowed file roots to tmp_path
    monkeypatch.setenv("VIBE_TRADING_ALLOWED_FILE_ROOTS", str(tmp_path))
    
    # Path inside allowed root
    target = tmp_path / "extra_file.txt"
    
    # Test WriteFileTool
    write_res = _body(WriteFileTool().execute(
        path=str(target),
        content="hello world",
    ))
    assert write_res["status"] == "ok"
    assert target.exists()
    
    # Test ReadFileTool
    read_res = _body(ReadFileTool().execute(
        path=str(target),
    ))
    assert read_res["status"] == "ok"
    assert "hello world" in read_res["content"]
    
    # Test EditFileTool
    edit_res = _body(EditFileTool().execute(
        path=str(target),
        old_text="world",
        new_text="universe",
    ))
    assert edit_res["status"] == "ok"
    assert target.read_text(encoding="utf-8") == "hello universe"


def test_file_tools_reject_paths_outside_allowed_roots_when_run_dir_missing(tmp_path: Path, monkeypatch) -> None:
    # Set allowed roots to a specific folder
    allowed_dir = tmp_path / "allowed"
    allowed_dir.mkdir()
    monkeypatch.setenv("VIBE_TRADING_ALLOWED_FILE_ROOTS", str(allowed_dir))
    
    # Target outside allowed root
    outside_target = tmp_path / "outside.txt"
    
    # Test WriteFileTool
    write_res = _body(WriteFileTool().execute(
        path=str(outside_target),
        content="should fail",
    ))
    assert write_res["status"] == "error"
    assert not outside_target.exists()
    
    # Test ReadFileTool
    read_res = _body(ReadFileTool().execute(
        path=str(outside_target),
    ))
    assert read_res["status"] == "error"
    
    # Test EditFileTool
    edit_res = _body(EditFileTool().execute(
        path=str(outside_target),
        old_text="should",
        new_text="fail",
    ))
    assert edit_res["status"] == "error"

