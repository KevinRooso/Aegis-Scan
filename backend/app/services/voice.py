"""Voice notification service using ElevenLabs for HAL 9000-style narration."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict

import httpx

from app.config import Settings
from app.schemas import AgentThought, Finding, VoiceEvent, VoiceEventType

logger = logging.getLogger(__name__)


class VoiceNotifier:
    """
    Voice notification service for Aegis security scanner.

    Provides HAL 9000-style voice narration throughout the scan lifecycle.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def enabled(self) -> bool:
        """Check if voice notifications are enabled."""
        return bool(self._settings.elevenlabs_api_key and self._settings.elevenlabs_agent_id)

    async def speak(
        self,
        message: str,
        *,
        conversation_id: str | None = None,
        metadata: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """
        Send a message to ElevenLabs for voice synthesis.

        Args:
            message: Text to speak
            conversation_id: Optional conversation ID for context
            metadata: Optional metadata for the message

        Returns:
            Response data from ElevenLabs API
        """
        if not self.enabled:
            logger.debug("Voice agent disabled; message=%s", message)
            return {"status": "disabled"}

        payload: Dict[str, Any] = {
            "agent_id": self._settings.elevenlabs_agent_id,
            "input_text": message,
        }
        print(f"Payload: {payload}")
        if conversation_id:
            payload["conversation_id"] = conversation_id
        if metadata:
            payload["metadata"] = metadata

        headers = {
            "xi-api-key": self._settings.elevenlabs_api_key or "",
            "Content-Type": "application/json",
        }
        url = f"{self._settings.elevenlabs_base_url.rstrip('/')}/v1/convai/conversation"

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                logger.info("[Aegis Voice] %s", message[:100])
                return data
        except Exception as exc:
            logger.error(f"Voice synthesis failed: {exc}")
            return {"status": "error", "error": str(exc)}

    async def narrate_greeting(self, scan_id: str) -> VoiceEvent:
        """
        Initial greeting when voice agent session starts.

        Args:
            scan_id: Scan identifier

        Returns:
            VoiceEvent for the greeting
        """
        message = (
            "Good evening. I am Aegis, your security sentinel. "
            "Please provide the target for analysis."
        )

        if self.enabled:
            await self.speak(message, conversation_id=scan_id)

        return VoiceEvent(
            scan_id=scan_id,
            event_type=VoiceEventType.GREETING,
            message=message,
            timestamp=datetime.now(timezone.utc),
            metadata={},
        )

    async def narrate_agent_start(self, agent_name: str, scan_id: str) -> VoiceEvent:
        """
        Announce when an agent begins execution.

        Args:
            agent_name: Display name of the agent
            scan_id: Scan identifier

        Returns:
            VoiceEvent for agent start
        """
        message = f"Initiating {agent_name} analysis."

        if self.enabled:
            await self.speak(
                message,
                conversation_id=scan_id,
                metadata={"agent": agent_name},
            )

        return VoiceEvent(
            scan_id=scan_id,
            event_type=VoiceEventType.AGENT_START,
            message=message,
            timestamp=datetime.now(timezone.utc),
            metadata={"agent": agent_name},
        )

    async def narrate_finding(self, finding: Finding, scan_id: str) -> VoiceEvent:
        """
        Narrate critical/high severity findings in real-time.

        Args:
            finding: The security finding
            scan_id: Scan identifier

        Returns:
            VoiceEvent for the finding
        """
        message = f"{finding.severity.value.capitalize()} severity issue detected: {finding.title}"

        if self.enabled:
            await self.speak(
                message,
                conversation_id=scan_id,
                metadata={
                    "finding_id": finding.id,
                    "severity": finding.severity.value,
                    "agent": finding.source_agent.value,
                },
            )

        return VoiceEvent(
            scan_id=scan_id,
            event_type=VoiceEventType.FINDING,
            message=message,
            timestamp=datetime.now(timezone.utc),
            metadata={
                "finding_id": finding.id,
                "severity": finding.severity.value,
                "title": finding.title,
            },
        )

    async def narrate_thought(self, thought: AgentThought, scan_id: str) -> VoiceEvent:
        """
        Narrate agent reasoning (ReAct thoughts).

        Args:
            thought: The agent's reasoning
            scan_id: Scan identifier

        Returns:
            VoiceEvent for the thought
        """
        # Truncate thought for narration
        thought_preview = thought.thought[:150]
        if len(thought.thought) > 150:
            thought_preview += "..."

        message = f"Analysis in progress: {thought_preview}"

        if self.enabled:
            await self.speak(
                message,
                conversation_id=scan_id,
                metadata={
                    "agent": thought.agent.value,
                    "full_thought": thought.thought,
                },
            )

        return VoiceEvent(
            scan_id=scan_id,
            event_type=VoiceEventType.THINKING,
            message=message,
            timestamp=datetime.now(timezone.utc),
            metadata={
                "agent": thought.agent.value,
                "thought": thought.thought,
            },
        )

    async def narrate_completion(
        self,
        scan_id: str,
        findings_count: int,
        target: str,
    ) -> VoiceEvent:
        """
        Final summary narration when scan completes.

        Args:
            scan_id: Scan identifier
            findings_count: Total number of findings
            target: Scan target

        Returns:
            VoiceEvent for completion
        """
        if findings_count == 0:
            message = f"Scan complete. No security findings detected for {target}."
        elif findings_count == 1:
            message = f"Scan complete. One security finding identified for {target}."
        else:
            message = f"Scan complete. {findings_count} security findings identified for {target}."

        if self.enabled:
            await self.speak(
                message,
                conversation_id=scan_id,
                metadata={
                    "total_findings": findings_count,
                    "target": target,
                },
            )

        return VoiceEvent(
            scan_id=scan_id,
            event_type=VoiceEventType.COMPLETION,
            message=message,
            timestamp=datetime.now(timezone.utc),
            metadata={
                "total_findings": findings_count,
                "target": target,
            },
        )
