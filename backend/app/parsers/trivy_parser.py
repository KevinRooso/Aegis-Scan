from __future__ import annotations

from typing import Any, List

from app.schemas import Finding, FindingSeverity


SEVERITY_MAP = {
    "CRITICAL": FindingSeverity.CRITICAL,
    "HIGH": FindingSeverity.HIGH,
    "MEDIUM": FindingSeverity.MEDIUM,
    "LOW": FindingSeverity.LOW,
}


def parse_trivy_output(raw: dict[str, Any]) -> List[Finding]:
    findings: List[Finding] = []
    for result in raw.get("Results", []):
        target = result.get("Target", "unknown")
        for vuln in result.get("Vulnerabilities", []) or []:
            severity = SEVERITY_MAP.get(vuln.get("Severity", "LOW"), FindingSeverity.LOW)
            findings.append(
                Finding(
                    id=vuln.get("VulnerabilityID", "trivy"),
                    title=vuln.get("Title", "Trivy finding"),
                    severity=severity,
                    description=vuln.get("Description", ""),
                    remediation=vuln.get("PrimaryURL", "See vendor guidance"),
                    source_agent="dependency",  # type: ignore[arg-type]
                    metadata={"package": vuln.get("PkgName"), "target": target},
                )
            )
    return findings
