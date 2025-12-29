"""Service to generate detailed explanations for security findings."""

from __future__ import annotations

import json
import logging
from typing import Optional

from app.schemas import Finding, FindingSeverity
from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)


class FindingExplainer:
    """Generates detailed, voice-friendly explanations for findings."""

    def __init__(self, llm_client: LLMClient | None = None):
        self.llm_client = llm_client

    async def enrich_finding(self, finding: Finding) -> dict:
        """
        Add voice-friendly explanation fields to a finding.

        Returns enriched finding with:
        - plain_language_summary: Simple explanation
        - risk_explanation: What could go wrong
        - remediation_steps: Step-by-step fix instructions
        """

        # Try to use LLM for intelligent explanation
        if self.llm_client and self.llm_client.is_available():
            try:
                return await self._generate_llm_explanation(finding)
            except Exception as e:
                logger.warning(f"LLM explanation failed for {finding.id}, using template: {e}")

        # Fallback to template-based explanation
        return self._generate_template_explanation(finding)

    async def _generate_llm_explanation(self, finding: Finding) -> dict:
        """Use LLM to generate detailed explanation."""

        prompt = f"""You are explaining a security vulnerability to a developer.
Be clear, educational, and actionable. Focus on clarity over technical jargon.

**Finding:**
Title: {finding.title}
Severity: {finding.severity.value}
Description: {finding.description}
Remediation: {finding.remediation}

**Generate a voice-friendly explanation with these sections:**

1. SUMMARY (2-3 sentences): Explain what this vulnerability is in simple terms.
   Avoid pure technical jargon. Make it understandable.

2. RISK (2-3 sentences): Explain what an attacker could do and the real-world impact.
   Focus on consequences, not just technical details.

3. FIX_STEPS (3-5 bullet points): Clear, ordered, actionable steps to remediate.
   Each step should be a complete instruction.

**Return ONLY valid JSON in this exact format:**
{{
  "summary": "Clear explanation of what the vulnerability is...",
  "risk": "Explanation of what could happen and the impact...",
  "fix_steps": [
    "First step to fix the issue...",
    "Second step to fix the issue...",
    "Third step to fix the issue..."
  ]
}}

**Important**: Return ONLY the JSON object, no additional text or markdown.
"""

        try:
            response = await self.llm_client.generate(prompt, temperature=0.3, max_tokens=500)

            # Check for empty or error response
            if not response or not response.strip():
                logger.warning("Empty response from LLM, using template fallback")
                raise ValueError("Empty LLM response")

            # Parse JSON response
            explanation = self._parse_llm_response(response)
        except Exception as exc:
            logger.warning(f"LLM generation failed: {exc}, using template fallback")
            raise

        return {
            "finding_id": finding.id,
            "title": finding.title,
            "severity": finding.severity.value,
            "plain_language_summary": explanation.get("summary", finding.description[:200]),
            "risk_explanation": explanation.get("risk", "Risk assessment requires manual review"),
            "remediation_steps": explanation.get("fix_steps", [finding.remediation]),
            "technical_description": finding.description,
            "remediation": finding.remediation,
            "references": finding.references,
            "source_agent": finding.source_agent.value,
            "metadata": finding.metadata,
        }

    def _parse_llm_response(self, response: str) -> dict:
        """Parse LLM response, handling various formats."""
        try:
            # Clean up response
            response = response.strip()

            # Remove markdown code blocks if present
            if response.startswith("```"):
                lines = response.split("\n")
                # Remove first and last lines (```)
                response = "\n".join([l for l in lines if not l.startswith("```")])
                response = response.strip()

            # Try to find JSON object
            if "{" in response:
                start = response.find("{")
                end = response.rfind("}") + 1
                json_str = response[start:end]
                explanation = json.loads(json_str)

                # Validate and set defaults
                if "summary" not in explanation:
                    explanation["summary"] = "Detailed analysis unavailable"
                if "risk" not in explanation:
                    explanation["risk"] = "Risk assessment requires manual review"
                if "fix_steps" not in explanation or not isinstance(explanation["fix_steps"], list):
                    explanation["fix_steps"] = ["Review the vulnerability and apply appropriate fixes"]

                return explanation
            else:
                raise ValueError("No JSON found in response")

        except Exception as exc:
            logger.warning(f"Failed to parse LLM response as JSON: {exc}")
            logger.debug(f"Raw response was: {response[:500]}")
            return {
                "summary": "Analysis unavailable - please review the technical description",
                "risk": "Risk assessment requires manual review",
                "fix_steps": ["Review the vulnerability and apply appropriate fixes"],
            }

    def _generate_template_explanation(self, finding: Finding) -> dict:
        """Generate explanation using templates when LLM unavailable."""

        # Severity descriptions
        severity_map = {
            FindingSeverity.CRITICAL: ("critical and immediately exploitable", "critical"),
            FindingSeverity.HIGH: ("serious and requires urgent attention", "high"),
            FindingSeverity.MEDIUM: ("moderate and should be addressed soon", "medium"),
            FindingSeverity.LOW: ("low priority but should be reviewed", "low"),
            FindingSeverity.INFO: ("informational and requires review", "informational"),
        }

        severity_desc, severity_word = severity_map.get(
            finding.severity,
            ("requires attention", "notable")
        )

        # Generate simple summary
        # Extract first sentence or first 150 chars
        desc_first_sentence = finding.description.split(".")[0] if "." in finding.description else finding.description
        summary = f"This is a {severity_word} severity security issue. {desc_first_sentence[:150]}"

        # Generate risk explanation
        if finding.severity in [FindingSeverity.CRITICAL, FindingSeverity.HIGH]:
            risk = (
                f"This vulnerability is {severity_desc}. "
                f"An attacker could potentially exploit this to compromise the security of your application. "
                f"Immediate attention is recommended to prevent potential security breaches."
            )
        elif finding.severity == FindingSeverity.MEDIUM:
            risk = (
                f"This issue is {severity_desc}. "
                f"While not immediately critical, it represents a security weakness that should be addressed "
                f"to maintain a strong security posture."
            )
        else:
            risk = (
                f"This finding is {severity_desc}. "
                f"While it may not pose an immediate threat, addressing it will improve the overall "
                f"security and quality of your application."
            )

        # Parse remediation into steps
        remediation_steps = self._parse_remediation_steps(finding.remediation)

        return {
            "finding_id": finding.id,
            "title": finding.title,
            "severity": finding.severity.value,
            "plain_language_summary": summary,
            "risk_explanation": risk,
            "remediation_steps": remediation_steps,
            "technical_description": finding.description,
            "remediation": finding.remediation,
            "references": finding.references,
            "source_agent": finding.source_agent.value,
            "metadata": finding.metadata,
        }

    def _parse_remediation_steps(self, remediation: str) -> list[str]:
        """Parse remediation text into ordered steps."""

        if not remediation:
            return ["Review the vulnerability details and apply appropriate fixes"]

        # Check if already has numbered list
        lines = remediation.split("\n")
        numbered_lines = [l.strip() for l in lines if l.strip() and l.strip()[0].isdigit()]

        if numbered_lines and len(numbered_lines) >= 2:
            # Already formatted as numbered list
            return [self._clean_step(line) for line in numbered_lines[:5]]

        # Check for bullet points
        bullet_lines = [l.strip() for l in lines if l.strip() and l.strip().startswith(("- ", "* ", "• "))]

        if bullet_lines and len(bullet_lines) >= 2:
            # Has bullet points
            return [self._clean_step(line.lstrip("- *•").strip()) for line in bullet_lines[:5]]

        # If it's a URL or contains URLs, don't split it
        if remediation.startswith(("http://", "https://", "www.")) or "://" in remediation:
            # It's primarily a URL reference
            return [remediation.strip()]

        # Split by sentences, but be careful with URLs
        # Use regex to split on ". " (period followed by space) to avoid breaking URLs
        import re
        sentences = re.split(r'\.\s+', remediation)
        sentences = [s.strip() for s in sentences if s.strip()]

        if len(sentences) <= 1:
            # Single sentence or short text
            result = remediation.strip()
            if not result.endswith(('.', '!', '?')):
                result += '.'
            return [result]

        # Return first 5 sentences as steps
        return [f"{s}." if not s.endswith(('.', '!', '?')) else s for s in sentences[:5]]

    def _clean_step(self, step: str) -> str:
        """Clean up a step string."""
        # Remove leading numbers and dots
        import re
        step = re.sub(r"^\d+\.\s*", "", step)
        step = step.strip()

        # Ensure it ends with period if it doesn't have other punctuation
        if step and step[-1] not in ".!?":
            step = f"{step}."

        return step
