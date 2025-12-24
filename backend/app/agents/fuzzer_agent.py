from __future__ import annotations

import os
from urllib.parse import urljoin

from app.agents.base import AgentContext, BaseAgent
from app.config import Settings
from app.parsers import parse_ffuf_output
from app.schemas import AgentName, Finding


class FuzzerAgent(BaseAgent):
    name = AgentName.FUZZER
    display_name = "Fuzzer / Directory Discovery"

    def __init__(self, launcher, settings: Settings) -> None:
        super().__init__(launcher)
        self._settings = settings

    async def run(self, ctx: AgentContext):
        if not ctx.target.startswith("http"):
            raise ValueError("Fuzzer agent requires an HTTP/HTTPS target URL")
        wordlist = self._settings.ffuf_wordlist
        if not os.path.exists(wordlist):
            raise FileNotFoundError(f"ffuf wordlist not found: {wordlist}")

        fuzz_url = urljoin(ctx.target.rstrip("/") + "/", "FUZZ")
        command = [
            self._settings.ffuf_bin,
            "-u",
            fuzz_url,
            "-w",
            wordlist,
            "-mc",
            "200,204,301,302,401,403",
            "-json",
        ]
        result = await self._tool_launcher.run(command, cwd=ctx.output_dir)
        return parse_ffuf_output(result.stdout)
