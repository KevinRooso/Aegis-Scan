/**
 * PresentationCard - Cinematic card component for voice-guided presentation
 * Supports multiple card types: finding, summary, stats, agent-status
 */

import { motion, AnimatePresence } from 'framer-motion';
import type { Finding, ScanStatus } from '../types/api';

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
        className="relative w-full max-w-4xl"
      >
        {/* Glow effect */}
        <div className={`absolute inset-0 rounded-3xl blur-3xl opacity-30 ${severityGlow}`} />

        {/* Main card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 shadow-2xl backdrop-blur-xl">
          {/* Animated background particles */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-pulse" />
            <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-pulse delay-1000" />
          </div>

          {/* Top accent bar */}
          <div className={`h-2 bg-gradient-to-r ${severityColor}`} />

          <div className="p-12">
            {/* Header */}
            <div className="mb-8 flex items-start justify-between">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <span className={`inline-flex rounded-full bg-gradient-to-r ${severityColor} px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg`}>
                    {finding.severity}
                  </span>
                  <span className="text-sm font-medium text-cyan-400/80">
                    {finding.source_agent}
                  </span>
                </div>
                <h1 className="text-4xl font-bold text-white leading-tight">
                  {finding.title}
                </h1>
                {finding.id.includes('CVE-') && (
                  <div className="mt-3 flex items-center gap-2 text-lg text-cyan-400">
                    <span className="text-cyan-500/60">●</span>
                    <span className="font-mono">{finding.id.split('_').pop()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mb-8 rounded-2xl border border-cyan-500/20 bg-slate-950/50 p-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-cyan-400">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Description
              </h3>
              <p className="text-lg leading-relaxed text-gray-300">
                {finding.description}
              </p>
            </div>

            {/* Remediation */}
            <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/50 p-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Remediation
              </h3>
              <p className="text-lg leading-relaxed text-gray-300">
                {finding.remediation}
              </p>
            </div>

            {/* References */}
            {finding.references && finding.references.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {finding.references.map((ref, idx) => (
                  <a
                    key={idx}
                    href={ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-400 transition-all hover:bg-blue-500/20 hover:border-blue-400/50"
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
        className="relative w-full max-w-5xl"
      >
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 blur-3xl" />

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 shadow-2xl backdrop-blur-xl">
          <div className="h-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500" />

          <div className="p-12">
            <h1 className="mb-2 text-5xl font-bold text-white">Scan Complete</h1>
            <p className="mb-8 text-xl text-gray-400">{status.target}</p>

            {/* Severity Grid */}
            <div className="grid grid-cols-5 gap-4">
              {(['critical', 'high', 'medium', 'low', 'info'] as const).map((severity) => {
                const count = severityCounts[severity];
                const color = getSeverityColor(severity);

                return (
                  <motion.div
                    key={severity}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * ['critical', 'high', 'medium', 'low', 'info'].indexOf(severity) }}
                    className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-center"
                  >
                    <div className={`mb-3 text-5xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
                      {count}
                    </div>
                    <div className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                      {severity === 'info' ? 'Informational' : severity}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-8 text-center">
              <div className="text-2xl font-semibold text-gray-300">
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
        className="relative w-full max-w-3xl"
      >
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 blur-3xl" />

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 shadow-2xl backdrop-blur-xl p-12">
          <h2 className="mb-8 text-4xl font-bold text-white text-center">Findings Breakdown</h2>

          <div className="space-y-4">
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
                  className="flex items-center gap-4"
                >
                  <div className="w-32 text-right">
                    <span className="text-lg font-semibold capitalize text-gray-300">
                      {severity === 'info' ? 'Info' : severity}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="h-8 overflow-hidden rounded-full bg-slate-950/50">
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
        className="relative w-full max-w-2xl"
      >
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 blur-3xl" />

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 shadow-2xl backdrop-blur-xl p-10 text-center">
          <div className="mb-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-6 py-2 text-sm font-semibold uppercase tracking-wider text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {status}
            </span>
          </div>

          <h2 className="mb-4 text-3xl font-bold text-white">{agentName} Agent</h2>

          {message && (
            <p className="text-lg text-gray-400">{message}</p>
          )}
        </div>
      </motion.div>
    );
  }

  return null;
}
