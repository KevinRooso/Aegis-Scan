from __future__ import annotations

import logging
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, ORJSONResponse

from app.config import Settings, get_settings
from app.database import init_db
from app.orchestrator import Orchestrator
from app.schemas import ReportResponse, ScanRequest, ScanResponse, ScanStatus, VoiceRequest, VoiceResponse, VoiceFocusRequest
from app.web.websocket_manager import WebsocketManager
from app.services.voice import VoiceNotifier
from app.services.voice_parser import VoiceInputParser
from app.services.llm_client import create_llm_client
from app.services.finding_explainer import FindingExplainer

ws_manager = WebsocketManager()
orchestrator = None  # Will be initialized on startup
app = FastAPI(title="AegisScan Backend", version="0.1.0", default_response_class=ORJSONResponse)
logger = logging.getLogger(__name__)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative frontend port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def get_orchestrator() -> Orchestrator:
    if orchestrator is None:
        raise HTTPException(status_code=503, detail="Backend is still starting up")
    return orchestrator


@app.on_event("startup")
async def ensure_dirs() -> None:
    global orchestrator

    settings = get_settings()
    Path(settings.results_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.git_workspaces_dir).mkdir(parents=True, exist_ok=True)

    # Initialize database
    db_path = settings.results_dir / "aegisscan.db"
    init_db(f"sqlite:///{db_path}")
    logger.info(f"Database initialized at {db_path}")

    # Initialize orchestrator after database
    orchestrator = Orchestrator(ws_manager=ws_manager)
    logger.info("Orchestrator initialized")


@app.post("/scan/start", response_model=ScanResponse)
async def start_scan(
    request: ScanRequest,
    orch: Orchestrator = Depends(get_orchestrator),
) -> ScanResponse:
    status = await orch.start_scan(request)
    return ScanResponse(scan_id=status.scan_id, status=status)


@app.get("/scan/status/{scan_id}", response_model=ScanStatus)
async def get_scan_status(scan_id: str, orch: Orchestrator = Depends(get_orchestrator)) -> ScanStatus:
    status = orch.get_status(scan_id)
    if not status:
        raise HTTPException(status_code=404, detail="Scan not found")
    return status


@app.get("/scan/results/{scan_id}", response_model=ScanStatus)
async def get_scan_results(scan_id: str, orch: Orchestrator = Depends(get_orchestrator)) -> ScanStatus:
    status = orch.get_status(scan_id)
    if not status:
        raise HTTPException(status_code=404, detail="Scan not found")
    return status


@app.get("/scan/logs/{scan_id}")
async def get_scan_logs(scan_id: str, orch: Orchestrator = Depends(get_orchestrator)) -> dict:
    status = orch.get_status(scan_id)
    if not status:
        raise HTTPException(status_code=404, detail="Scan not found")
    return {"scan_id": scan_id, "logs": status.logs}


@app.get("/report/latest/{scan_id}", response_model=ReportResponse)
async def get_latest_report(scan_id: str, orch: Orchestrator = Depends(get_orchestrator)) -> ReportResponse:
    status = orch.get_status(scan_id)
    if not status:
        raise HTTPException(status_code=404, detail="Scan not found")
    report_finding = next(
        (f for f in reversed(status.findings) if f.source_agent == "report" and "report_path" in f.metadata),
        None,
    )
    if not report_finding:
        raise HTTPException(status_code=404, detail="Report not generated yet")

    report_path = report_finding.metadata.get("report_path")
    if not report_path:
        raise HTTPException(status_code=404, detail="Report metadata missing")

    pdf_path = report_finding.metadata.get("pdf_path")
    pdf_exists = bool(pdf_path and Path(pdf_path).exists())

    return ReportResponse(
        scan_id=scan_id,
        report_path=str(report_path),
        report_url=f"/report/file/{scan_id}?format=md",
        pdf_path=str(pdf_path) if pdf_exists else None,
        pdf_url=f"/report/file/{scan_id}?format=pdf" if pdf_exists else None,
        pdf_available=pdf_exists,
    )


@app.get("/api/scans/list")
async def list_all_scans(orch: Orchestrator = Depends(get_orchestrator)) -> dict:
    """List all scans with their metadata."""
    all_scans = orch.list_scans()
    return all_scans


