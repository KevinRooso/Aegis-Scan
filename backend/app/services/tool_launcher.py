from __future__ import annotations

import asyncio
import os
import shlex
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Mapping, Sequence

from app.config import Settings


@dataclass(slots=True)
class ToolCommandResult:
    command: List[str]
    stdout: str
    stderr: str
    exit_code: int
    duration: float


class ToolExecutionError(RuntimeError):
    def __init__(self, result: ToolCommandResult) -> None:
        self.result = result
        super().__init__(
            f"Command failed ({result.exit_code}): {' '.join(shlex.quote(c) for c in result.command)}"
        )


class ToolLauncher:
    """Execute external security tools with consistent logging and error handling."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def run(
        self,
        command: Sequence[str],
        *,
        cwd: Path | None = None,
        env: Mapping[str, str] | None = None,
        timeout: int = 1800,
        stdout_path: Path | None = None,
    ) -> ToolCommandResult:
        cmd = [str(part) for part in command]
        merged_env = os.environ.copy()
        if env:
            merged_env.update(env)

        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(cwd) if cwd else None,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=merged_env,
        )
        start = time.perf_counter()
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(process.communicate(), timeout=timeout)
        except asyncio.TimeoutError as exc:
            process.kill()
            stdout_bytes, stderr_bytes = await process.communicate()
            duration = time.perf_counter() - start
            result = ToolCommandResult(
                command=list(cmd),
                stdout=stdout_bytes.decode(errors="ignore"),
                stderr=stderr_bytes.decode(errors="ignore"),
                exit_code=process.returncode or -1,
                duration=duration,
            )
            raise ToolExecutionError(result) from exc

        duration = time.perf_counter() - start
        stdout_text = stdout_bytes.decode(errors="ignore")
        stderr_text = stderr_bytes.decode(errors="ignore")

        if stdout_path:
            stdout_path.parent.mkdir(parents=True, exist_ok=True)
            stdout_path.write_text(stdout_text, encoding="utf-8")

        result = ToolCommandResult(
            command=list(cmd),
            stdout=stdout_text,
            stderr=stderr_text,
            exit_code=process.returncode or 0,
            duration=duration,
        )

        if result.exit_code != 0:
            raise ToolExecutionError(result)
        return result
