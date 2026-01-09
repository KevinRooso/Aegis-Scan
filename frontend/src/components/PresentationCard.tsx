/**
 * PresentationCard - Cinematic card component for voice-guided presentation
 * Supports multiple card types: finding, summary, stats, agent-status
 */

import { motion, AnimatePresence } from 'framer-motion';
import type { Finding, ScanStatus } from '../types/api';

// ============================================================================
// IMPROVED THREAT LEVEL CALCULATION ALGORITHM
// ============================================================================

// 1. Base Severity Scores
const BASE_SEVERITY: Record<string, number> = {
  critical: 90,
  high: 70,
  medium: 50,
  low: 30,
  informational: 10,
};

// 2. Vulnerability Type Keywords (case-insensitive matching)
const VULNERABILITY_KEYWORDS = {
  critical: {
    score: 40,
    keywords: [
      'remote code execution', 'rce', 'command injection', 'sql injection',
      'authentication bypass', 'privilege escalation', 'arbitrary file upload',
      'deserialization', 'server-side request forgery', 'ssrf'
    ]
  },
  high: {
    score: 30,
    keywords: [
      'cross-site scripting', 'xss', 'csrf', 'cross-site request forgery',
      'xxe', 'xml external entity', 'path traversal', 'directory traversal',
      'insecure deserialization', 'broken authentication', 'session fixation'
    ]
  },
  medium: {
    score: 20,
    keywords: [
      'information disclosure', 'missing encryption', 'weak cryptography',
      'hardcoded credentials', 'hardcoded secret', 'insecure storage',
      'missing security headers', 'exposed credentials'
    ]
  },
  low: {
    score: 10,
    keywords: [
      'outdated dependency', 'missing input validation', 'information leak',
      'verbose error', 'missing rate limiting', 'deprecated'
    ]
  }
};

// 3. Agent Type Weights
const AGENT_WEIGHTS: Record<string, number> = {
  // High-risk agents
  dependency: 1.3,
  dast: 1.3,
  secret: 1.3,
  // Medium-risk agents
  static: 1.1,
  fuzzer: 1.1,
  template: 1.1,
  // Low-risk agents
  adaptive: 0.9,
  threat: 0.9,
  report: 0.9,
};

// 4. Exploitability Keywords (with improved caps)
const EXPLOITABILITY_KEYWORDS = {
  high: {
    score: 50, // Increased from 30
    keywords: [
      'unauthenticated', 'remote', 'no authentication required',
      'publicly accessible', 'default credentials', 'known exploit',
      'exploit available', 'poc available', 'proof of concept'
    ]
  },
  medium: {
    score: 30, // Increased from 20
    keywords: [
      'authenticated', 'local', 'requires user interaction',
      'social engineering', 'requires interaction'
    ]
  },
  low: {
    score: 15, // Increased from 10
    keywords: [
      'requires physical access', 'complex attack chain',
      'theoretical', 'difficult to exploit'
    ]
  }
};

// Helper: Find highest matching keyword score
const findKeywordScore = (
  text: string,
  categories: Record<string, { score: number; keywords: string[] }>
): number => {
  const lowerText = text.toLowerCase();
  let maxScore = 0;

  for (const category of Object.values(categories)) {
    for (const keyword of category.keywords) {
      if (lowerText.includes(keyword)) {
        maxScore = Math.max(maxScore, category.score);
      }
    }
  }

  return maxScore;
};

// Helper: Extract CVSS score from text or references
const extractCVSSBonus = (finding: Finding): number => {
  const searchText = `${finding.description} ${finding.title} ${finding.references?.join(' ') || ''}`.toLowerCase();

  // Look for CVSS score patterns
  const cvssMatch = searchText.match(/cvss[:\s]+(\d+\.?\d*)/i);
  if (cvssMatch) {
    const score = parseFloat(cvssMatch[1]);
    if (score >= 9.0) return 45;
    if (score >= 7.0) return 35;
    if (score >= 4.0) return 25;
    if (score >= 0.1) return 15;
  }

  // Look for CVE mentions
  const cveMatches = searchText.match(/cve-\d{4}-\d{4,}/gi);
  if (cveMatches) {
    const cveCount = cveMatches.length;
    const baseBonus = 20;
    const additionalBonus = Math.min((cveCount - 1) * 5, 15); // Max +15 for multiple CVEs
    return baseBonus + additionalBonus;
  }

  return 0;
};