@app.websocket("/ws/{scan_id}")
async def scan_updates_ws(websocket: WebSocket, scan_id: str) -> None:
    await ws_manager.connect(scan_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(scan_id, websocket)


@app.post("/api/voice/conversation/start")
async def start_voice_conversation(
    settings: Settings = Depends(get_settings),
) -> dict:
    """Initialize a new voice conversation session."""
    import uuid
    from datetime import datetime, UTC

    notifier = VoiceNotifier(settings)
    if not notifier.enabled:
        raise HTTPException(status_code=503, detail="Voice agent not configured - ElevenLabs API key required")

    # Generate unique conversation ID
    conversation_id = f"conv_{uuid.uuid4().hex[:12]}"
    signed_url = await _fetch_elevenlabs_signed_url(settings)

    return {
        "conversation_id": conversation_id,
        "agent_id": settings.elevenlabs_agent_id,
        "signed_url": signed_url,
        "status": "active",
        "created_at": datetime.now(UTC).isoformat(),
    }


@app.post("/api/voice/conversation/end")
async def end_voice_conversation(
    request: dict,
    settings: Settings = Depends(get_settings),
) -> dict:
    """End an active voice conversation session."""
    conversation_id = request.get("conversation_id")
    if not conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id required")

    return {
        "conversation_id": conversation_id,
        "status": "ended",
    }


@app.get("/api/voice/finding/{finding_id}/details")
async def get_finding_details(
    finding_id: str,
    orch: Orchestrator = Depends(get_orchestrator),
    settings: Settings = Depends(get_settings),
) -> dict:
    """
    Get detailed explanation for a specific finding (on-demand).
    This is called when user asks "tell me more" to avoid generating all details upfront.
    """
    # Get latest scan
    all_scans = orch.list_scans()
    if not all_scans:
        raise HTTPException(status_code=404, detail="No scans found")

    status = max(all_scans.values(), key=lambda s: s.created_at)

    # Find the specific finding
    finding = next(
        (f for f in status.findings if f.id.endswith(finding_id) or f.id == finding_id),
        None
    )

    if not finding:
        raise HTTPException(status_code=404, detail=f"Finding {finding_id} not found")

    # Generate detailed explanation
    llm_client = create_llm_client(settings)
    explainer = FindingExplainer(llm_client) if llm_client else None

    detailed_explanation = None
    if explainer:
        try:
            detailed_explanation = await explainer.generate_detailed_explanation(finding)
        except Exception as exc:
            logger.error(f"Failed to generate detailed explanation: {exc}")
            detailed_explanation = f"{finding.description}... To remediate this... {finding.remediation}"
    else:
        detailed_explanation = f"{finding.description}... To remediate this... {finding.remediation}"

    return {
        "finding_id": finding.id,
        "detailed_explanation": detailed_explanation,
    }


@app.post("/api/voice/focus")
async def voice_focus_command(
    request: Request,
    orch: Orchestrator = Depends(get_orchestrator),
    settings: Settings = Depends(get_settings),
) -> dict:
    """
    Endpoint for ElevenLabs voice agent to control frontend focus.
    Called when the agent wants to highlight a specific finding or change the view.

    This enables voice-to-visual synchronization where Aegis can direct the user's
    attention to specific findings as it discusses them.

    Enhanced to include presentation card data and simplified explanations.
    """
    try:
        # Get raw body for debugging
        body = await request.json()
        print(f"[VOICE FOCUS] Received request: {body}")
        logger.info(f"Received voice focus request: {body}")

        # Fix: ElevenLabs sends 'data' as a JSON string instead of an object
        # Convert string to dict if needed
        if isinstance(body.get("data"), str):
            import json
            try:
                body["data"] = json.loads(body["data"])
                logger.info(f"Converted data from string to dict: {body['data']}")
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse data JSON string: {e}")
                raise HTTPException(status_code=422, detail=f"Invalid JSON in data field: {str(e)}")

        # Parse and validate
        try:
            focus_request = VoiceFocusRequest(**body)
        except Exception as validation_error:
            logger.error(f"Validation error: {validation_error}")
            logger.error(f"Raw body was: {body}")
            raise HTTPException(status_code=422, detail=f"Invalid request format: {str(validation_error)}")

        # Auto-detect scan_id if not provided
        if not focus_request.scan_id:
            all_scans = orch.list_scans()
            if not all_scans:
                raise HTTPException(status_code=404, detail="No scans found. Please start a scan first.")
            latest_scan = max(all_scans.values(), key=lambda s: s.created_at)
            focus_request.scan_id = latest_scan.scan_id
            logger.info(f"Auto-detected scan_id: {focus_request.scan_id}")

        # Ensure data is a dict
        if focus_request.data is None:
            focus_request.data = {}

        # Prepare broadcast payload
        broadcast_payload = {
            "type": "voice_focus",
            "action": focus_request.action.value,
            "data": focus_request.data,
        }

        # Enhance payload based on action type
        if focus_request.action.value in ["show_stats", "show_summary"]:
            # Get scan status for summary/stats
            status = orch.get_status(focus_request.scan_id)
            if status:
                findings = status.findings
                broadcast_payload["card_type"] = "stats" if focus_request.action.value == "show_stats" else "summary"
                broadcast_payload["card_data"] = {
                    "status": {
                        "scan_id": status.scan_id,
                        "target": status.target,
                        "findings": [
                            {
                                "id": f.id,
                                "title": f.title,
                                "severity": f.severity.value,
                                "description": f.description,
                                "remediation": f.remediation,
                                "source_agent": f.source_agent.value,
                                "references": f.references,
                                "metadata": f.metadata,
                            }
                            for f in findings
                        ],
                        "created_at": status.created_at.isoformat(),
                    }
                }

        elif focus_request.action.value == "highlight_finding":
            # Get the specific finding and generate explanation
            finding_id = focus_request.data.get("finding_id")
            if finding_id:
                status = orch.get_status(focus_request.scan_id)
                if status:
                    # Find the matching finding
                    finding = next(
                        (f for f in status.findings if f.id.endswith(finding_id) or f.id == finding_id),
                        None
                    )

                    if finding:
                        # Generate brief explanation
                        llm_client = create_llm_client(settings)
                        brief_explanation = None

                        if llm_client:
                            explainer = FindingExplainer(llm_client)
                            try:
                                brief_explanation = await explainer.generate_brief_explanation(finding)
                            except Exception as exc:
                                logger.error(f"Failed to generate explanation: {exc}")

                        # Include finding data and presentation card info
                        broadcast_payload["card_type"] = "finding"
                        broadcast_payload["card_data"] = {
                            "finding": {
                                "id": finding.id,
                                "title": finding.title,
                                "severity": finding.severity.value,
                                "description": finding.description,
                                "remediation": finding.remediation,
                                "source_agent": finding.source_agent.value,
                                "references": finding.references,
                                "metadata": finding.metadata,
                            },
                            "brief_explanation": brief_explanation,
                        }

        # Broadcast focus command to all connected clients for this scan
        print(f"[VOICE FOCUS] Broadcasting to scan {focus_request.scan_id}: action={focus_request.action.value}, has_card={bool(broadcast_payload.get('card_type'))}")
        await ws_manager.broadcast(focus_request.scan_id, broadcast_payload)
        print(f"[VOICE FOCUS] Broadcast complete")

        return {
            "status": "success",
            "scan_id": focus_request.scan_id,
            "action": focus_request.action.value,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error broadcasting voice focus command: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to broadcast focus command: {str(e)}")


@app.get("/api/voice/scan/latest")
async def get_latest_scan_for_voice(
    orch: Orchestrator = Depends(get_orchestrator),
) -> dict:
    """
    Get the most recent scan. Useful when the agent doesn't have a specific scan_id.
    """
    # Get all scans (both in-memory and persisted) using the orchestrator's list_scans method
    all_scans = orch.list_scans()

    if not all_scans:
        return {
            "status": "not_found",
            "message": "No scans found. Please ask the user to start a security scan first.",
        }

    # Get the most recent scan by created_at timestamp
    latest_scan = max(all_scans.values(), key=lambda s: s.created_at)

    # Return the same format as get_scan_summary_for_voice
    status = latest_scan
    all_completed = all(
        p.status in ["completed", "failed", "skipped"]
        for p in status.progress
    ) if status.progress else False

    findings_by_severity = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "informational": 0,
    }

    for finding in status.findings:
        severity = finding.severity.value
        if severity in findings_by_severity:
            findings_by_severity[severity] += 1

    critical_high_findings = [
        {
            "title": f.title,
            "severity": f.severity.value,
            "description": f.description[:200] + "..." if len(f.description) > 200 else f.description,
            "remediation": f.remediation[:200] + "..." if len(f.remediation) > 200 else f.remediation,
            "agent": f.source_agent.value,
        }
        for f in status.findings
        if f.severity.value in ["critical", "high"]
    ][:5]

    agents_status = [
        {
            "agent": p.agent.value,
            "status": p.status.value,
            "message": p.message or "",
        }
        for p in status.progress
    ]

    return {
        "status": "success",
        "scan_id": status.scan_id,
        "target": status.target,
        "scan_complete": all_completed,
        "total_findings": len(status.findings),
        "findings_by_severity": findings_by_severity,
        "critical_and_high_findings": critical_high_findings,
        "agents": agents_status,
        "summary": f"Most recent scan {'completed' if all_completed else 'in progress'} for {status.target}. "
                  f"Scan ID: {status.scan_id}. "
                  f"Found {len(status.findings)} total issues: "
                  f"{findings_by_severity['critical']} critical, "
                  f"{findings_by_severity['high']} high, "
                  f"{findings_by_severity['medium']} medium, "
                  f"{findings_by_severity['low']} low, "
                  f"{findings_by_severity['informational']} informational.",
    }


@app.get("/api/voice/scan/latest/summary")
async def get_latest_scan_summary_for_voice(
    orch: Orchestrator = Depends(get_orchestrator),
) -> dict:
    """
    Get summary of the most recent scan for voice agent.
    This endpoint doesn't require a scan_id - it automatically uses the latest scan.
    """
    # Get all scans (both in-memory and persisted) using the orchestrator's list_scans method
    all_scans = orch.list_scans()

    if not all_scans:
        return {
            "status": "not_found",
            "message": "No scans found. Please start a security scan first.",
        }

    # Get the most recent scan by created_at timestamp
    latest_scan = max(all_scans.values(), key=lambda s: s.created_at)

    # Return the scan data directly without calling another function
    status = latest_scan
    all_completed = all(
        p.status in ["completed", "failed", "skipped"]
        for p in status.progress
    ) if status.progress else False

    findings_by_severity = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "informational": 0,
    }

    for finding in status.findings:
        severity = finding.severity.value
        if severity in findings_by_severity:
            findings_by_severity[severity] += 1

    critical_high_findings = [
        {
            "title": f.title,
            "severity": f.severity.value,
            "description": f.description[:200] + "..." if len(f.description) > 200 else f.description,
            "remediation": f.remediation[:200] + "..." if len(f.remediation) > 200 else f.remediation,
            "agent": f.source_agent.value,
        }
        for f in status.findings
        if f.severity.value in ["critical", "high"]
    ][:5]

    agents_status = [
        {
            "agent": p.agent.value,
            "status": p.status.value,
            "message": p.message or "",
        }
        for p in status.progress
    ]

    return {
        "status": "success",
        "scan_id": status.scan_id,
        "target": status.target,
        "scan_complete": all_completed,
        "total_findings": len(status.findings),
        "findings_by_severity": findings_by_severity,
        "critical_and_high_findings": critical_high_findings,
        "agents": agents_status,
        "summary": f"Scan {'completed' if all_completed else 'in progress'} for {status.target}. "
                  f"Found {len(status.findings)} total issues: "
                  f"{findings_by_severity['critical']} critical, "
                  f"{findings_by_severity['high']} high, "
                  f"{findings_by_severity['medium']} medium, "
                  f"{findings_by_severity['low']} low, "
                  f"{findings_by_severity['informational']} informational.",
    }


