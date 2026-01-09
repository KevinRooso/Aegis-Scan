from __future__ import annotations

from typing import Any, List

from app.schemas import Finding, FindingSeverity


def parse_semgrep_output(raw: dict[str, Any]) -> List[Finding]:
    """Convert Semgrep JSON output into canonical findings.

    The function currently maps a subset of the Semgrep schema. Extend this once
    the real scanner integration is available.
    """

    # Semgrep severity mapping (handles ERROR and other non-standard severities)
    SEVERITY_MAP = {
        "CRITICAL": FindingSeverity.CRITICAL,
        "HIGH": FindingSeverity.HIGH,
        "MEDIUM": FindingSeverity.MEDIUM,
        "LOW": FindingSeverity.LOW,
        "INFO": FindingSeverity.INFO,
        "INFORMATIONAL": FindingSeverity.INFO,
        "ERROR": FindingSeverity.HIGH,  # Map ERROR to HIGH severity
        "WARNING": FindingSeverity.MEDIUM,  # Map WARNING to MEDIUM
    }

    findings: List[Finding] = []
    for idx, result in enumerate(raw.get("results", []), start=1):
        raw_severity = result.get("extra", {}).get("severity", "LOW").upper()
        severity = SEVERITY_MAP.get(raw_severity, FindingSeverity.LOW)

        findings.append(
            Finding(
                id=f"semgrep-{idx}",
                title=result.get("check_id", "semgrep finding"),
                severity=severity,
                description=result.get("extra", {}).get("message", ""),
                remediation="Review code referenced by Semgrep rule.",
                source_agent="static",  # type: ignore[arg-type]
                metadata={"path": result.get("path"), "start": result.get("start")},
            )
        )
    return findings
