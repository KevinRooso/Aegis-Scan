from __future__ import annotations

import json
from pathlib import Path

from app.agents.base import AgentContext, BaseAgent
from app.config import Settings
from app.parsers import parse_trivy_output
from app.schemas import AgentName, Finding


class DependencyAgent(BaseAgent):
    name = AgentName.DEPENDENCY
    display_name = "Dependency Scanner"

    def __init__(self, launcher, settings: Settings) -> None:
        super().__init__(launcher)
        self._settings = settings

    async def run(self, ctx: AgentContext):
        target_path = Path(ctx.target)
        if not target_path.exists():
            raise FileNotFoundError(f"Dependency scan target does not exist: {ctx.target}")
        output_file = ctx.output_dir / "trivy.json"
        command = [
            self._settings.trivy_bin,
            "fs",
            "--format",
            "json",
            "--security-checks",
            "vuln",
            str(target_path),
        ]
        result = await self._tool_launcher.run(command, cwd=target_path, stdout_path=output_file)
        payload = json.loads(result.stdout or output_file.read_text(encoding="utf-8"))
        return parse_trivy_output(payload)
