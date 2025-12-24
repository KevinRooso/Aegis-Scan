"""Report Agent - Generates professional security scan reports with enhanced PDF."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from textwrap import wrap

import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle
import io

from app.agents.base import AgentContext, BaseAgent
from app.agents.react_mixin import ReActMixin
from app.schemas import AgentName, Finding, FindingSeverity

logger = logging.getLogger(__name__)


class ReportAgent(BaseAgent, ReActMixin):
    """
    Report Agent generates:
    1. Executive summary of findings
    2. Detailed vulnerability breakdown
    3. Remediation recommendations
    4. Risk assessment
    """

    name = AgentName.REPORT
    display_name = "Reporting Agent"

    def __init__(self, *, reports_dir: Path) -> None:
        super().__init__(simulate_duration=0.5)
        self._reports_dir = reports_dir
        self._reports_dir.mkdir(parents=True, exist_ok=True)

    async def run(self, ctx: AgentContext):
        """Execute report generation with ReAct reasoning."""

        # Step 1: Generate thought about report structure
        thought = await self.think(
            ctx,
            objective="Generate comprehensive security scan report",
            context_summary=f"Summarizing {len(ctx.previous_findings)} findings",
        )

        # Yield the thought
        yield thought

        # Step 2: Generate report
        report_path = self._reports_dir / f"{ctx.scan_id}.md"
        pdf_path = self._reports_dir / f"{ctx.scan_id}.pdf"

        try:
            # Generate report content
            if ctx.llm_client and ctx.previous_findings:
                # LLM-enhanced report
                report_content = await self._generate_llm_report(ctx)
            else:
                # Basic report
                report_content = self._generate_basic_report(ctx)

            # Write report to file
            report_path.write_text(report_content, encoding="utf-8")

            pdf_generated = self._write_pdf_report(report_content, pdf_path, ctx.previous_findings, ctx)

            logger.info(f"Report generated: {report_path}")

            # Step 3: Return finding with report path
            yield Finding(
                id=f"{ctx.scan_id}-report",
                title="Security Scan Report Generated",
                severity=FindingSeverity.INFO,
                description=(
                    f"Comprehensive markdown report created with "
                    f"{len(ctx.previous_findings)} findings analyzed."
                ),
                remediation="Review report and track remediation progress with stakeholders.",
                source_agent=self.name,
                metadata={
                    "report_path": str(report_path),
                    "pdf_path": str(pdf_path) if pdf_generated else None,
                    "total_findings": len(ctx.previous_findings),
                    "llm_enhanced": bool(ctx.llm_client),
                },
            )

        except Exception as exc:
            logger.error(f"Report generation failed: {exc}", exc_info=True)
            # Create minimal report on error
            report_path.write_text(
                f"# AegisScan Report\n\nError generating report: {str(exc)}\n",
                encoding="utf-8",
            )

            yield Finding(
                id=f"{ctx.scan_id}-report-error",
                title="Report Generated with Errors",
                severity=FindingSeverity.INFO,
                description=f"Report creation encountered issues: {str(exc)}",
                remediation="Review raw findings data",
                source_agent=self.name,
                metadata={"report_path": str(report_path), "error": str(exc)},
            )

    def _generate_basic_report(self, ctx: AgentContext) -> str:
        """Generate basic markdown report without LLM."""

        report_lines = [
            "# AegisScan Security Report",
            "",
            f"**Target**: {ctx.target}",
            f"**Scan Mode**: {ctx.mode}",
            f"**Generated**: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
            f"**Scan ID**: {ctx.scan_id}",
            "",
            "---",
            "",
        ]

        if not ctx.previous_findings:
            report_lines.extend([
                "## Summary",
                "",
                "No security findings were identified in this scan.",
                "",
            ])
        else:
            # Count by severity
            severity_counts = {}
            for finding in ctx.previous_findings:
                sev = finding.severity.value
                severity_counts[sev] = severity_counts.get(sev, 0) + 1

            # Summary section
            report_lines.extend([
                "## Executive Summary",
                "",
                f"This scan identified **{len(ctx.previous_findings)} security findings** across multiple analysis techniques.",
                "",
                "### Findings by Severity",
                "",
            ])

            for severity in ["critical", "high", "medium", "low", "informational"]:
                count = severity_counts.get(severity, 0)
                if count > 0:
                    report_lines.append(f"- **{severity.upper()}**: {count}")

            report_lines.extend(["", "---", ""])

            # Detailed findings
            report_lines.extend(["## Detailed Findings", ""])

            for i, finding in enumerate(ctx.previous_findings, 1):
                report_lines.extend([
                    f"### {i}. {finding.title}",
                    "",
                    f"**Severity**: {finding.severity.value.upper()}",
                    f"**Source**: {finding.source_agent.value}",
                    "",
                    "**Description**:",
                    finding.description,
                    "",
                    "**Remediation**:",
                    finding.remediation,
                    "",
                ])

                if finding.references:
                    report_lines.extend(["**References**:"])
                    for ref in finding.references:
                        report_lines.append(f"- {ref}")
                    report_lines.append("")

                report_lines.append("---")
                report_lines.append("")

        # Footer
        report_lines.extend([
            "## Recommendations",
            "",
            "1. Address all CRITICAL and HIGH severity findings immediately",
            "2. Plan remediation for MEDIUM severity issues",
            "3. Track LOW and INFO findings for future improvements",
            "4. Re-scan after applying fixes to verify remediation",
            "",
            "---",
            "",
            "*Report generated by AegisScan - Multi-Agent Security Platform*",
        ])

        return "\n".join(report_lines)

    async def _generate_llm_report(self, ctx: AgentContext) -> str:
        """Generate LLM-enhanced report with executive summary."""

        # Start with basic report structure
        base_report = self._generate_basic_report(ctx)

        # Generate executive summary with LLM
        try:
            exec_summary = await self._generate_executive_summary(ctx)

            # Insert executive summary after the header
            lines = base_report.split("\n")
            header_end = lines.index("---")  # First divider

            # Insert enhanced summary
            enhanced_lines = (
                lines[:header_end + 1] +
                ["", "## AI-Generated Executive Summary", ""] +
                [exec_summary, "", "---", ""] +
                lines[header_end + 1:]
            )

            return "\n".join(enhanced_lines)

        except Exception as exc:
            logger.warning(f"LLM summary generation failed, using basic report: {exc}")
            return base_report

    async def _generate_executive_summary(self, ctx: AgentContext) -> str:
        """Use LLM to generate executive summary."""

        # Count findings
        critical_high = [
            f for f in ctx.previous_findings
            if f.severity in [FindingSeverity.CRITICAL, FindingSeverity.HIGH]
        ]

        # Build findings summary for LLM
        findings_summary = "\n".join([
            f"- {f.title} ({f.severity.value}) from {f.source_agent.value}"
            for f in ctx.previous_findings[:15]  # Top 15 findings
        ])

        prompt = f"""You are writing an executive summary for a security scan report.

