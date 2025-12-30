"""Finding explanation service for conversational voice agent."""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any, Dict

from app.schemas import Finding
from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)


class FindingExplainer:
    """
    Generates simplified, conversational explanations of security findings
    for the voice agent to speak naturally.
    """

    def __init__(self, llm_client: LLMClient, cache_file: str = "llm_cache.json") -> None:
        """
        Initialize the finding explainer.

        Args:
            llm_client: LLM client for generating explanations
            cache_file: Path to persistent cache file
        """
        self.llm = llm_client
        self.cache_file = Path(cache_file)
        self._cache: Dict[str, str] = self._load_cache()

    def _load_cache(self) -> Dict[str, str]:
        """Load cache from disk."""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    cache = json.load(f)
                    logger.info(f"Loaded {len(cache)} cached explanations from {self.cache_file}")
                    return cache
            except Exception as e:
                logger.error(f"Failed to load cache: {e}")
                return {}
        return {}

    def _save_cache(self) -> None:
        """Save cache to disk."""
        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(self._cache, f, indent=2, ensure_ascii=False)
            logger.debug(f"Saved {len(self._cache)} explanations to cache")
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")

    async def generate_brief_explanation(self, finding: Finding) -> str:
        """
        Generate a brief, conversational explanation of a finding.

        This is what Aegis will speak when first presenting the finding.
        It should be concise (2-3 sentences) and in plain English.

        Args:
            finding: The security finding to explain

        Returns:
            Brief conversational explanation
        """
        # Check cache first
        cache_key = f"brief_{finding.id}"
        if cache_key in self._cache:
            logger.debug(f"Using cached explanation for {finding.id}")
            return self._cache[cache_key]

        # Fallback message for when LLM fails
        fallback = f"This is a {finding.severity.value} severity issue... {finding.title}... This vulnerability could compromise your application's security."

        if not self.llm:
            return fallback

        prompt = f"""You are Aegis, a security AI assistant. A user is viewing a security finding.
Generate a BRIEF (2-3 sentences maximum) conversational explanation that I can speak to the user.

Finding Title: {finding.title}
Severity: {finding.severity.value}
Technical Description: {finding.description[:500]}

Requirements:
1. Keep it to 2-3 sentences MAX
2. Use simple, developer-friendly language (no jargon unless necessary)
3. Focus on WHAT the issue is and WHY it matters
4. Do NOT include remediation steps (user can ask for those)
5. Sound conversational and calm, like HAL 9000
6. Use "..." for natural pauses

Example format:
"This is a {finding.severity.value} severity issue... The application is vulnerable to [simple explanation]... This could allow an attacker to [impact]..."

Your brief explanation:"""

        try:
            explanation = await self.llm.generate(prompt, temperature=0.7, max_tokens=200)
            if explanation and explanation.strip():
                result = explanation.strip()
                self._cache[cache_key] = result
                self._save_cache()  # Persist to disk
                return result
            else:
                logger.warning("LLM returned empty explanation, using fallback")
                self._cache[cache_key] = fallback
                self._save_cache()
                return fallback
        except Exception as exc:
            logger.warning(f"LLM failed to generate brief explanation: {exc}, using fallback")
            self._cache[cache_key] = fallback
            self._save_cache()
            return fallback

    async def generate_detailed_explanation(self, finding: Finding) -> str:
        """
        Generate a detailed explanation when the user asks for more info.

        This includes impact analysis, attack scenarios, and remediation guidance.

        Args:
            finding: The security finding to explain

        Returns:
            Detailed conversational explanation
        """
        # Check cache first
        cache_key = f"detailed_{finding.id}"
        if cache_key in self._cache:
            logger.debug(f"Using cached detailed explanation for {finding.id}")
            return self._cache[cache_key]

        # Fallback message
        fallback = f"{finding.description}... To remediate this vulnerability... {finding.remediation}"

        if not self.llm:
            return fallback

        prompt = f"""You are Aegis, a security AI assistant. A user asked for MORE DETAILS about this finding.
Generate a detailed but conversational explanation that I can speak to the user.

Finding Title: {finding.title}
Severity: {finding.severity.value}
Technical Description: {finding.description}
Remediation: {finding.remediation}

Requirements:
1. Keep it conversational (like you're explaining to a colleague)
2. Explain the technical details in plain English
3. Describe what an attacker could do
4. Provide clear remediation steps
5. Use "..." for natural pauses between topics
6. Sound like HAL 9000 - calm, measured, analytical

Structure:
1. What this vulnerability is (more technical detail)
2. Why it's dangerous (attack scenarios)
3. How to fix it (clear steps)

Your detailed explanation:"""

        try:
            explanation = await self.llm.generate(prompt, temperature=0.7, max_tokens=500)
            if explanation and explanation.strip():
                result = explanation.strip()
                self._cache[cache_key] = result
                self._save_cache()  # Persist to disk
                return result
            else:
                logger.warning("LLM returned empty detailed explanation, using fallback")
                self._cache[cache_key] = fallback
                self._save_cache()
                return fallback
        except Exception as exc:
            logger.warning(f"LLM failed to generate detailed explanation: {exc}, using fallback")
            self._cache[cache_key] = fallback
            self._save_cache()
            return fallback

    async def generate_summary_speech(
        self,
        total_findings: int,
        critical: int,
        high: int,
        medium: int,
        low: int,
        info: int
    ) -> str:
        """
        Generate conversational speech for scan summary.

        Args:
            total_findings: Total number of findings
            critical: Number of critical findings
            high: Number of high findings
            medium: Number of medium findings
            low: Number of low findings
            info: Number of informational findings

        Returns:
            Conversational summary speech
        """
        # Fallback message (used if LLM fails or unavailable)
        priority_msg = ""
        if critical > 0:
            priority_msg = f"... {critical} are critical severity and require immediate attention"
        elif high > 0:
            priority_msg = f"... {high} are high severity and should be addressed soon"

        fallback_msg = f"The scan is complete... I have identified {total_findings} security findings{priority_msg}... Shall we examine them?"

        if not self.llm:
            return fallback_msg

        prompt = f"""You are Aegis, a security AI. Generate a BRIEF (2-3 sentences) summary of scan results to speak to the user.

Scan Results:
- Total Findings: {total_findings}
- Critical: {critical}
- High: {high}
- Medium: {medium}
- Low: {low}
- Informational: {info}

Requirements:
1. Sound like HAL 9000 - calm and analytical
2. Use "..." for pauses
3. Highlight the most important severities
4. Keep it brief (2-3 sentences)
5. End by asking if they want to examine specific findings

Example:
"The scan is complete... I have identified {total_findings} findings... [Mention critical/high if > 0]... Shall we examine the high priority issues?"

Your summary:"""

        try:
            summary = await self.llm.generate(prompt, temperature=0.7, max_tokens=150)
            if summary and summary.strip():
                result = summary.strip()
                # Don't cache summaries as they're scan-specific
                return result
            else:
                logger.warning("LLM returned empty summary, using fallback")
                return fallback_msg
        except Exception as exc:
            logger.warning(f"LLM failed to generate summary: {exc}, using fallback")
            return fallback_msg
