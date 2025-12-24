from __future__ import annotations

from app.agents.base import AgentContext, BaseAgent
from app.config import Settings
from app.parsers import parse_nuclei_output
from app.schemas import AgentName, Finding


class TemplateAgent(BaseAgent):
    name = AgentName.TEMPLATE
    display_name = "Nuclei Template Agent"

    def __init__(self, launcher, settings: Settings) -> None:
        super().__init__(launcher)
        self._settings = settings

    async def run(self, ctx: AgentContext):
        if not ctx.target.startswith("http"):
            raise ValueError("Template agent requires an HTTP/HTTPS target URL")
        command = [
            self._settings.nuclei_bin,
            "-u",
            ctx.target,
            "-json",
        ]
        result = await self._tool_launcher.run(command, cwd=ctx.output_dir)
        return parse_nuclei_output(result.stdout)
