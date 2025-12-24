"""Adaptive Agent - LLM-powered coordinator for intelligent security analysis."""

from __future__ import annotations

import json
import logging

from app.agents.base import AgentContext, BaseAgent
from app.agents.react_mixin import ReActMixin
from app.schemas import AgentName, Finding, FindingSeverity

logger = logging.getLogger(__name__)


class AdaptiveAgent(BaseAgent, ReActMixin):
    """
    Adaptive Agent uses LLM to:
    1. Analyze findings from previous agents
    2. Identify patterns and correlations
    3. Prioritize vulnerabilities
    4. Generate strategic recommendations
    """

    name = AgentName.ADAPTIVE
    display_name = "LLM Adaptive Agent"

    async def run(self, ctx: AgentContext):
        """Execute adaptive analysis with ReAct reasoning."""

        # Step 1: Generate thought about what to analyze
        thought = await self.think(
            ctx,
            objective="Analyze scan results and provide adaptive security recommendations",
            context_summary=self._build_context_summary(ctx),
        )

        # Yield the thought so orchestrator can capture it
        yield thought

        # Step 2: If no LLM available, return basic summary
        if not ctx.llm_client:
            logger.info("AdaptiveAgent: LLM not available, returning basic analysis")
            yield self._create_basic_finding(ctx)
            return

        # Step 3: Perform LLM-powered analysis
        try:
            analysis = await self._analyze_findings(ctx)

            # Step 4: Generate findings based on analysis
            yield Finding(
                id=f"{ctx.scan_id}-adaptive-analysis",
                title="Adaptive Security Analysis",
                severity=FindingSeverity.INFO,
                description=analysis.get("summary", "No analysis available"),
                remediation=analysis.get("recommendations", "Continue with standard remediation"),
                source_agent=self.name,
                metadata={
                    "llm_provider": "gemini",
                    "total_findings_analyzed": len(ctx.previous_findings),
                    "patterns": analysis.get("patterns", []),
                    "priorities": analysis.get("priorities", []),
                },
            )

        except Exception as exc:
            logger.error(f"AdaptiveAgent analysis failed: {exc}", exc_info=True)
            yield Finding(
                id=f"{ctx.scan_id}-adaptive-error",
                title="Adaptive Analysis Completed with Warnings",
                severity=FindingSeverity.INFO,
                description=f"Analysis encountered issues: {str(exc)}",
                remediation="Review findings manually",
                source_agent=self.name,
                metadata={"error": str(exc)},
            )

    def _build_context_summary(self, ctx: AgentContext) -> str:
        """Build context summary for thought generation."""
        summary_parts = [
            f"Target: {ctx.target}",
            f"Mode: {ctx.mode}",
            f"Previous findings: {len(ctx.previous_findings)}",
        ]

        if ctx.scan_metadata:
            if ctx.scan_metadata.get("github_url"):
                summary_parts.append(f"GitHub: {ctx.scan_metadata['github_url']}")
            if ctx.scan_metadata.get("target_url"):
                summary_parts.append(f"Web Target: {ctx.scan_metadata['target_url']}")

        return "\n".join(summary_parts)

    async def _analyze_findings(self, ctx: AgentContext) -> dict:
        """
        Use LLM to analyze findings and generate insights.

        Returns:
            Dictionary with analysis results including summary, patterns, and recommendations
        """
        if not ctx.previous_findings:
            return {
                "summary": "No findings from previous agents to analyze.",
                "recommendations": "Scan completed successfully with no issues detected.",
                "patterns": [],
                "priorities": [],
            }

        # Build analysis prompt
        prompt = self._build_analysis_prompt(ctx)

        # Generate analysis
        try:
            response = await ctx.llm_client.generate(
                prompt,
                temperature=0.5,  # More focused responses
                max_tokens=1000,
            )

            # Parse response (expecting JSON format)
            analysis = self._parse_analysis_response(response)
            return analysis

        except Exception as exc:
            logger.error(f"LLM analysis generation failed: {exc}")
            return {
                "summary": f"Analysis generation failed: {str(exc)}",
                "recommendations": "Review findings manually",
                "patterns": [],
                "priorities": [],
            }

    def _build_analysis_prompt(self, ctx: AgentContext) -> str:
        """Build the LLM prompt for finding analysis."""

        # Group findings by severity and agent
        findings_by_severity = {}
        findings_by_agent = {}

        for finding in ctx.previous_findings:
            # By severity
            sev = finding.severity.value
            if sev not in findings_by_severity:
                findings_by_severity[sev] = []
            findings_by_severity[sev].append(finding)

            # By agent
            agent = finding.source_agent.value
            if agent not in findings_by_agent:
                findings_by_agent[agent] = []
            findings_by_agent[agent].append(finding)

        # Build findings summary
        findings_summary = []
        for severity in ["critical", "high", "medium", "low", "informational"]:
            if severity in findings_by_severity:
                findings_summary.append(
                    f"- {severity.upper()}: {len(findings_by_severity[severity])} findings"
                )

        # Get top findings details
        critical_high = [
            f for f in ctx.previous_findings
            if f.severity in [FindingSeverity.CRITICAL, FindingSeverity.HIGH]
        ]

        top_findings_detail = "\n".join([
            f"  * {f.title} (from {f.source_agent.value}, severity: {f.severity.value})"
            for f in critical_high[:5]
        ])

        prompt = f"""You are analyzing security scan results for: {ctx.target}

**Findings Summary:**
{chr(10).join(findings_summary)}

**Top Priority Findings:**
{top_findings_detail or "No critical/high severity findings"}

**Agents that ran:**
{", ".join(findings_by_agent.keys())}

**Your Task:**
Analyze these findings and provide a strategic security assessment. Respond ONLY with valid JSON in this exact format:

{{
  "summary": "2-3 sentence executive summary of the security posture",
  "patterns": ["pattern1", "pattern2"],
  "priorities": ["priority1", "priority2", "priority3"],
  "recommendations": "Strategic recommendations for remediation"
}}

Focus on:
1. Are there patterns across different findings (e.g., multiple injection vulnerabilities)?
2. What are the highest priority issues that need immediate attention?
3. Are there systemic issues (poor input validation, weak auth, etc.)?
4. What should be addressed first for maximum security impact?

Return ONLY the JSON object, no additional text."""

        return prompt

    def _parse_analysis_response(self, response: str) -> dict:
        """Parse LLM response into structured analysis."""
        try:
            # Try to extract JSON from response
            response = response.strip()

            # Remove markdown code blocks if present
            if response.startswith("```"):
                lines = response.split("\n")
                response = "\n".join([l for l in lines if not l.startswith("```")])
                response = response.strip()

            # Try to find JSON object
            if "{" in response:
                start = response.find("{")
                end = response.rfind("}") + 1
                json_str = response[start:end]
                analysis = json.loads(json_str)

                # Validate required fields
                required_fields = ["summary", "recommendations"]
                for field in required_fields:
                    if field not in analysis:
                        analysis[field] = f"No {field} provided"

                # Ensure arrays exist
                if "patterns" not in analysis:
                    analysis["patterns"] = []
                if "priorities" not in analysis:
                    analysis["priorities"] = []

                return analysis
            else:
                raise ValueError("No JSON found in response")

        except Exception as exc:
            logger.warning(f"Failed to parse LLM response as JSON: {exc}")
            # Return the response as a summary
            return {
                "summary": response[:500],  # Truncate if too long
                "recommendations": "Review the analysis summary above",
                "patterns": [],
                "priorities": [],
            }

    def _create_basic_finding(self, ctx: AgentContext) -> Finding:
        """Create basic finding when LLM is not available."""
        return Finding(
            id=f"{ctx.scan_id}-adaptive-basic",
            title="Basic Scan Summary",
            severity=FindingSeverity.INFO,
            description=(
                f"Scan completed with {len(ctx.previous_findings)} total findings. "
                "LLM-powered analysis not available."
            ),
            remediation="Review all findings and prioritize based on severity",
            source_agent=self.name,
            metadata={
                "total_findings": len(ctx.previous_findings),
                "llm_available": False,
            },
        )

    def _describe_capabilities(self) -> str:
        """Describe what the Adaptive Agent can do."""
        return (
            "LLM-powered security analysis including finding correlation, "
            "pattern detection, vulnerability prioritization, and strategic recommendations"
        )