@app.get("/api/voice/scan/latest/findings")
async def get_latest_scan_findings_for_voice(
    severity: str | None = None,
    orch: Orchestrator = Depends(get_orchestrator),
    settings: Settings = Depends(get_settings),
) -> dict:
    """
    Get detailed findings from the most recent scan for voice agent.
    Optionally filter by severity (critical, high, medium, low, informational).
    This endpoint doesn't require a scan_id - it automatically uses the latest scan.

    Includes LLM-generated brief explanations for conversational voice delivery.
    """
    # Get all scans (both in-memory and persisted) using the orchestrator's list_scans method
    all_scans = orch.list_scans()

    if not all_scans:
        return {
            "status": "not_found",
            "message": "No scans found. Please start a security scan first.",
        }

    # Get the most recent scan by created_at timestamp
    status = max(all_scans.values(), key=lambda s: s.created_at)

    # Filter findings by severity if specified
    findings = status.findings
    if severity:
        findings = [f for f in findings if f.severity.value == severity.lower()]

    # Initialize LLM for generating explanations
    llm_client = create_llm_client(settings)
    explainer = FindingExplainer(llm_client) if llm_client else None

    findings_data = []
    for f in findings[:10]:  # Limit to 10 for voice delivery
        finding_data = {
            "id": f.id,
            "title": f.title,
            "severity": f.severity.value,
            "description": f.description,
            "remediation": f.remediation,
            "agent": f.source_agent.value,
        }

        # Only generate brief explanation (detailed is on-demand via separate endpoint)
        if explainer:
            try:
                brief = await explainer.generate_brief_explanation(f)
                finding_data["brief_explanation"] = brief
            except Exception as exc:
                logger.error(f"Failed to generate explanation for {f.id}: {exc}")
                finding_data["brief_explanation"] = f"This is a {f.severity.value} severity issue... {f.title}"
        else:
            finding_data["brief_explanation"] = f"This is a {f.severity.value} severity issue... {f.title}"

        findings_data.append(finding_data)

    # Generate summary speech for the findings
    summary_speech = ""
    if explainer:
        try:
            findings_by_severity = {
                "critical": len([f for f in status.findings if f.severity.value == "critical"]),
                "high": len([f for f in status.findings if f.severity.value == "high"]),
                "medium": len([f for f in status.findings if f.severity.value == "medium"]),
                "low": len([f for f in status.findings if f.severity.value == "low"]),
                "informational": len([f for f in status.findings if f.severity.value == "informational"]),
            }

            # If filtered by severity, generate specific summary
            if severity:
                summary_speech = f"Filtering for {severity} severity vulnerabilities... I have identified {len(findings)} issues that require attention... Shall we begin the walkthrough?"
            else:
                summary_speech = await explainer.generate_summary_speech(
                    total_findings=len(status.findings),
                    critical=findings_by_severity["critical"],
                    high=findings_by_severity["high"],
                    medium=findings_by_severity["medium"],
                    low=findings_by_severity["low"],
                    info=findings_by_severity["informational"],
                )
        except Exception as exc:
            logger.error(f"Failed to generate summary speech: {exc}")

    return {
        "status": "success",
        "scan_id": status.scan_id,
        "total_count": len(status.findings),
        "filtered_count": len(findings),
        "findings": findings_data,
        "summary_speech": summary_speech,  # What Aegis should say
    }