// Main calculation function
const getThreatMetrics = (finding: Finding) => {
  const severity = finding.severity;
  const searchText = `${finding.title} ${finding.description}`;

  // 1. Base Severity Score
  const baseSeverity = BASE_SEVERITY[severity] || BASE_SEVERITY.informational;

  // 2. Vulnerability Type Score
  const vulnTypeScore = findKeywordScore(searchText, VULNERABILITY_KEYWORDS);

  // 3. Agent Weighted Base
  const agentWeight = AGENT_WEIGHTS[finding.source_agent] || 1.0;
  const agentWeightedBase = Math.min(baseSeverity * agentWeight, 100);

  // 4. CVSS Bonus
  const cvssBonus = extractCVSSBonus(finding);

  // 5. Exploitability Bonus
  const exploitBonus = findKeywordScore(searchText, EXPLOITABILITY_KEYWORDS);

  // ========================================================================
  // CALCULATE SCORES USING IMPROVED FORMULAS
  // ========================================================================

  // A. Contextual Bonus (for Threat Level)
  const contextualBonus =
    vulnTypeScore * 0.30 +
    agentWeightedBase * 0.20 +
    cvssBonus * 0.30 +
    exploitBonus * 0.20;

  // B. Threat Level = BaseSeverity × 0.60 + ContextualBonus × 0.40
  let threatLevel = baseSeverity * 0.60 + contextualBonus * 0.40;

  // C. Exploitability = BaseSeverity × 0.20 + ExploitBonus × 0.50 + (VulnType × 0.5) × 0.30
  let exploitability =
    baseSeverity * 0.20 +
    exploitBonus * 0.50 +
    (vulnTypeScore * 0.5) * 0.30;

  // D. Impact = BaseSeverity × 0.40 + VulnType × 0.30 + CVSS × 0.20 + AgentWeighted × 0.10
  let impact =
    baseSeverity * 0.40 +
    vulnTypeScore * 0.30 +
    cvssBonus * 0.20 +
    agentWeightedBase * 0.10;

  // ========================================================================
  // EDGE CASES & NORMALIZATION
  // ========================================================================

  // Edge case: Informational with critical keywords
  if (severity === 'informational' && vulnTypeScore > 30) {
    threatLevel = Math.max(threatLevel, 40);
  }

  // Edge case: Conflicting signals (high severity but theoretical)
  const isTheoretical = searchText.toLowerCase().includes('theoretical');
  if (baseSeverity >= 70 && isTheoretical) {
    exploitability *= 0.80; // Reduce by 20%
  }

  // Normalize all scores
  const normalize = (score: number) => {
    return Math.round(Math.max(5, Math.min(100, score)));
  };

  return {
    threat: normalize(threatLevel),
    exploitability: normalize(exploitability),
    impact: normalize(impact),
  };
};

interface BasePresentationCardProps {
  type: 'finding' | 'summary' | 'stats' | 'agent-status';
  onClose?: () => void;
}

interface FindingCardProps extends BasePresentationCardProps {
  type: 'finding';
  finding: Finding;
}

interface SummaryCardProps extends BasePresentationCardProps {
  type: 'summary';
  status: ScanStatus;
}

