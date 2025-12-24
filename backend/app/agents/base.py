from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from app.schemas import AgentName, Finding
from app.services.tool_launcher import ToolLauncher


@dataclass(slots=True)
class AgentContext:
    scan_id: str
    target: str
    mode: str
    output_dir: Path
    previous_findings: List[Finding] = field(default_factory=list)
    llm_client: Optional[Any] = None
    scan_metadata: Dict[str, Any] = field(default_factory=dict)


class BaseAgent(ABC):
    name: AgentName
    display_name: str

    def __init__(self, tool_launcher: Optional[ToolLauncher] = None, *, simulate_duration: float = 1.0) -> None:
        self._simulate_duration = max(0.1, simulate_duration)
        self._tool_launcher = tool_launcher

    @abstractmethod
    async def run(self, ctx: AgentContext) -> Iterable[Finding]:
        """Execute the agent logic and yield findings."""

    async def _simulate_work(self, steps: int = 3) -> None:
        """Utility helper used by placeholder agents while real tooling is wired up."""
        for _ in range(steps):
            await asyncio.sleep(self._simulate_duration / steps)


AgentRegistry = List[BaseAgent]