@app.get("/api/voice/scan/{scan_id}/summary")
async def get_scan_summary_for_voice(
    scan_id: str,
    orch: Orchestrator = Depends(get_orchestrator),
) -> dict:
    """
    Get scan summary in a voice-agent-friendly format.
    This endpoint is designed to be called by ElevenLabs Client Tools.
    """
    status = orch.get_status(scan_id)
    if not status:
        return {
            "status": "not_found",
            "message": "No scan found with that ID. Please ask the user to provide a valid scan ID or start a new scan.",
        }

    # Check if scan is complete
    all_completed = all(
        p.status in ["completed", "failed", "skipped"]
        for p in status.progress
    ) if status.progress else False

    # Count findings by severity
    findings_by_severity = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "informational": 0,
    }

    for finding in status.findings:
        severity = finding.severity.value
        if severity in findings_by_severity:
            findings_by_severity[severity] += 1

    # Get top critical and high findings
    critical_high_findings = [
        {
            "title": f.title,
            "severity": f.severity.value,
            "description": f.description[:200] + "..." if len(f.description) > 200 else f.description,
            "remediation": f.remediation[:200] + "..." if len(f.remediation) > 200 else f.remediation,
            "agent": f.source_agent.value,
        }
        for f in status.findings
        if f.severity.value in ["critical", "high"]
    ][:5]  # Limit to top 5

    # Get agent completion status
    agents_status = [
        {
            "agent": p.agent.value,
            "status": p.status.value,
            "message": p.message or "",
        }
        for p in status.progress
    ]

    return {
        "status": "success",
        "scan_id": scan_id,
        "target": status.target,
        "scan_complete": all_completed,
        "total_findings": len(status.findings),
        "findings_by_severity": findings_by_severity,
        "critical_and_high_findings": critical_high_findings,
        "agents": agents_status,
        "summary": f"Scan {'completed' if all_completed else 'in progress'} for {status.target}. "
                  f"Found {len(status.findings)} total issues: "
                  f"{findings_by_severity['critical']} critical, "
                  f"{findings_by_severity['high']} high, "
                  f"{findings_by_severity['medium']} medium, "
                  f"{findings_by_severity['low']} low, "
                  f"{findings_by_severity['informational']} informational.",
    }