interface StatsCardProps extends BasePresentationCardProps {
  type: 'stats';
  stats: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

interface AgentStatusCardProps extends BasePresentationCardProps {
  type: 'agent-status';
  agentName: string;
  status: string;
  message?: string;
}

type PresentationCardProps =
  | FindingCardProps
  | SummaryCardProps
  | StatsCardProps
  | AgentStatusCardProps;

const getSeverityColor = (severity: string) => {
  const colors = {
    critical: 'from-red-600 to-rose-700',
    high: 'from-orange-500 to-amber-600',
    medium: 'from-yellow-500 to-amber-500',
    low: 'from-blue-500 to-cyan-600',
    informational: 'from-gray-500 to-slate-600',
  };
  return colors[severity as keyof typeof colors] || colors.informational;
};

const getSeverityGlow = (severity: string) => {
  const glows = {
    critical: 'shadow-red-500/50',
    high: 'shadow-orange-500/50',
    medium: 'shadow-yellow-500/50',
    low: 'shadow-blue-500/50',
    informational: 'shadow-gray-500/50',
  };
  return glows[severity as keyof typeof glows] || glows.informational;
};

export function PresentationCard(props: PresentationCardProps) {
  const cardVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      y: 50,
      rotateX: -15,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      rotateX: 0,
      transition: {
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1], // Custom easing for smooth entrance
      },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: -30,
      transition: {
        duration: 0.4,
        ease: 'easeIn',
      },
    },
  };

  if (props.type === 'finding') {
    const { finding } = props;
    const severityColor = getSeverityColor(finding.severity);
    const severityGlow = getSeverityGlow(finding.severity);

    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto"
      >
        {/* Pulsing glow effect */}
        <motion.div
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute inset-0 rounded-3xl blur-3xl ${severityGlow}`}
        />

        {/* Main card with enhanced glassmorphism */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 shadow-2xl backdrop-blur-xl">
          {/* Grid background pattern */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div
              className="h-full w-full"
              style={{
                backgroundImage:
                  'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
          </div>

          {/* Animated background particles */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-pulse" />
            <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-pulse delay-1000" />
          </div>

          {/* Top accent bar with shimmer */}
          <div className={`h-2 bg-gradient-to-r ${severityColor} relative overflow-hidden`}>
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
            />
          </div>

          <div className="p-8">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <span className={`inline-flex rounded-full bg-gradient-to-r ${severityColor} px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-lg`}>
                    {finding.severity}
                  </span>
                  <span className="text-xs font-medium text-cyan-400/80">
                    {finding.source_agent}
                  </span>
                </div>
                <h1 className="text-3xl font-bold text-white leading-tight">
                  {finding.title}
                </h1>
                {finding.id.includes('CVE-') && (
                  <div className="mt-2 flex items-center gap-2 text-base text-cyan-400">
                    <span className="text-cyan-500/60">●</span>
                    <span className="font-mono">{finding.id.split('_').pop()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-slate-950/50 p-5">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Description
              </h3>
              <p className="text-base leading-relaxed text-gray-300">
                {finding.description}
              </p>
            </div>

            {/* Threat Analysis Meters */}
            <div className="mb-6 rounded-2xl border border-purple-500/20 bg-slate-950/50 p-5">
              <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                Threat Analysis
              </h3>
              <div className="space-y-3">
                {(() => {
                  const metrics = getThreatMetrics(finding);
                  const meters = [
                    { label: 'Threat Level', value: metrics.threat, color: severityColor },
                    { label: 'Exploitability', value: metrics.exploitability, color: 'from-orange-600 to-red-600' },
                    { label: 'Impact Score', value: metrics.impact, color: 'from-purple-600 to-pink-600' },
                  ];

                  return meters.map((meter, idx) => (
                    <div key={meter.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-gray-300">{meter.label}</span>
                        <span className="text-sm font-bold text-white">{meter.value}/100</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-900/80">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${meter.value}%` }}
                          transition={{ duration: 1, delay: 0.3 + idx * 0.15, ease: 'easeOut' }}
                          className={`h-full bg-gradient-to-r ${meter.color} relative overflow-hidden`}
                        >
                          {/* Shimmer effect on bars */}
                          <div className="absolute inset-0 overflow-hidden">
                            <motion.div
                              animate={{ x: ['-100%', '200%'] }}
                              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                              className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                            />
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Remediation */}
            <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/50 p-5">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Remediation
              </h3>
              <p className="text-base leading-relaxed text-gray-300">
                {finding.remediation}
              </p>
            </div>

            {/* References */}
            {finding.references && finding.references.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {finding.references.map((ref, idx) => (
                  <a
                    key={idx}
                    href={ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-sm text-blue-400 transition-all hover:bg-blue-500/20 hover:border-blue-400/50"
                  >
                    Reference {idx + 1} →
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Bottom decorative line */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </motion.div>
    );
  }

  if (props.type === 'summary') {
    const { status } = props;
    const findings = status.findings || [];

    const severityCounts = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      info: findings.filter(f => f.severity === 'informational').length,
    };

    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto"
      >
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 blur-3xl" />

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 shadow-2xl backdrop-blur-xl">
          <div className="h-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500" />

          <div className="p-8">
            <h1 className="mb-2 text-4xl font-bold text-white">Scan Complete</h1>
            <p className="mb-6 text-lg text-gray-400 truncate">{status.target}</p>

            {/* Severity Grid */}
            <div className="grid grid-cols-5 gap-3">
              {(['critical', 'high', 'medium', 'low', 'info'] as const).map((severity) => {
                const count = severityCounts[severity];
                const color = getSeverityColor(severity);

                return (
                  <motion.div
                    key={severity}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * ['critical', 'high', 'medium', 'low', 'info'].indexOf(severity) }}
                    className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-center"
                  >
                    <div className={`mb-2 text-4xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
                      {count}
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {severity === 'info' ? 'Info' : severity}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-6 text-center">
              <div className="text-xl font-semibold text-gray-300">
                Total Findings: <span className="text-cyan-400">{findings.length}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (props.type === 'stats') {
    const { stats } = props;
    const total = stats.critical + stats.high + stats.medium + stats.low + stats.info;

    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 blur-3xl" />

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 shadow-2xl backdrop-blur-xl p-8">
          <h2 className="mb-6 text-3xl font-bold text-white text-center">Findings Breakdown</h2>

          <div className="space-y-3">
            {(['critical', 'high', 'medium', 'low', 'info'] as const).map((severity, idx) => {
              const count = stats[severity];
              const percentage = total > 0 ? (count / total) * 100 : 0;
              const color = getSeverityColor(severity);

              return (
                <motion.div
                  key={severity}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  className="flex items-center gap-3"
                >
                  <div className="w-24 text-right">
                    <span className="text-base font-semibold capitalize text-gray-300">
                      {severity === 'info' ? 'Info' : severity}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="h-7 overflow-hidden rounded-full bg-slate-950/50">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, delay: 0.3 + idx * 0.1 }}
                        className={`h-full bg-gradient-to-r ${color} flex items-center justify-end px-3`}
                      >
                        {count > 0 && (
                          <span className="text-sm font-bold text-white">{count}</span>
                        )}
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    );
  }

  if (props.type === 'agent-status') {
    const { agentName, status, message } = props;

    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto"
      >
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 blur-3xl" />

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 shadow-2xl backdrop-blur-xl p-8 text-center">
          <div className="mb-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {status}
            </span>
          </div>

          <h2 className="mb-3 text-2xl font-bold text-white">{agentName} Agent</h2>

          {message && (
            <p className="text-base text-gray-400">{message}</p>
          )}
        </div>
      </motion.div>
    );
  }

  return null;
}