**Target**: {ctx.target}
**Total Findings**: {len(ctx.previous_findings)}
**Critical/High**: {len(critical_high)}

**Key Findings:**
{findings_summary}

**Task:**
Write a 3-4 sentence executive summary for business stakeholders. Focus on:
1. Overall security posture
2. Most critical risks
3. Recommended next steps

Be clear, concise, and business-friendly (avoid overly technical jargon)."""

        try:
            summary = await ctx.llm_client.generate(
                prompt,
                temperature=0.6,
                max_tokens=250,
            )

            return summary.strip()

        except Exception as exc:
            logger.error(f"Executive summary generation failed: {exc}")
            return "Executive summary generation failed. Please review detailed findings below."

    def _describe_capabilities(self) -> str:
        """Describe what the Report Agent can do."""
        return (
            "Security report generation with executive summaries, finding details, "
            "and remediation recommendations"
        )

    def _generate_charts(self, findings: list[Finding]) -> dict[str, io.BytesIO]:
        """Generate professional charts for findings data."""
        charts = {}

        if not findings:
            return charts

        # Set professional dark theme
        plt.style.use('dark_background')

        # Professional color palette
        colors_map = {
            'critical': '#EF4444',
            'high': '#F97316',
            'medium': '#F59E0B',
            'low': '#10B981',
            'informational': '#64748B'
        }

        # 1. Severity Distribution - Modern donut chart
        severity_counts = {}
        for finding in findings:
            sev = finding.severity.value
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

        if severity_counts:
            fig, ax = plt.subplots(figsize=(10, 8), facecolor='#0f172a')
            ax.set_facecolor('#0f172a')

            labels = list(severity_counts.keys())
            sizes = list(severity_counts.values())
            chart_colors = [colors_map.get(label, '#94a3b8') for label in labels]

            # Create donut chart
            wedges, texts, autotexts = ax.pie(
                sizes,
                labels=[l.upper() for l in labels],
                autopct='%1.1f%%',
                colors=chart_colors,
                startangle=90,
                wedgeprops=dict(width=0.4, edgecolor='#0f172a', linewidth=2),
                textprops={'color': 'white', 'fontsize': 13, 'weight': 'bold'}
            )

            # Style the percentage text
            for autotext in autotexts:
                autotext.set_color('white')
                autotext.set_fontsize(12)
                autotext.set_weight('bold')

            ax.set_title('Severity Distribution', fontsize=20, pad=30, color='white', weight='bold')

            severity_chart = io.BytesIO()
            plt.savefig(severity_chart, format='png', dpi=150, bbox_inches='tight',
                       facecolor='#0f172a', edgecolor='none')
            severity_chart.seek(0)
            charts['severity'] = severity_chart
            plt.close(fig)

        # 2. Findings by Agent - Enhanced stacked bar chart
        agent_severity_counts = {}
        for finding in findings:
            agent = finding.source_agent.value
            sev = finding.severity.value

            if agent not in agent_severity_counts:
                agent_severity_counts[agent] = {
                    'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'informational': 0
                }
            agent_severity_counts[agent][sev] += 1

        if agent_severity_counts:
            fig, ax = plt.subplots(figsize=(12, 8), facecolor='#0f172a')
            ax.set_facecolor('#0f172a')

            agents = list(agent_severity_counts.keys())
            severities = ['critical', 'high', 'medium', 'low', 'informational']

            # Create stacked bar chart
            bottom_values = [0] * len(agents)

            for sev in severities:
                values = [agent_severity_counts[agent][sev] for agent in agents]
                if any(values):
                    ax.bar(agents, values, bottom=bottom_values, label=sev.capitalize(),
                          color=colors_map[sev], edgecolor='#0f172a', linewidth=1.5)
                    bottom_values = [b + v for b, v in zip(bottom_values, values)]

            ax.set_xlabel('Security Agent', fontsize=14, color='white', weight='bold', labelpad=10)
            ax.set_ylabel('Number of Findings', fontsize=14, color='white', weight='bold', labelpad=10)
            ax.set_title('Findings by Agent', fontsize=20, pad=30, color='white', weight='bold')
            ax.set_xticklabels([a.upper() for a in agents], rotation=0, ha='center', color='white', fontsize=11)
            ax.tick_params(colors='white')

            # Style legend
            legend = ax.legend(loc='upper right', framealpha=0.9, facecolor='#1e293b', edgecolor='#475569')
            for text in legend.get_texts():
                text.set_color('white')

            # Grid styling
            ax.grid(axis='y', alpha=0.2, color='#475569', linestyle='--', linewidth=0.8)
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['left'].set_color('#475569')
            ax.spines['bottom'].set_color('#475569')

            agent_chart = io.BytesIO()
            plt.savefig(agent_chart, format='png', dpi=150, bbox_inches='tight',
                       facecolor='#0f172a', edgecolor='none')
            agent_chart.seek(0)
            charts['agent'] = agent_chart
            plt.close(fig)

        return charts

    def _calculate_risk_score(self, findings: list[Finding]) -> tuple[int, str]:
        """Calculate overall risk score (0-100) and risk level."""
        if not findings:
            return 0, "LOW"

        # Weight by severity
        weights = {
            'critical': 25,
            'high': 10,
            'medium': 3,
            'low': 1,
            'informational': 0
        }

        total_score = 0
        for finding in findings:
            total_score += weights.get(finding.severity.value, 0)

        # Normalize to 0-100 scale (cap at 100)
        risk_score = min(100, total_score)

        # Determine risk level
        if risk_score >= 75:
            risk_level = "CRITICAL"
        elif risk_score >= 50:
            risk_level = "HIGH"
        elif risk_score >= 25:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return risk_score, risk_level

    def _extract_clean_target_name(self, target: str) -> str:
        """Extract clean repository/domain name from target."""
        # If it's a GitHub URL, extract org/repo
        if 'github.com' in target:
            parts = target.rstrip('/').split('/')
            if len(parts) >= 2:
                return f"{parts[-2]}/{parts[-1]}"

        # If it's a URL, extract domain
        if target.startswith('http'):
            from urllib.parse import urlparse
            parsed = urlparse(target)
            return parsed.netloc or target

        # Otherwise return as-is
        return target

    def _extract_finding_summary(self, finding: Finding) -> str:
        """Extract a concise, meaningful summary from finding title/description."""
        title = finding.title

        # For CVE findings, extract CVE and vulnerability type
        if 'CVE-' in title or 'cve-' in title.lower():
            # Extract CVE number
            import re
            cve_match = re.search(r'CVE-\d{4}-\d+', title, re.IGNORECASE)
            cve = cve_match.group(0) if cve_match else ''

            # Try to extract vulnerability type from title
            if ':' in title:
                parts = title.split(':')
                vuln_type = parts[-1].strip()
                if len(vuln_type) > 80:
                    vuln_type = vuln_type[:77] + '...'
                return f"{cve}: {vuln_type}" if cve else vuln_type

        # For other findings, use title but truncate smartly
        if len(title) > 85:
            # Try to truncate at a word boundary
            truncated = title[:82]
            last_space = truncated.rfind(' ')
            if last_space > 60:
                return truncated[:last_space] + '...'
            return truncated + '...'

        return title

    def _write_pdf_report(self, markdown_content: str, pdf_path: Path, findings: list[Finding] = None, ctx: AgentContext = None) -> bool:
        """Generate professional PDF with modern design and branding."""
        try:
            pdf_path.parent.mkdir(parents=True, exist_ok=True)
            doc = canvas.Canvas(str(pdf_path), pagesize=LETTER)
            width, height = LETTER

            # Professional color scheme
            primary_color = colors.HexColor('#06b6d4')  # Cyan
            danger_color = colors.HexColor('#EF4444')   # Red
            dark_bg = colors.HexColor('#0f172a')        # Dark blue
            text_color = colors.HexColor('#e2e8f0')     # Light gray

            # === COVER PAGE ===
            # Background
            doc.setFillColor(dark_bg)
            doc.rect(0, 0, width, height, fill=True, stroke=False)

            # Top accent bar
            doc.setFillColor(primary_color)
            doc.rect(0, height - 80, width, 80, fill=True, stroke=False)

            # Title section
            doc.setFillColor(colors.white)
            doc.setFont("Helvetica-Bold", 42)
            doc.drawCentredString(width / 2, height - 150, "AEGISSCAN")

            doc.setFont("Helvetica", 24)
            doc.setFillColor(text_color)
            doc.drawCentredString(width / 2, height - 190, "Security Assessment Report")

            # Horizontal line
            doc.setStrokeColor(primary_color)
            doc.setLineWidth(2)
            doc.line(100, height - 220, width - 100, height - 220)

            # Metadata box
            doc.setFont("Helvetica-Bold", 11)
            y = height - 270

            if ctx:
                # Clean target name
                clean_target = self._extract_clean_target_name(str(ctx.target))

                doc.setFillColor(primary_color)
                doc.drawString(100, y, f"TARGET:")
                doc.setFillColor(colors.white)
                doc.setFont("Helvetica", 12)
                doc.drawString(200, y, clean_target)
                doc.setFont("Helvetica-Bold", 11)
                y -= 30

                # Shortened scan ID
                doc.setFillColor(primary_color)
                doc.drawString(100, y, f"SCAN ID:")
                doc.setFillColor(text_color)
                doc.setFont("Courier", 10)
                doc.drawString(200, y, str(ctx.scan_id)[:16] + '...')
                doc.setFont("Helvetica-Bold", 11)
                y -= 30

            doc.setFillColor(primary_color)
            doc.drawString(100, y, f"GENERATED:")
            doc.setFillColor(text_color)
            doc.setFont("Helvetica", 11)
            doc.drawString(200, y, datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC'))
            y -= 25
            doc.setFont("Helvetica-Bold", 11)

            # Risk score card (if findings available)
            if findings:
                risk_score, risk_level = self._calculate_risk_score(findings)

                # Risk score box
                box_y = y - 100
                doc.setFillColor(colors.HexColor('#1e293b'))
                doc.roundRect(80, box_y, width - 160, 120, 10, fill=True, stroke=True)
                doc.setStrokeColor(primary_color)
                doc.setLineWidth(2)
                doc.roundRect(80, box_y, width - 160, 120, 10, fill=False, stroke=True)

                # Risk score
                doc.setFillColor(colors.white)
                doc.setFont("Helvetica-Bold", 16)
                doc.drawCentredString(width / 2, box_y + 90, "OVERALL RISK SCORE")

                # Score circle
                score_color = danger_color if risk_score >= 50 else colors.HexColor('#F59E0B') if risk_score >= 25 else colors.HexColor('#10B981')
                doc.setFillColor(score_color)
                doc.setFont("Helvetica-Bold", 48)
                doc.drawCentredString(width / 2, box_y + 45, str(risk_score))

                doc.setFont("Helvetica-Bold", 14)
                doc.setFillColor(score_color)
                doc.drawCentredString(width / 2, box_y + 20, risk_level)

            # Footer
            doc.setFont("Helvetica-Oblique", 10)
            doc.setFillColor(colors.HexColor('#64748B'))
            doc.drawCentredString(width / 2, 40, "Powered by AegisScan Multi-Agent Security Platform")

            # === NEW PAGE: EXECUTIVE SUMMARY ===
            doc.showPage()
            doc.setFillColor(dark_bg)
            doc.rect(0, 0, width, height, fill=True, stroke=False)

            # Header
            doc.setFillColor(primary_color)
            doc.rect(0, height - 60, width, 60, fill=True, stroke=False)
            doc.setFillColor(colors.white)
            doc.setFont("Helvetica-Bold", 24)
            doc.drawString(50, height - 40, "EXECUTIVE SUMMARY")

            y = height - 100

            if findings:
                # Count by severity
                severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'informational': 0}
                for finding in findings:
                    severity_counts[finding.severity.value] += 1

                # Summary stats table
                data = [
                    ['SEVERITY', 'COUNT', 'PRIORITY'],
                    ['Critical', str(severity_counts['critical']), 'IMMEDIATE'],
                    ['High', str(severity_counts['high']), 'HIGH'],
                    ['Medium', str(severity_counts['medium']), 'MEDIUM'],
                    ['Low', str(severity_counts['low']), 'LOW'],
                    ['Info', str(severity_counts['informational']), 'INFO'],
                ]

                table = Table(data, colWidths=[150, 80, 150])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), primary_color),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 12),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#1e293b')),
                    ('TEXTCOLOR', (0, 1), (-1, -1), text_color),
                    ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#475569')),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 1), (-1, -1), 11),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#1e293b'), colors.HexColor('#334155')])
                ]))

                table.wrapOn(doc, width, height)
                table.drawOn(doc, 50, y - 200)
                y -= 240

                # Key recommendations
                doc.setFont("Helvetica-Bold", 16)
                doc.setFillColor(colors.white)
                doc.drawString(50, y, "KEY RECOMMENDATIONS")
                y -= 30

                doc.setFont("Helvetica", 11)
                doc.setFillColor(text_color)
                recommendations = [
                    f"• Address {severity_counts['critical']} CRITICAL findings immediately",
                    f"• Plan remediation for {severity_counts['high']} HIGH severity issues within 7 days",
                    f"• Review and triage {severity_counts['medium']} MEDIUM findings",
                    "• Schedule follow-up scan after remediation"
                ]

                for rec in recommendations:
                    doc.drawString(70, y, rec)
                    y -= 20

            # === NEW PAGE: DETAILED FINDINGS ===
            doc.showPage()
            doc.setFillColor(dark_bg)
            doc.rect(0, 0, width, height, fill=True, stroke=False)

            # Header
            doc.setFillColor(primary_color)
            doc.rect(0, height - 60, width, 60, fill=True, stroke=False)
            doc.setFillColor(colors.white)
            doc.setFont("Helvetica-Bold", 24)
            doc.drawString(50, height - 40, "DETAILED FINDINGS")

            y = height - 100
            x_margin = 50

            # Generate charts if available
            charts = {}
            if findings:
                try:
                    charts = self._generate_charts(findings)
                except Exception as chart_exc:
                    logger.warning(f"Chart generation failed: {chart_exc}")

            # Add charts
            if 'severity' in charts:
                doc.setFont("Helvetica-Bold", 16)
                doc.setFillColor(colors.white)
                doc.drawString(x_margin, y, "Severity Distribution")
                y -= 20

                img = ImageReader(charts['severity'])
                img_width = width - (2 * x_margin)
                img_height = img_width * 0.6

                if y - img_height < 100:
                    doc.showPage()
                    doc.setFillColor(dark_bg)
                    doc.rect(0, 0, width, height, fill=True, stroke=False)
                    y = height - 60

                doc.drawImage(img, x_margin, y - img_height, width=img_width, height=img_height)
                y -= (img_height + 40)

            # Agent chart on new page
            if 'agent' in charts:
                doc.showPage()
                doc.setFillColor(dark_bg)
                doc.rect(0, 0, width, height, fill=True, stroke=False)
                y = height - 60

                doc.setFont("Helvetica-Bold", 16)
                doc.setFillColor(colors.white)
                doc.drawString(x_margin, y, "Findings by Security Agent")
                y -= 20

                img = ImageReader(charts['agent'])
                img_width = width - (2 * x_margin)
                img_height = img_width * 0.6

                doc.drawImage(img, x_margin, y - img_height, width=img_width, height=img_height)

            # Findings list
            if findings:
                doc.showPage()
                doc.setFillColor(dark_bg)
                doc.rect(0, 0, width, height, fill=True, stroke=False)

                # Header
                doc.setFillColor(primary_color)
                doc.rect(0, height - 60, width, 60, fill=True, stroke=False)
                doc.setFillColor(colors.white)
                doc.setFont("Helvetica-Bold", 24)
                doc.drawString(50, height - 40, "FINDING DETAILS")

                y = height - 100

                for i, finding in enumerate(findings[:10], 1):  # Limit to top 10 for PDF
                    if y < 150:
                        doc.showPage()
                        doc.setFillColor(dark_bg)
                        doc.rect(0, 0, width, height, fill=True, stroke=False)
                        y = height - 60

                    # Finding box
                    doc.setFillColor(colors.HexColor('#1e293b'))
                    doc.roundRect(40, y - 80, width - 80, 80, 8, fill=True)

                    # Severity badge
                    sev_colors = {
                        'critical': '#EF4444',
                        'high': '#F97316',
                        'medium': '#F59E0B',
                        'low': '#10B981',
                        'informational': '#64748B'
                    }
                    doc.setFillColor(colors.HexColor(sev_colors.get(finding.severity.value, '#64748B')))
                    doc.roundRect(50, y - 20, 80, 20, 4, fill=True)
                    doc.setFillColor(colors.white)
                    doc.setFont("Helvetica-Bold", 10)
                    doc.drawCentredString(90, y - 15, finding.severity.value.upper())

                    # Title
                    doc.setFont("Helvetica-Bold", 12)
                    doc.setFillColor(colors.white)
                    title_text = self._extract_finding_summary(finding)
                    doc.drawString(50, y - 45, f"{i}. {title_text}")

                    # Agent
                    doc.setFont("Helvetica", 9)
                    doc.setFillColor(colors.HexColor('#94a3b8'))
                    doc.drawString(50, y - 65, f"Detected by: {finding.source_agent.value.upper()}")

                    y -= 95

            # Footer on last page
            doc.setFont("Helvetica-Oblique", 9)
            doc.setFillColor(colors.HexColor('#64748B'))
            doc.drawCentredString(width / 2, 30, f"End of Report • Generated by AegisScan • {datetime.now().strftime('%Y-%m-%d')}")

            doc.save()
            return True

        except Exception as exc:
            logger.error("ReportAgent: failed to generate PDF report: %s", exc)
            try:
                pdf_path.unlink(missing_ok=True)
            except OSError:
                pass
            return False
