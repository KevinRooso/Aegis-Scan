from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncIterator, Dict, Iterable, Optional
from uuid import uuid4

from app.agents import (
    AdaptiveAgent,
    DASTAgent,
    DependencyAgent,
    FuzzerAgent,
    ReportAgent,
    SecretAgent,
    StaticAgent,
    TemplateAgent,
    ThreatAgent,
)
from app.agents.base import AgentContext, BaseAgent
from app.config import Settings, get_settings
from app.schemas import AgentName, AgentProgress, AgentStatus, AgentThought, Finding, FindingSeverity, ScanRequest, ScanStatus
from app.services.git_service import GitService, GitCloneError
from app.services.llm_client import create_llm_client, LLMClient
from app.services.database_store import DatabaseStore
from app.services.tool_launcher import ToolLauncher
from app.services.voice import VoiceNotifier
from app.web.websocket_manager import WebsocketManager

logger = logging.getLogger(__name__)


class Orchestrator:
    def __init__(self, ws_manager: WebsocketManager, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._ws_manager = ws_manager
        self._tool_launcher = ToolLauncher(settings=self._settings)
        self._results_store = DatabaseStore()
        self._voice = VoiceNotifier(self._settings)
        self._git_service = GitService(self._settings.git_workspaces_dir)
        self._llm_client: Optional[LLMClient] = create_llm_client(self._settings)
        self._scans: Dict[str, ScanStatus] = {}
        self._tasks: Dict[str, asyncio.Task] = {}
        self._workspaces: Dict[str, Path] = {}  # Track cloned workspaces for cleanup

        if self._llm_client:
            logger.info("LLM client initialized successfully")
        else:
            logger.warning("LLM client not available - adaptive features disabled")

    def _agent_factories(self) -> Dict[AgentName, BaseAgent]:
        reports_dir = self._settings.results_dir / "reports"
        return {
            AgentName.STATIC: StaticAgent(self._tool_launcher, self._settings),
            AgentName.DEPENDENCY: DependencyAgent(self._tool_launcher, self._settings),
            AgentName.SECRET: SecretAgent(self._tool_launcher, self._settings),
            AgentName.FUZZER: FuzzerAgent(self._tool_launcher, self._settings),
            AgentName.DAST: DASTAgent(self._tool_launcher, self._settings),
            AgentName.TEMPLATE: TemplateAgent(self._tool_launcher, self._settings),
            AgentName.ADAPTIVE: AdaptiveAgent(),
            AgentName.THREAT: ThreatAgent(),
            AgentName.REPORT: ReportAgent(reports_dir=reports_dir),
        }

    def _create_progress(self) -> Iterable[AgentProgress]:
        progress = []
        factories = self._agent_factories()
        for agent_name in self._settings.enabled_agents:
            name = AgentName(agent_name)
            if name in factories:
                progress.append(AgentProgress(agent=name))
        return progress

    def _validate_request(self, request: ScanRequest) -> None:
        """Validate scan request has at least one source."""
        has_github = bool(request.github_url)
        has_target_url = bool(request.target_url)
        has_legacy_target = bool(request.target)

        if not (has_github or has_target_url or has_legacy_target):
            raise ValueError(
                "At least one source is required: github_url, target_url, or target (legacy)"
            )

    def _determine_target_display(self, request: ScanRequest) -> str:
        """Determine display name for scan target."""
        if request.github_url:
            return request.github_url
        if request.target_url:
            return request.target_url
        if request.target:
            return request.target
        return "unknown"

    def _determine_enabled_agents(self, request: ScanRequest) -> list[str]:
        """Determine which agents should run based on scan type."""
        # Static analysis agents (need code)
        static_agents = ["static", "dependency", "secret"]
        # Dynamic analysis agents (need live URL)
        dynamic_agents = ["dast", "fuzzer", "template"]
        # Always-on agents
        meta_agents = ["adaptive", "threat", "report"]

        enabled = []

        # Add static agents if we have code source
        if request.github_url or request.target:
            enabled.extend(static_agents)

        # Add dynamic agents if we have a live target
        if request.target_url or request.target:
            enabled.extend(dynamic_agents)

        # Always add meta agents
        enabled.extend(meta_agents)

        # Override with user-specified agents if provided
        if request.enabled_agents:
            # Filter to only valid agents
            enabled = [a for a in request.enabled_agents if a in self._settings.enabled_agents]

        return enabled

    async def start_scan(self, request: ScanRequest) -> ScanStatus:
        # Validate request
        self._validate_request(request)

        scan_id = uuid4().hex
        target_display = self._determine_target_display(request)

        # Create progress for appropriate agents
        original_enabled = self._settings.enabled_agents
        self._settings.enabled_agents = self._determine_enabled_agents(request)
        progress = list(self._create_progress())
        self._settings.enabled_agents = original_enabled

        status = ScanStatus(
            scan_id=scan_id,
            target=target_display,
            mode=request.mode,
            created_at=datetime.utcnow(),
            progress=progress,
            github_url=request.github_url,
            github_branch=request.github_branch if request.github_url else None,
            target_url=request.target_url,
        )
        self._scans[scan_id] = status
        self._results_store.save(status)

        task = asyncio.create_task(self._run_scan(scan_id, request))
        self._tasks[scan_id] = task
        return status

    async def _run_scan(self, scan_id: str, request: ScanRequest) -> None:
        status = self._scans[scan_id]
        workspace_path: Optional[Path] = None

        try:
            # Step 1: Clone repository if GitHub URL provided
            if request.github_url:
                log_msg = f"Cloning repository: {request.github_url} (branch: {request.github_branch})"
                status.logs.append(log_msg)
                logger.info(log_msg)
                await self._publish(status)

                try:
                    workspace_path = await self._git_service.clone_repo(
                        repo_url=request.github_url,
                        branch=request.github_branch,
                        auth_token=request.github_token,
                        scan_id=scan_id,
                    )
                    self._workspaces[scan_id] = workspace_path
                    status.workspace_path = str(workspace_path)

                    # Get repo info
                    repo_info = await self._git_service.get_repo_info(workspace_path)
                    log_msg = (
                        f"Successfully cloned: {repo_info['remote_url']} "
                        f"(branch: {repo_info['branch']}, commit: {repo_info['commit']})"
                    )
                    status.logs.append(log_msg)
                    logger.info(log_msg)
                    await self._publish(status)

                except GitCloneError as e:
                    error_msg = f"Failed to clone repository: {str(e)}"
                    status.logs.append(error_msg)
                    logger.error(error_msg)
                    await self._publish(status)
                    # Mark all agents as failed
                    for entry in status.progress:
                        entry.status = AgentStatus.FAILED
                        entry.message = "Repository clone failed"
                    return

            # Step 2: Prepare agent context
            factories = self._agent_factories()
            scan_dir = self._settings.results_dir / scan_id
            scan_dir.mkdir(parents=True, exist_ok=True)

            # Use workspace_path for code analysis, target_url for dynamic scanning
            ctx = AgentContext(
                scan_id=scan_id,
                target=request.target_url or request.target or str(workspace_path or ""),
                mode=status.mode,
                output_dir=scan_dir,
                previous_findings=[],  # Will be updated per agent
                llm_client=self._llm_client,
                scan_metadata={
                    "github_url": request.github_url,
                    "target_url": request.target_url,
                "branch": request.github_branch,
                },
            )

            # Step 3: Run agents
            for entry in status.progress:
                agent = factories.get(entry.agent)
                if not agent:
                    entry.status = AgentStatus.SKIPPED
                    continue

                entry.status = AgentStatus.RUNNING
                entry.started_at = datetime.utcnow()
                await self._publish(status)

                # Voice narration: Agent starting
                if self._voice.enabled:
                    voice_event = await self._voice.narrate_agent_start(agent.display_name, scan_id)
                    status.voice_events.append(voice_event)
                    await self._ws_manager.broadcast_voice_event(scan_id, voice_event)

                try:
                    # Update context with workspace path for static agents
                    if workspace_path and entry.agent in [
                        AgentName.STATIC,
                        AgentName.DEPENDENCY,
                        AgentName.SECRET,
                    ]:
                        ctx.target = str(workspace_path)

                    # Update context with target_url for dynamic agents
                    if request.target_url and entry.agent in [
                        AgentName.DAST,
                        AgentName.FUZZER,
                        AgentName.TEMPLATE,
                    ]:
                        ctx.target = request.target_url

                    # Pass accumulated findings to this agent for intelligence sharing
                    ctx.previous_findings = list(status.findings)

                    # Collect results from agent (can be AgentThought or Finding)
                    async for item in self._stream_agent_outputs(agent.run(ctx)):
                        if isinstance(item, AgentThought):
                            status.thoughts.append(item)
                            logger.debug(f"Captured thought from {item.agent}: {item.thought[:100]}...")
                            await self._publish(status)  # Publish thoughts in real-time

                            # Voice narration: Agent thought (optional, only for meta-agents)
                            if self._voice.enabled and item.agent in [AgentName.ADAPTIVE, AgentName.THREAT]:
                                voice_event = await self._voice.narrate_thought(item, scan_id)
                                status.voice_events.append(voice_event)
                                await self._ws_manager.broadcast_voice_event(scan_id, voice_event)

                        elif isinstance(item, Finding):
                            self._append_findings(status, [item])

                            # Voice narration: Critical/High findings
                            if self._voice.enabled and item.severity in [FindingSeverity.CRITICAL, FindingSeverity.HIGH]:
                                voice_event = await self._voice.narrate_finding(item, scan_id)
                                status.voice_events.append(voice_event)
                                await self._ws_manager.broadcast_voice_event(scan_id, voice_event)

                    entry.status = AgentStatus.COMPLETED
                    entry.message = f"{agent.display_name} completed"
                except Exception as exc:
                    logger.error(f"Agent {entry.agent} failed: {exc}", exc_info=True)
                    entry.status = AgentStatus.FAILED
                    entry.message = str(exc)
                finally:
                    entry.ended_at = datetime.utcnow()
                    entry.percent_complete = 100.0
                    status.logs.append(entry.message or f"{agent.display_name} finished")
                    self._results_store.save(status)
                    await self._publish(status)

            # Voice narration: Scan completion
            if self._voice.enabled:
                voice_event = await self._voice.narrate_completion(
                    scan_id,
                    len(status.findings),
                    status.target,
                )
                status.voice_events.append(voice_event)
                await self._ws_manager.broadcast_voice_event(scan_id, voice_event)

        finally:
            # Step 4: Cleanup workspace
            if workspace_path:
                log_msg = f"Cleaning up workspace: {workspace_path}"
                status.logs.append(log_msg)
                logger.info(log_msg)
                await self._git_service.cleanup_workspace(workspace_path)
                if scan_id in self._workspaces:
                    del self._workspaces[scan_id]
                await self._publish(status)

    async def _publish(self, status: ScanStatus) -> None:
        await self._ws_manager.broadcast(
            status.scan_id,
            {
                "scan_id": status.scan_id,
                "status": status.model_dump(mode="json"),
            },
        )

    async def _stream_agent_outputs(self, run_result: Any) -> AsyncIterator[Any]:
        """
        Normalize agent.run return values so orchestrator can iterate results regardless of
        whether the agent implemented an async generator (yield) or returns a list once awaited.
        """
        if hasattr(run_result, "__aiter__"):
            async for item in run_result:
                if item is not None:
                    yield item
            return

        result = await run_result
        if result is None:
            return

        if isinstance(result, (list, tuple)):
            for item in result:
                if item is not None:
                    yield item
        else:
            yield result

    def _append_findings(self, status: ScanStatus, findings: Iterable[Finding]) -> None:
        status.findings.extend(findings)

    def get_status(self, scan_id: str) -> ScanStatus | None:
        if scan_id in self._scans:
            return self._scans[scan_id]
        return self._results_store.load(scan_id)

    def list_scans(self) -> Dict[str, ScanStatus]:
        return {**self._results_store.list_scans(), **self._scans}

    async def wait_for_completion(self, scan_id: str) -> ScanStatus:
        task = self._tasks.get(scan_id)
        if task:
            await task
        status = self.get_status(scan_id)
        if not status:
            raise ValueError(f"Scan {scan_id} not found after completion")
        return status