@app.get("/api/voice/scan/{scan_id}/findings")
async def get_scan_findings_for_voice(
    scan_id: str,
    severity: str | None = None,
    orch: Orchestrator = Depends(get_orchestrator),
) -> dict:
    """
    Get detailed findings for voice agent.
    Optionally filter by severity (critical, high, medium, low, informational).
    """
    status = orch.get_status(scan_id)
    if not status:
        return {
            "status": "not_found",
            "message": "No scan found with that ID.",
        }

    findings = status.findings
    if severity:
        findings = [f for f in findings if f.severity.value == severity.lower()]

    findings_data = [
        {
            "id": f.id,
            "title": f.title,
            "severity": f.severity.value,
            "description": f.description,
            "remediation": f.remediation,
            "agent": f.source_agent.value,
        }
        for f in findings[:10]  # Limit to 10 for voice delivery
    ]

    return {
        "status": "success",
        "scan_id": scan_id,
        "total_count": len(status.findings),
        "filtered_count": len(findings),
        "findings": findings_data,
    }


@app.get("/api/voice/scans/list")
async def list_all_scans_for_voice(
    limit: int = Query(10, description="Maximum number of scans to return"),
    orch: Orchestrator = Depends(get_orchestrator),
) -> dict:
    """
    List all scans for voice agent.
    Returns scan metadata sorted by creation date (newest first).
    """
    all_scans = orch.list_scans()

    if not all_scans:
        return {
            "status": "success",
            "message": "No scans found in the database.",
            "scans": [],
            "total_count": 0,
        }

    # Sort by created_at descending (newest first)
    sorted_scans = sorted(
        all_scans.values(), key=lambda s: s.created_at, reverse=True
    )[:limit]

    scans_data = [
        {
            "scan_id": s.scan_id[:16] + "...",  # Shortened for voice
            "target": s.target,
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M"),
            "total_findings": len(s.findings),
            "critical_findings": len([f for f in s.findings if f.severity.value == "critical"]),
            "high_findings": len([f for f in s.findings if f.severity.value == "high"]),
        }
        for s in sorted_scans
    ]

    return {
        "status": "success",
        "scans": scans_data,
        "total_count": len(all_scans),
        "returned_count": len(scans_data),
    }


