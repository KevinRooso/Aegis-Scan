from __future__ import annotations

import json
from typing import Any, List

from app.schemas import Finding, FindingSeverity


def parse_ffuf_output(raw: str) -> List[Finding]:
    findings: List[Finding] = []
    if not raw.strip():
        return findings

    # ffuf may emit multiple JSON blobs; use the last valid one.
    payload: dict[str, Any] | None = None
    for line in raw.strip().splitlines():
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
    if not payload:
        return findings

    for idx, result in enumerate(payload.get("results", []), start=1):
        url = result.get("url")
        length = result.get("length")
        status_code = result.get("status")
        findings.append(
            Finding(
                id=f"ffuf-{idx}",
                title=f"Discovered path: {url}",
                severity=FindingSeverity.MEDIUM,
                description="ffuf discovered a reachable endpoint while fuzzing",
                remediation="Ensure sensitive paths enforce authentication and rate limiting.",
                source_agent="fuzzer",  # type: ignore[arg-type]
                metadata={
                    "url": url,
                    "status": status_code,
                    "length": length,
                },
            )
        )
    return findings
