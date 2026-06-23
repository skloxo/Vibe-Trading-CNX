"""Write file tool: create or overwrite files in the workspace."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.agent.tools import BaseTool
from src.tools.path_utils import safe_path as _safe_path
from src.tools.path_utils import safe_run_dir as _safe_run_dir
from src.tools.path_utils import _allowed_file_roots
from src.tools.redaction import redact_internal_paths


class WriteFileTool(BaseTool):
    """Create or overwrite a workspace file, creating parent directories as needed."""

    name = "write_file"
    description = "Write content to a file in the workspace. Creates parent directories automatically."
    is_readonly = False
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "File path relative to run_dir"},
            "content": {"type": "string", "description": "Content to write"},
        },
        "required": ["path", "content"],
    }
    repeatable = True

    def execute(self, **kwargs: Any) -> str:
        """Write content to a file.

        Args:
            **kwargs: Must include path and content. Optional run_dir.

        Returns:
            JSON string with bytes_written or an error.
        """
        file_path = kwargs["path"]
        content = kwargs["content"]
        run_dir = kwargs.get("run_dir")

        if not run_dir:
            # Allow write if path resolves inside a configured extra file root
            candidate = Path(file_path).expanduser().resolve()
            for extra_root in _allowed_file_roots():
                if candidate.is_relative_to(extra_root):
                    resolved = candidate
                    break
            else:
                return json.dumps(
                    {
                        "status": "error",
                        "error": "run_dir is required for write_file",
                    },
                    ensure_ascii=False,
                )
        else:
            try:
                run_root = _safe_run_dir(str(run_dir))
                resolved = _safe_path(file_path, run_root)
            except ValueError:
                pass
            else:
                # _safe_path may not expand tildes; verify path is valid
                if not resolved.exists():
                    candidate = Path(file_path).expanduser().resolve()
                    if candidate.is_absolute():
                        for extra_root in _allowed_file_roots():
                            if candidate.is_relative_to(extra_root):
                                resolved = candidate
                                break
            if not resolved or (not resolved.exists() and not resolved.parent.exists()):
                candidate = Path(file_path).expanduser().resolve()
                allowed = False
                for extra_root in _allowed_file_roots():
                    if candidate.is_relative_to(extra_root):
                        allowed = True
                        resolved = candidate
                        break
                if not allowed:
                    return json.dumps(
                        {
                            "status": "error",
                            "error": f"Path {file_path!r} is outside allowed workspace",
                        },
                        ensure_ascii=False,
                    )

        try:
            resolved.parent.mkdir(parents=True, exist_ok=True)
            resolved.write_text(content, encoding="utf-8")
            return json.dumps(
                {
                    "status": "ok",
                    "path": str(resolved),
                    "bytes_written": len(content.encode("utf-8")),
                },
                ensure_ascii=False,
            )
        except Exception as exc:
            return json.dumps(
                {
                    "status": "error",
                    "error": redact_internal_paths(str(exc)),
                },
                ensure_ascii=False,
            )