@app.get("/api/voice/scans/search")
async def search_scans_for_voice(
    target: str = Query(..., description="Search query for target (repository name, URL, etc.)"),
    limit: int = Query(5, description="Maximum number of results"),
    orch: Orchestrator = Depends(get_orchestrator),
) -> dict:
    """
    Search scans by target for voice agent.
    Returns matching scans sorted by creation date (newest first).
    """
    # Get database store for search functionality
    db_store = orch._results_store

    # Use the search_scans method if it exists, otherwise filter manually
    if hasattr(db_store, 'search_scans'):
        matching_scans = db_store.search_scans(target=target, limit=limit)
    else:
        # Fallback: filter all scans manually
        all_scans = orch.list_scans()
        matching_scans = [
            s for s in all_scans.values()
            if target.lower() in s.target.lower()
        ]
        matching_scans.sort(key=lambda s: s.created_at, reverse=True)
        matching_scans = matching_scans[:limit]

    if not matching_scans:
        return {
            "status": "success",
            "message": f"No scans found matching '{target}'.",
            "scans": [],
            "total_count": 0,
        }

    scans_data = [
        {
            "scan_id": s.scan_id[:16] + "...",  # Shortened for voice
            "target": s.target,
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M"),
            "total_findings": len(s.findings),
            "critical_findings": len([f for f in s.findings if f.severity.value == "critical"]),
            "high_findings": len([f for f in s.findings if f.severity.value == "high"]),
        }
        for s in matching_scans
    ]

    return {
        "status": "success",
        "query": target,
        "scans": scans_data,
        "total_count": len(scans_data),
    }


