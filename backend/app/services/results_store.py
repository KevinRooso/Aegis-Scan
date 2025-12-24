from __future__ import annotations

import json
from pathlib import Path
from typing import Dict

from app.schemas import ScanStatus


class ResultsStore:
    def __init__(self, base_dir: Path) -> None:
        self._base_dir = base_dir
        self._base_dir.mkdir(parents=True, exist_ok=True)

    def _status_path(self, scan_id: str) -> Path:
        return self._base_dir / f"{scan_id}.json"

    def save(self, status: ScanStatus) -> None:
        path = self._status_path(status.scan_id)
        path.write_text(status.model_dump_json(indent=2), encoding="utf-8")

    def load(self, scan_id: str) -> ScanStatus | None:
        path = self._status_path(scan_id)
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return ScanStatus.model_validate(data)

    def list_scans(self) -> Dict[str, ScanStatus]:
        statuses: Dict[str, ScanStatus] = {}
        for file in self._base_dir.glob("*.json"):
            data = json.loads(file.read_text(encoding="utf-8"))
            status = ScanStatus.model_validate(data)
            statuses[status.scan_id] = status
        return statuses
