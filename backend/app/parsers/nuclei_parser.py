from __future__ import annotations

import json
from typing import Any, Iterable, List

from app.schemas import Finding, FindingSeverity


def _iter_entries(raw: Any) -> Iterable[dict[str, Any]]:
    if isinstance(raw, list):
        yield from raw
    elif isinstance(raw, str):
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue
    else:
        return


def parse_nuclei_output(raw: Any) -> List[Finding]:
    findings: List[Finding] = []
    for idx, entry in enumerate(_iter_entries(raw), start=1):
        info = entry.get("info", {})
        findings.append(
            Finding(
                id=entry.get("template-id", f"nuclei-{idx}"),
                title=info.get("name", "Nuclei finding"),
                severity=FindingSeverity[info.get("severity", "low").upper()],
                description=info.get("description", ""),
                remediation="Review template references and patch affected service.",
                source_agent="template",  # type: ignore[arg-type]
                metadata={"matched-at": entry.get("matched-at")},
            )
        )
    return findings
