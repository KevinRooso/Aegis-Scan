from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AgentName(str, Enum):
    STATIC = "static"
    DEPENDENCY = "dependency"
    SECRET = "secret"
    FUZZER = "fuzzer"
    DAST = "dast"
    TEMPLATE = "template"
    ADAPTIVE = "adaptive"
    THREAT = "threat"
    REPORT = "report"


class AgentStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class FindingSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "informational"


class Finding(BaseModel):
    id: str
    title: str
    severity: FindingSeverity
    description: str
    remediation: str
    references: List[str] = Field(default_factory=list)
    source_agent: AgentName
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AgentThought(BaseModel):
    """Represents an agent's reasoning step in the ReAct framework."""

    agent: AgentName
    thought: str  # LLM-generated reasoning about what to do
    action_plan: str  # What the agent will execute
    timestamp: datetime


class VoiceEventType(str, Enum):
    """Types of voice events during scan execution."""

    GREETING = "greeting"
    AGENT_START = "agent_start"
    FINDING = "finding"
    COMPLETION = "completion"
    THINKING = "thinking"


class VoiceEvent(BaseModel):
    """Represents a voice narration event."""

    scan_id: str
    event_type: VoiceEventType
    message: str
    timestamp: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AgentProgress(BaseModel):
    agent: AgentName
    status: AgentStatus = AgentStatus.PENDING
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    percent_complete: float = 0.0
    message: Optional[str] = None


class ScanStatus(BaseModel):
    scan_id: str
    target: str  # Can be GitHub URL, web URL, or legacy target
    mode: str
    created_at: datetime
    progress: List[AgentProgress]
    findings: List[Finding] = Field(default_factory=list)
    logs: List[str] = Field(default_factory=list)
    thoughts: List[AgentThought] = Field(default_factory=list)  # ReAct reasoning steps
    voice_events: List[VoiceEvent] = Field(default_factory=list)  # Voice narration events
    # Additional metadata for new scan types
    github_url: Optional[str] = None
    github_branch: Optional[str] = None
    target_url: Optional[str] = None
    workspace_path: Optional[str] = None


class ScanRequest(BaseModel):
    # Source configuration (at least one required)
    github_url: Optional[str] = None
    github_branch: str = "main"
    github_token: Optional[str] = None  # For private repositories

    # Target configuration (optional - for dynamic scanning)
    target_url: Optional[str] = None

    # Legacy support (deprecated)
    target: Optional[str] = None  # Will be removed in future versions

    # Scan configuration
    mode: str = "adaptive"
    no_docker: bool = False
    out_dir: Optional[str] = None
    max_memory: Optional[int] = None
    concurrency: Optional[int] = None
    enabled_agents: Optional[List[str]] = None
    scan_name: Optional[str] = None


class ScanResponse(BaseModel):
    scan_id: str
    status: ScanStatus


class ReportResponse(BaseModel):
    scan_id: str
    report_path: str
    report_url: str
    pdf_path: str | None = None
    pdf_url: str | None = None
    pdf_available: bool = False


class WebsocketPayload(BaseModel):
    scan_id: str
    type: str
    payload: Dict[str, Any]


class VoiceRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class VoiceResponse(BaseModel):
    success: bool
    relay: Dict[str, Any] | None = None


class VoiceFocusAction(str, Enum):
    """Actions that the voice agent can trigger on the frontend."""
    HIGHLIGHT_FINDING = "highlight_finding"
    SHOW_SUMMARY = "show_summary"
    SHOW_STATS = "show_stats"
    SHOW_CRITICAL = "show_critical"
    SHOW_HIGH = "show_high"
    FILTER_BY_SEVERITY = "filter_by_severity"
    NEXT_FINDING = "next_finding"
    PREVIOUS_FINDING = "previous_finding"
    RESET_VIEW = "reset_view"
    CLEAR = "clear"


class VoiceFocusRequest(BaseModel):
    """Request from ElevenLabs to control frontend focus."""
    scan_id: str
    action: VoiceFocusAction
    data: Dict[str, Any] = Field(default_factory=dict)  # finding_id, severity, etc.


class VoiceFocusMessage(BaseModel):
    """WebSocket message to control frontend focus."""
    type: str = "voice_focus"
    action: VoiceFocusAction
    data: Dict[str, Any] = Field(default_factory=dict)
