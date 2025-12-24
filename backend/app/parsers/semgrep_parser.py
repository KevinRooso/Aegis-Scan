from __future__ import annotations

from typing import Any, List

from app.schemas import Finding, FindingSeverity


def parse_semgrep_output(raw: dict[str, Any]) -> List[Finding]:
    """Convert Semgrep JSON output into canonical findings.

    The function currently maps a subset of the Semgrep schema. Extend this once
    the real scanner integration is available.
    """

    findings: List[Finding] = []
    for idx, result in enumerate(raw.get("results", []), start=1):
        findings.append(
            Finding(
                id=f"semgrep-{idx}",
                title=result.get("check_id", "semgrep finding"),
                severity=FindingSeverity[result.get("extra", {}).get("severity", "LOW").upper()],
                description=result.get("extra", {}).get("message", ""),
                remediation="Review code referenced by Semgrep rule.",
                source_agent="static",  # type: ignore[arg-type]
                metadata={"path": result.get("path"), "start": result.get("start")},
            )
        )
    return findings
