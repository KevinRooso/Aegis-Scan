"""Voice input parser - Converts natural language to ScanRequest using LLM."""

from __future__ import annotations

import json
import logging

from app.schemas import ScanRequest
from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)


class VoiceInputParser:
    """
    Parses natural language voice input into structured ScanRequest.

    Uses LLM to extract:
    - GitHub repository URLs
    - Web target URLs
    - Branch names
    - Scan modes
    """

    async def parse_scan_request(
        self,
        message: str,
        llm_client: LLMClient,
    ) -> ScanRequest:
        """
        Extract scan parameters from natural language.

        Args:
            message: User's natural language message
            llm_client: LLM client for parsing

        Returns:
            Structured ScanRequest

        Raises:
            ValueError: If message cannot be parsed
        """
        prompt = f"""You are parsing a security scan request from natural language.

**User Message:**
"{message}"

**Task:**
Extract the following information and return ONLY valid JSON:

{{
  "github_url": "https://github.com/owner/repo or null",
  "target_url": "https://example.com or null",
  "branch": "branch name or main",
  "mode": "adaptive, quick, or full"
}}

**Rules:**
- If a GitHub URL is mentioned, extract it to github_url
- If a web URL is mentioned (not GitHub), extract it to target_url
- Default branch is "main" unless specified
- Default mode is "adaptive" unless user says "quick" or "full scan"
- At least one of github_url or target_url must be present
- Return ONLY the JSON object, no additional text

Examples:
- "Scan https://github.com/acme/webapp" → {{"github_url": "https://github.com/acme/webapp", "target_url": null, "branch": "main", "mode": "adaptive"}}
- "Check https://example.com for vulnerabilities" → {{"github_url": null, "target_url": "https://example.com", "branch": "main", "mode": "adaptive"}}
- "Full scan of github.com/test/api on develop branch" → {{"github_url": "https://github.com/test/api", "target_url": null, "branch": "develop", "mode": "full"}}
"""

        try:
            response = await llm_client.generate(
                prompt,
                temperature=0.3,  # More deterministic
                max_tokens=500,  # Enough for full JSON response
            )

            # Parse JSON response
            params = self._parse_json_response(response)

            # Validate and create ScanRequest
            return self._create_scan_request(params, message)

        except Exception as exc:
            logger.error(f"Voice input parsing failed: {exc}")
            raise ValueError(f"Could not parse scan request: {str(exc)}")

    def _parse_json_response(self, response: str) -> dict:
        """Extract and parse JSON from LLM response."""
        json_str = ""
        try:
            # Clean response
            response = response.strip()

            # Remove markdown code blocks if present
            if response.startswith("```"):
                lines = response.split("\n")
                response = "\n".join([l for l in lines if not l.startswith("```")])
                response = response.strip()

            # Find JSON object
            if "{" in response:
                start = response.find("{")
                end = response.rfind("}") + 1
                if end == 0:  # No closing brace found
                    raise ValueError("No closing brace found in LLM response")
                json_str = response[start:end]
                logger.debug(f"Extracted JSON string: {json_str}")
                return json.loads(json_str)
            else:
                raise ValueError("No JSON found in LLM response")

        except json.JSONDecodeError as exc:
            logger.error(f"JSON decode error: {exc}, json_str='{json_str[:200]}'")
            raise
        except Exception as exc:
            logger.error(f"Parse error: {exc}, response_preview='{response[:200]}'")
            raise

    def _create_scan_request(self, params: dict, original_message: str) -> ScanRequest:
        """
        Create ScanRequest from parsed parameters.

        Args:
            params: Parsed parameters from LLM
            original_message: Original user message

        Returns:
            ScanRequest object

        Raises:
            ValueError: If parameters are invalid
        """
        github_url = params.get("github_url")
        target_url = params.get("target_url")

        # Ensure at least one target is specified
        if not github_url and not target_url:
            raise ValueError(
                "Could not identify a target. Please specify a GitHub repository "
                "or web URL to scan."
            )

        # Clean up None/null values
        if github_url and (github_url.lower() == "null" or not github_url.strip()):
            github_url = None

        if target_url and (target_url.lower() == "null" or not target_url.strip()):
            target_url = None

        # Create request
        try:
            return ScanRequest(
                github_url=github_url,
                github_branch=params.get("branch", "main"),
                target_url=target_url,
                mode=params.get("mode", "adaptive"),
                scan_name=f"Voice scan: {original_message[:50]}",
            )
        except Exception as exc:
            logger.error(f"ScanRequest creation failed: {exc}, params={params}")
            raise ValueError(f"Invalid scan parameters: {str(exc)}")
