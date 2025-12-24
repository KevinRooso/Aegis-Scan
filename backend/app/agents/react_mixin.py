"""ReAct (Reasoning + Acting) mixin for agent intelligence."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.agents.base import AgentContext
from app.schemas import AgentThought

logger = logging.getLogger(__name__)


class ReActMixin:
    """
    Mixin class that adds ReAct (Reasoning + Acting) capability to agents.

    The ReAct framework enables agents to:
    1. Think: Use LLM to reason about the current context and plan actions
    2. Act: Execute the planned actions using tools
    3. Observe: Collect results and feed them back into reasoning

    This implementation focuses on the "Think" step before acting.
    """

    async def think(
        self,
        ctx: AgentContext,
        objective: str,
        context_summary: str = "",
    ) -> AgentThought:
        """
        Generate reasoning using LLM before acting.

        Args:
            ctx: Agent context with LLM client and previous findings
            objective: What this agent aims to accomplish
            context_summary: Optional summary of relevant context

        Returns:
            AgentThought with LLM-generated reasoning and action plan
        """
        if not ctx.llm_client:
            # Fallback: no LLM available, return placeholder thought
            logger.debug(f"{self.name}: LLM not available, skipping thought generation")
            return AgentThought(
                agent=self.name,
                thought="LLM not available - proceeding with standard execution",
                action_plan=objective,
                timestamp=datetime.now(timezone.utc),
            )

        try:
            # Build prompt with context
            prompt = self._build_thought_prompt(ctx, objective, context_summary)

            # Generate thought using LLM
            logger.debug(f"{self.name}: Generating thought with LLM")
            thought_text = await ctx.llm_client.generate(
                prompt,
                temperature=0.7,
                max_tokens=500,
            )

            return AgentThought(
                agent=self.name,
                thought=thought_text,
                action_plan=objective,
                timestamp=datetime.now(timezone.utc),
            )

        except Exception as exc:
            logger.warning(f"{self.name}: Failed to generate thought: {exc}")
            # Fallback to basic thought
            return AgentThought(
                agent=self.name,
                thought=f"Thought generation failed: {str(exc)}",
                action_plan=objective,
                timestamp=datetime.now(timezone.utc),
            )

    def _build_thought_prompt(
        self,
        ctx: AgentContext,
        objective: str,
        context_summary: str,
    ) -> str:
        """
        Construct the LLM prompt for thought generation.

        Args:
            ctx: Agent context
            objective: What the agent aims to accomplish
            context_summary: Summary of relevant context

        Returns:
            Formatted prompt for the LLM
        """
        # Summarize previous findings if any
        findings_summary = self._summarize_findings(ctx.previous_findings)

        # Get agent-specific capabilities
        capabilities = self._describe_capabilities()

        prompt = f"""You are the {self.display_name} agent in a security scanning system.

**Your Objective**: {objective}

**Your Capabilities**: {capabilities}

**Scan Context**:
- Target: {ctx.target}
- Mode: {ctx.mode}
- Previous findings: {len(ctx.previous_findings)} findings from other agents
{context_summary}

**Previous Findings Summary**:
{findings_summary or "No previous findings yet."}

**Task**: Based on the context above, reason about:
1. What specific actions should you take?
2. Are there patterns or insights from previous findings that inform your approach?
3. What are the highest priority areas to focus on?
4. What potential issues should you watch for?

Provide your reasoning in 2-3 concise paragraphs."""

        return prompt

    def _summarize_findings(self, findings: list) -> str:
        """
        Create a concise summary of previous findings.

        Args:
            findings: List of Finding objects

        Returns:
            Text summary of findings by severity
        """
        if not findings:
            return ""

        from collections import Counter

        from app.schemas import FindingSeverity

        # Count by severity
        severity_counts = Counter(f.severity for f in findings)

        # Group critical/high findings
        critical_high = [
            f for f in findings if f.severity in [FindingSeverity.CRITICAL, FindingSeverity.HIGH]
        ]

        summary_parts = [
            f"Total: {len(findings)} findings",
            f"Critical: {severity_counts.get(FindingSeverity.CRITICAL, 0)}",
            f"High: {severity_counts.get(FindingSeverity.HIGH, 0)}",
            f"Medium: {severity_counts.get(FindingSeverity.MEDIUM, 0)}",
        ]

        summary = ", ".join(summary_parts)

        # Add details for critical/high findings
        if critical_high:
            top_findings = "\n".join(
                [f"- {f.title} (from {f.source_agent})" for f in critical_high[:3]]
            )
            summary += f"\n\nTop priority findings:\n{top_findings}"

        return summary

    def _describe_capabilities(self) -> str:
        """
        Describe what this agent can do.

        Override in specific agents for more detailed descriptions.

        Returns:
            Text description of agent capabilities
        """
        # Default generic description
        return f"Security analysis using {self.display_name}"

    def _summarize_findings_for_agent(self, ctx: AgentContext) -> str:
        """
        Create a context summary tailored for this specific agent.

        Override in specific agents to highlight relevant findings.

        Args:
            ctx: Agent context with previous findings

        Returns:
            Agent-specific context summary
        """
        return self._summarize_findings(ctx.previous_findings)
