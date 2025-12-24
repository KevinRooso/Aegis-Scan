from __future__ import annotations

import json
from pathlib import Path

from app.agents.base import AgentContext, BaseAgent
from app.config import Settings
from app.parsers import parse_semgrep_output
from app.schemas import AgentName, Finding


class StaticAgent(BaseAgent):
    name = AgentName.STATIC
    display_name = "Static Code Analysis"

    def __init__(self, launcher, settings: Settings) -> None:
        super().__init__(launcher)
        self._settings = settings

    async def run(self, ctx: AgentContext):
        target_path = Path(ctx.target)
        if not target_path.exists():
            raise FileNotFoundError(f"Static analysis target does not exist: {ctx.target}")
        command = [
            self._settings.semgrep_bin,
            "--config",
            self._settings.semgrep_config,
            "--json",
            "--quiet",
            str(target_path),
        ]
        output_file = ctx.output_dir / "semgrep.json"
        result = await self._tool_launcher.run(command, cwd=target_path, stdout_path=output_file)
        payload = json.loads(result.stdout or output_file.read_text(encoding="utf-8"))
        return parse_semgrep_output(payload)
