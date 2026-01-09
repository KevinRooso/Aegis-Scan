from __future__ import annotations

import json
from pathlib import Path

from app.agents.base import AgentContext, BaseAgent
from app.config import Settings
from app.parsers import parse_gitleaks_output
from app.schemas import AgentName, Finding


class SecretAgent(BaseAgent):
    name = AgentName.SECRET
    display_name = "Secret Leakage Scanner"

    def __init__(self, launcher, settings: Settings) -> None:
        super().__init__(launcher)
        self._settings = settings

    async def run(self, ctx: AgentContext):
        target_path = Path(ctx.target)
        if not target_path.exists():
            raise FileNotFoundError(f"Secret scan target does not exist: {ctx.target}")
        command = [
            self._settings.gitleaks_bin,
            "detect",
            "--no-banner",
            "--report-format",
            "json",
            "--report-path",
            "-",
            "--source",
            str(target_path),
        ]

        # Gitleaks returns exit code 1 when secrets are found (expected behavior)
        # We need to catch this and parse the output anyway
        try:
            result = await self._tool_launcher.run(command, cwd=target_path)
        except Exception as e:
            # Check if this is a ToolExecutionError with exit code 1
            if hasattr(e, 'result') and e.result.exit_code == 1:
                # Exit code 1 means secrets were found - this is expected!
                # Parse the stdout which contains the JSON results
                payload = json.loads(e.result.stdout or "[]")
                return parse_gitleaks_output(payload)
            else:
                # Other errors should be raised
                raise

        # Exit code 0 means no secrets found
        payload = json.loads(result.stdout or "[]")
        return parse_gitleaks_output(payload)
