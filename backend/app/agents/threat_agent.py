"""Threat Agent - Prioritizes and deduplicates security findings."""

from __future__ import annotations

import logging
from collections import Counter

from app.agents.base import AgentContext, BaseAgent
from app.agents.react_mixin import ReActMixin
from app.schemas import AgentName, Finding, FindingSeverity

logger = logging.getLogger(__name__)


class ThreatAgent(BaseAgent, ReActMixin):
    """
    Threat Agent performs:
    1. Finding deduplication across different scanners
    2. Severity-based prioritization
    3. CVSS scoring (future enhancement)
    4. Attack surface analysis
    """

    name = AgentName.THREAT
    display_name = "Threat Prioritization"

    def __init__(self) -> None:
        super().__init__(tool_launcher=None)

    async def run(self, ctx: AgentContext):
        """Execute threat prioritization with ReAct reasoning."""

        # Step 1: Generate thought about prioritization strategy
        thought = await self.think(
            ctx,
            objective="Prioritize security threats and identify attack vectors",
            context_summary=f"Analyzing {len(ctx.previous_findings)} findings",
        )

        # Yield the thought
        yield thought

        # Step 2: Analyze findings
        if not ctx.previous_findings:
            yield Finding(
                id=f"{ctx.scan_id}-threat-none",
                title="No Threats Identified",
                severity=FindingSeverity.INFO,
                description="Scan completed with no security findings to prioritize.",
                remediation="Continue regular security monitoring",
                source_agent=self.name,
                metadata={"total_findings": 0},
            )
            return

        # Step 3: Perform deduplication and prioritization
        severity_counts = Counter(f.severity for f in ctx.previous_findings)
        agent_counts = Counter(f.source_agent for f in ctx.previous_findings)

        # Deduplicate similar findings
        deduplicated = self._deduplicate_findings(ctx.previous_findings)
        duplicates_removed = len(ctx.previous_findings) - len(deduplicated)

        # Get critical/high findings
        critical_high = [
            f for f in ctx.previous_findings
            if f.severity in [FindingSeverity.CRITICAL, FindingSeverity.HIGH]
        ]

        # Build priority recommendations
        priority_message = self._build_priority_message(
            severity_counts, critical_high, duplicates_removed
        )

        # Step 4: Use LLM for advanced prioritization if available
        llm_insights = {}
        if ctx.llm_client and critical_high:
            try:
                llm_insights = await self._generate_threat_insights(ctx, critical_high)
            except Exception as exc:
                logger.warning(f"LLM threat insights failed: {exc}")

        # Step 5: Generate threat prioritization finding
        yield Finding(
            id=f"{ctx.scan_id}-threat-priority",
            title="Threat Prioritization Analysis",
            severity=FindingSeverity.INFO,
            description=priority_message,
            remediation=llm_insights.get(
                "remediation_order",
                "Address Critical and High severity issues first, then Medium and Low."
            ),
            source_agent=self.name,
            metadata={
                "total_findings": len(ctx.previous_findings),
                "unique_findings": len(deduplicated),
                "duplicates_removed": duplicates_removed,
                "critical_count": severity_counts.get(FindingSeverity.CRITICAL, 0),
                "high_count": severity_counts.get(FindingSeverity.HIGH, 0),
                "medium_count": severity_counts.get(FindingSeverity.MEDIUM, 0),
                "low_count": severity_counts.get(FindingSeverity.LOW, 0),
                "by_agent": dict(agent_counts),
                "attack_vectors": llm_insights.get("attack_vectors", []),
            },
        )

    def _deduplicate_findings(self, findings: list[Finding]) -> list[Finding]:
        """
        Remove duplicate findings based on title similarity.

        In a fuller implementation this would use fuzzy matching,
        semantic similarity, or LLM-based deduplication.
        """
        seen_titles = set()
        unique = []

        for finding in findings:
            # Simple deduplication by exact title match
            title_key = (finding.title.lower(), finding.source_agent)
            if title_key not in seen_titles:
                seen_titles.add(title_key)
                unique.append(finding)

        return unique

    def _build_priority_message(
        self,
        severity_counts: Counter,
        critical_high: list[Finding],
        duplicates_removed: int,
    ) -> str:
        """Build priority message for the finding."""

        severity_summary = []
        for severity in [FindingSeverity.CRITICAL, FindingSeverity.HIGH,
                        FindingSeverity.MEDIUM, FindingSeverity.LOW]:
            count = severity_counts.get(severity, 0)
            if count > 0:
                severity_summary.append(f"{severity.value.upper()}: {count}")

        summary_text = ", ".join(severity_summary) if severity_summary else "No findings"

        message_parts = [f"Threat analysis complete. Findings: {summary_text}."]

        if duplicates_removed > 0:
            message_parts.append(f"{duplicates_removed} duplicate findings removed.")

        if critical_high:
            message_parts.append(
                f"{len(critical_high)} high-priority issues require immediate attention."
            )

            # List top 3 critical/high findings
            top_threats = "\n".join([
                f"- {f.title} (from {f.source_agent.value})"
                for f in critical_high[:3]
            ])
            message_parts.append(f"\nTop threats:\n{top_threats}")

        return " ".join(message_parts)

    async def _generate_threat_insights(
        self,
        ctx: AgentContext,
        critical_high: list[Finding],
    ) -> dict:
        """Use LLM to generate threat prioritization insights."""

        # Build prompt
        findings_list = "\n".join([
            f"- {f.title} ({f.severity.value}): {f.description[:100]}"
            for f in critical_high[:10]
        ])

        prompt = f"""You are analyzing security threats for: {ctx.target}

**Critical/High Severity Findings:**
{findings_list}

**Task:**
Analyze these threats and provide:
1. The most likely attack vectors
2. Recommended remediation order (which to fix first and why)

Be concise. Respond in 2-3 sentences."""

        try:
            response = await ctx.llm_client.generate(
                prompt,
                temperature=0.6,
                max_tokens=300,
            )

            return {
                "attack_vectors": self._extract_attack_vectors(response),
                "remediation_order": response.strip(),
            }

        except Exception as exc:
            logger.error(f"LLM threat insights generation failed: {exc}")
            return {}

    def _extract_attack_vectors(self, llm_response: str) -> list[str]:
        """Extract attack vector keywords from LLM response."""
        # Simple keyword extraction - in production use NLP
        keywords = [
            "injection", "xss", "csrf", "auth", "authentication",
            "authorization", "sql", "command", "file upload",
            "path traversal", "ssrf", "deserialization"
        ]

        found_vectors = []
        response_lower = llm_response.lower()

        for keyword in keywords:
            if keyword in response_lower:
                found_vectors.append(keyword)

        return found_vectors[:5]  # Top 5

    def _describe_capabilities(self) -> str:
        """Describe what the Threat Agent can do."""
        return (
            "Threat prioritization including deduplication, severity analysis, "
            "and attack vector identification"
        )
