from __future__ import annotations

import json
from pathlib import Path

from app.agents.base import AgentContext, BaseAgent
from app.config import Settings
from app.parsers import parse_zap_output
from app.schemas import AgentName, Finding


class DASTAgent(BaseAgent):
    name = AgentName.DAST
    display_name = "DAST / ZAP Agent"

    def __init__(self, launcher, settings: Settings) -> None:
        super().__init__(launcher)
        self._settings = settings

    async def run(self, ctx: AgentContext):
        if not ctx.target.startswith("http"):
            raise ValueError("DAST agent requires an HTTP/HTTPS target URL")
        report_path = ctx.output_dir / "zap-report.json"
        command = [
            self._settings.zap_baseline_bin,
            "-t",
            ctx.target,
            "-J",
            str(report_path),
            "-I",
        ]
        await self._tool_launcher.run(command, cwd=ctx.output_dir)
        payload = json.loads(report_path.read_text(encoding="utf-8"))
        return parse_zap_output(payload)