@app.post("/voice/speak", response_model=VoiceResponse)
async def relay_voice(
    request: VoiceRequest,
    settings: Settings = Depends(get_settings),
) -> VoiceResponse:
    notifier = VoiceNotifier(settings)
    if not notifier.enabled:
        raise HTTPException(status_code=503, detail="Voice agent not configured")
    try:
        relay = await notifier.speak(
            request.message,
            conversation_id=request.conversation_id,
            metadata=request.metadata or None,
        )
    except Exception as exc:  # pragma: no cover - pending ElevenLabs integration
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return VoiceResponse(success=True, relay=relay)


@app.post("/voice/scan/trigger", response_model=ScanResponse)
async def trigger_scan_from_voice(
    request: VoiceRequest,
    orch: Orchestrator = Depends(get_orchestrator),
    settings: Settings = Depends(get_settings),
) -> ScanResponse:
    """Parse voice input and start scan using LLM."""
    parser = VoiceInputParser()
    llm_client = create_llm_client(settings)

    if not llm_client:
        raise HTTPException(status_code=503, detail="LLM not configured - voice parsing requires Gemini API key")

    try:
        scan_request = await parser.parse_scan_request(request.message, llm_client)
        status = await orch.start_scan(scan_request)
        return ScanResponse(scan_id=status.scan_id, status=status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voice scan trigger failed: {str(exc)}") from exc


@app.get("/report/file/{scan_id}")
async def download_report_file(
    scan_id: str,
    format: str = Query(default="pdf", pattern="^(pdf|md)$"),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    """Stream the requested report format to the client."""
    extension = "pdf" if format == "pdf" else "md"
    reports_dir = Path(settings.results_dir) / "reports"
    file_path = reports_dir / f"{scan_id}.{extension}"

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Report not found for requested format")

    media_type = "application/pdf" if extension == "pdf" else "text/markdown"
    filename = f"aegisscan-report-{scan_id}.{extension}"
    return FileResponse(file_path, media_type=media_type, filename=filename)


async def _fetch_elevenlabs_signed_url(settings: Settings) -> str:
    """Request a signed WebSocket URL from ElevenLabs so the browser never sees the API key."""
    if not settings.elevenlabs_agent_id:
        raise HTTPException(status_code=503, detail="Voice agent not configured - missing ElevenLabs agent id")

    base_url = settings.elevenlabs_base_url.rstrip("/")
    signed_url_endpoint = f"{base_url}/v1/convai/conversation/get-signed-url"
    headers = {"xi-api-key": settings.elevenlabs_api_key or ""}
    params = {"agent_id": settings.elevenlabs_agent_id}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(signed_url_endpoint, params=params, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        logger.error("Failed to fetch ElevenLabs signed URL: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to initialize ElevenLabs voice session") from exc

    signed_url = payload.get("signed_url")
    if not signed_url:
        logger.error("Signed URL missing in ElevenLabs response: %s", payload)
        raise HTTPException(status_code=502, detail="ElevenLabs response missing signed URL")

    return signed_url


def create_app() -> FastAPI:
    return app


def run() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    run()
