"""Database models and setup using SQLModel."""

from datetime import datetime
from typing import List, Optional

from sqlmodel import JSON, Column, Field, Relationship, SQLModel, create_engine

from app.schemas import AgentName, AgentStatus, FindingSeverity


class FindingDB(SQLModel, table=True):
    """Database model for security findings."""

    __tablename__ = "findings"

    id: str = Field(primary_key=True)
    scan_id: str = Field(foreign_key="scans.scan_id", index=True)
    title: str
    severity: str  # Will store FindingSeverity enum value
    description: str
    remediation: str
    references: str  # JSON array as string
    source_agent: str  # Will store AgentName enum value
    finding_metadata: str = Field(default="{}", sa_column=Column(JSON))  # JSON column

    # Relationship
    scan: "ScanDB" = Relationship(back_populates="findings")


class AgentProgressDB(SQLModel, table=True):
    """Database model for agent execution progress."""

    __tablename__ = "agent_progress"

    id: Optional[int] = Field(default=None, primary_key=True)
    scan_id: str = Field(foreign_key="scans.scan_id", index=True)
    agent: str  # Will store AgentName enum value
    status: str = Field(default="pending")  # Will store AgentStatus enum value
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    percent_complete: float = Field(default=0.0)
    message: Optional[str] = None

    # Relationship
    scan: "ScanDB" = Relationship(back_populates="progress")


class AgentThoughtDB(SQLModel, table=True):
    """Database model for ReAct agent reasoning steps."""

    __tablename__ = "agent_thoughts"

    id: Optional[int] = Field(default=None, primary_key=True)
    scan_id: str = Field(foreign_key="scans.scan_id", index=True)
    agent: str  # Will store AgentName enum value
    thought: str
    action_plan: str
    timestamp: datetime

    # Relationship
    scan: "ScanDB" = Relationship(back_populates="thoughts")


class VoiceEventDB(SQLModel, table=True):
    """Database model for voice narration events."""

    __tablename__ = "voice_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    scan_id: str = Field(foreign_key="scans.scan_id", index=True)
    event_type: str  # Will store VoiceEventType enum value
    message: str
    timestamp: datetime
    event_metadata: str = Field(default="{}", sa_column=Column(JSON))  # JSON column

    # Relationship
    scan: "ScanDB" = Relationship(back_populates="voice_events")


class ScanLogDB(SQLModel, table=True):
    """Database model for scan logs."""

    __tablename__ = "scan_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    scan_id: str = Field(foreign_key="scans.scan_id", index=True)
    log_entry: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Relationship
    scan: "ScanDB" = Relationship(back_populates="logs")


class ScanDB(SQLModel, table=True):
    """Database model for scan status and metadata."""

    __tablename__ = "scans"

    scan_id: str = Field(primary_key=True)
    target: str = Field(index=True)
    mode: str
    created_at: datetime = Field(index=True)

    # Additional metadata
    github_url: Optional[str] = None
    github_branch: Optional[str] = None
    target_url: Optional[str] = None
    workspace_path: Optional[str] = None

    # Relationships
    findings: List["FindingDB"] = Relationship(
        back_populates="scan",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    progress: List["AgentProgressDB"] = Relationship(
        back_populates="scan",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    thoughts: List["AgentThoughtDB"] = Relationship(
        back_populates="scan",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    voice_events: List["VoiceEventDB"] = Relationship(
        back_populates="scan",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    logs: List["ScanLogDB"] = Relationship(
        back_populates="scan",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


# Database engine (will be initialized in main.py)
engine = None


def init_db(database_url: str = "sqlite:///./aegisscan.db") -> None:
    """Initialize the database engine and create all tables."""
    global engine
    engine = create_engine(
        database_url,
        echo=False,  # Set to True for SQL debugging
        connect_args={"check_same_thread": False},  # Needed for SQLite
    )
    SQLModel.metadata.create_all(engine)


def get_engine():
    """Get the database engine."""
    if engine is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return engine
