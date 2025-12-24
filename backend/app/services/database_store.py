"""Database-backed storage for scan results."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Dict

from sqlmodel import Session, select

from app.database import (
    AgentProgressDB,
    AgentThoughtDB,
    FindingDB,
    ScanDB,
    ScanLogDB,
    VoiceEventDB,
    get_engine,
)
from app.schemas import (
    AgentProgress,
    AgentThought,
    Finding,
    ScanStatus,
    VoiceEvent,
)


class DatabaseStore:
    """Database-backed storage for scan results."""

    def __init__(self) -> None:
        """Initialize the database store."""
        self.engine = get_engine()

    def save(self, status: ScanStatus) -> None:
        """Save scan status to database."""
        with Session(self.engine) as session:
            # Check if scan exists
            existing_scan = session.get(ScanDB, status.scan_id)

            if existing_scan:
                # Update existing scan
                existing_scan.target = status.target
                existing_scan.mode = status.mode
                existing_scan.created_at = status.created_at
                existing_scan.github_url = status.github_url
                existing_scan.github_branch = status.github_branch
                existing_scan.target_url = status.target_url
                existing_scan.workspace_path = status.workspace_path

                # Delete existing related records (will be replaced)
                for finding in existing_scan.findings:
                    session.delete(finding)
                for progress in existing_scan.progress:
                    session.delete(progress)
                for thought in existing_scan.thoughts:
                    session.delete(thought)
                for event in existing_scan.voice_events:
                    session.delete(event)
                for log in existing_scan.logs:
                    session.delete(log)

                scan_db = existing_scan
            else:
                # Create new scan
                scan_db = ScanDB(
                    scan_id=status.scan_id,
                    target=status.target,
                    mode=status.mode,
                    created_at=status.created_at,
                    github_url=status.github_url,
                    github_branch=status.github_branch,
                    target_url=status.target_url,
                    workspace_path=status.workspace_path,
                )
                session.add(scan_db)

            # Add findings
            for finding in status.findings:
                finding_db = FindingDB(
                    id=f"{status.scan_id}_{finding.id}",  # Make ID unique per scan
                    scan_id=status.scan_id,
                    title=finding.title,
                    severity=finding.severity.value,
                    description=finding.description,
                    remediation=finding.remediation,
                    references=json.dumps(finding.references),
                    source_agent=finding.source_agent.value,
                    finding_metadata=json.dumps(finding.metadata),
                )
                session.add(finding_db)

            # Add agent progress
            for progress in status.progress:
                progress_db = AgentProgressDB(
                    scan_id=status.scan_id,
                    agent=progress.agent.value,
                    status=progress.status.value,
                    started_at=progress.started_at,
                    ended_at=progress.ended_at,
                    percent_complete=progress.percent_complete,
                    message=progress.message,
                )
                session.add(progress_db)

            # Add thoughts
            for thought in status.thoughts:
                thought_db = AgentThoughtDB(
                    scan_id=status.scan_id,
                    agent=thought.agent.value,
                    thought=thought.thought,
                    action_plan=thought.action_plan,
                    timestamp=thought.timestamp,
                )
                session.add(thought_db)

            # Add voice events
            for event in status.voice_events:
                event_db = VoiceEventDB(
                    scan_id=status.scan_id,
                    event_type=event.event_type.value,
                    message=event.message,
                    timestamp=event.timestamp,
                    event_metadata=json.dumps(event.metadata),
                )
                session.add(event_db)

            # Add logs
            for log_entry in status.logs:
                log_db = ScanLogDB(
                    scan_id=status.scan_id,
                    log_entry=log_entry,
                    timestamp=datetime.utcnow(),
                )
                session.add(log_db)

            session.commit()

    def load(self, scan_id: str) -> ScanStatus | None:
        """Load scan status from database."""
        with Session(self.engine) as session:
            scan_db = session.get(ScanDB, scan_id)
            if not scan_db:
                return None

            # Convert DB model to Pydantic model
            return self._convert_to_scan_status(session, scan_db)

    def list_scans(self) -> Dict[str, ScanStatus]:
        """List all scans from database."""
        with Session(self.engine) as session:
            statement = select(ScanDB).order_by(ScanDB.created_at.desc())
            scans_db = session.exec(statement).all()

            statuses: Dict[str, ScanStatus] = {}
            for scan_db in scans_db:
                status = self._convert_to_scan_status(session, scan_db)
                statuses[status.scan_id] = status

            return statuses

    def search_scans(
        self, target: str | None = None, limit: int = 10
    ) -> list[ScanStatus]:
        """Search scans by target or other criteria."""
        with Session(self.engine) as session:
            statement = select(ScanDB).order_by(ScanDB.created_at.desc())

            if target:
                statement = statement.where(ScanDB.target.contains(target))

            statement = statement.limit(limit)
            scans_db = session.exec(statement).all()

            return [
                self._convert_to_scan_status(session, scan_db) for scan_db in scans_db
            ]

    def _convert_to_scan_status(self, session: Session, scan_db: ScanDB) -> ScanStatus:
        """Convert database model to Pydantic ScanStatus model."""
        # Load findings
        findings = []
        for finding_db in scan_db.findings:
            findings.append(
                Finding(
                    id=finding_db.id,
                    title=finding_db.title,
                    severity=finding_db.severity,
                    description=finding_db.description,
                    remediation=finding_db.remediation,
                    references=json.loads(finding_db.references),
                    source_agent=finding_db.source_agent,
                    metadata=json.loads(finding_db.finding_metadata)
                    if isinstance(finding_db.finding_metadata, str)
                    else finding_db.finding_metadata,
                )
            )

        # Load progress
        progress = []
        for progress_db in scan_db.progress:
            progress.append(
                AgentProgress(
                    agent=progress_db.agent,
                    status=progress_db.status,
                    started_at=progress_db.started_at,
                    ended_at=progress_db.ended_at,
                    percent_complete=progress_db.percent_complete,
                    message=progress_db.message,
                )
            )

        # Load thoughts
        thoughts = []
        for thought_db in scan_db.thoughts:
            thoughts.append(
                AgentThought(
                    agent=thought_db.agent,
                    thought=thought_db.thought,
                    action_plan=thought_db.action_plan,
                    timestamp=thought_db.timestamp,
                )
            )

        # Load voice events
        voice_events = []
        for event_db in scan_db.voice_events:
            voice_events.append(
                VoiceEvent(
                    scan_id=event_db.scan_id,
                    event_type=event_db.event_type,
                    message=event_db.message,
                    timestamp=event_db.timestamp,
                    metadata=json.loads(event_db.event_metadata)
                    if isinstance(event_db.event_metadata, str)
                    else event_db.event_metadata,
                )
            )

        # Load logs (convert ScanLogDB objects to strings)
        logs = [log_db.log_entry for log_db in scan_db.logs]

        return ScanStatus(
            scan_id=scan_db.scan_id,
            target=scan_db.target,
            mode=scan_db.mode,
            created_at=scan_db.created_at,
            progress=progress,
            findings=findings,
            logs=logs,
            thoughts=thoughts,
            voice_events=voice_events,
            github_url=scan_db.github_url,
            github_branch=scan_db.github_branch,
            target_url=scan_db.target_url,
            workspace_path=scan_db.workspace_path,
        )
