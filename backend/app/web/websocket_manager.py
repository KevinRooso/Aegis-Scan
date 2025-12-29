from __future__ import annotations

import asyncio
import logging
from typing import Dict, List

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebsocketManager:
    def __init__(self) -> None:
        self._connections: Dict[str, List[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, scan_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(scan_id, []).append(websocket)

    async def disconnect(self, scan_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            conns = self._connections.get(scan_id, [])
            if websocket in conns:
                conns.remove(websocket)
            if not conns and scan_id in self._connections:
                self._connections.pop(scan_id)

    async def broadcast(self, scan_id: str, payload: dict) -> None:
        async with self._lock:
            conns = list(self._connections.get(scan_id, []))
        logger.info(f"Broadcasting to {len(conns)} WebSocket clients for scan {scan_id}: {payload.get('type', 'unknown')}")
        for conn in conns:
            try:
                await conn.send_json(payload)
                logger.debug(f"Sent message to WebSocket client")
            except Exception as e:
                logger.error(f"Failed to send WebSocket message: {e}")

    async def broadcast_voice_event(self, scan_id: str, event: Any) -> None:
        """
        Broadcast a voice event to frontend for UI sync.

        Args:
            scan_id: Scan identifier
            event: VoiceEvent object
        """
        await self.broadcast(scan_id, {
            "type": "voice_event",
            "event": event.model_dump(mode="json") if hasattr(event, "model_dump") else event,
        })
