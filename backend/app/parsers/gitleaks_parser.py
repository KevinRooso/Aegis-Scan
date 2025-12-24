from __future__ import annotations

from typing import Any, Iterable, List

from app.schemas import Finding, FindingSeverity


def parse_gitleaks_output(raw: Iterable[dict[str, Any]]) -> List[Finding]:
    findings: List[Finding] = []
    for idx, entry in enumerate(raw, start=1):
        rule = entry.get("rule", "gitleaks finding")
        description = entry.get("description", "")
        file = entry.get("file", "unknown")
        line = entry.get("line", 0)
        findings.append(
            Finding(
                id=f"gitleaks-{idx}",
                title=rule,
                severity=FindingSeverity.CRITICAL,
                description=description or "Secret detected by gitleaks",
                remediation="Rotate the credential and add secret scanning pre-commit hooks.",
                source_agent="secret",  # type: ignore[arg-type]
                metadata={
                    "file": file,
                    "line": line,
                    "rule": rule,
                },
            )
        )
    return findings
