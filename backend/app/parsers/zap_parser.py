from __future__ import annotations

from typing import Any, List

from app.schemas import Finding, FindingSeverity

SEVERITY_MAP = {
    "high": FindingSeverity.HIGH,
    "medium": FindingSeverity.MEDIUM,
    "low": FindingSeverity.LOW,
    "informational": FindingSeverity.INFO,
}


def parse_zap_output(raw: dict[str, Any]) -> List[Finding]:
    findings: List[Finding] = []
    for site in raw.get("site", []):
        site_name = site.get("@name") or site.get("name")
        for alert in site.get("alerts", []):
            risk = alert.get("riskcode") or alert.get("riskdesc", "").split()[0].lower()
            severity = SEVERITY_MAP.get(str(risk).lower(), FindingSeverity.MEDIUM)
            findings.append(
                Finding(
                    id=alert.get("pluginid", "zap"),
                    title=alert.get("alert", "ZAP finding"),
                    severity=severity,
                    description=alert.get("desc", ""),
                    remediation=alert.get("solution", "See ZAP recommendation"),
                    source_agent="dast",  # type: ignore[arg-type]
                    metadata={
                        "site": site_name,
                        "reference": alert.get("reference"),
                        "cweid": alert.get("cweid"),
                    },
                )
            )
    return findings
