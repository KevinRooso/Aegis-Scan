import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Copy, Package, Settings, Wrench } from 'lucide-react';

import type { Finding } from '../types/api';

interface Props {
  findings: Finding[];
}

const severityPalette: Record<
  Finding['severity'],
  { text: string; bg: string; ring: string; label: string; gradient: string; glow: string }
> = {
  critical: {
    text: 'text-rose-200',
    bg: 'bg-rose-500/10',
    ring: 'ring-rose-500/40',
    label: 'Critical',
    gradient: 'from-red-600 via-red-500 to-rose-600',
    glow: 'shadow-red-500/50 hover:shadow-red-500/70',
  },
  high: {
    text: 'text-orange-200',
    bg: 'bg-orange-500/10',
    ring: 'ring-orange-500/40',
    label: 'High',
    gradient: 'from-orange-600 via-orange-500 to-amber-600',
    glow: 'shadow-orange-500/50 hover:shadow-orange-500/70',
  },
  medium: {
    text: 'text-amber-200',
    bg: 'bg-amber-500/10',
    ring: 'ring-amber-500/40',
    label: 'Medium',
    gradient: 'from-yellow-600 via-yellow-500 to-amber-500',
    glow: 'shadow-yellow-500/30 hover:shadow-yellow-500/50',
  },
  low: {
    text: 'text-emerald-200',
    bg: 'bg-emerald-500/10',
    ring: 'ring-emerald-500/40',
    label: 'Low',
    gradient: 'from-blue-600 via-blue-500 to-cyan-600',
    glow: 'shadow-blue-500/30 hover:shadow-blue-500/50',
  },
  informational: {
    text: 'text-slate-200',
    bg: 'bg-slate-500/10',
    ring: 'ring-slate-500/40',
    label: 'Info',
    gradient: 'from-slate-600 via-slate-500 to-gray-600',
    glow: 'shadow-slate-500/20 hover:shadow-slate-500/40',
  },
};

const severityFilters: Array<{ label: string; value: Finding['severity'] | 'all' }> = [
  { label: 'All severities', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
  { label: 'Info', value: 'informational' },
];

// Detect remediation type for icon
function getRemediationIcon(remediation: string) {
  const lower = remediation.toLowerCase();
  if (lower.includes('npm') || lower.includes('pip') || lower.includes('package') || lower.includes('dependency')) {
    return Package;
  }
  if (lower.includes('config') || lower.includes('setting') || lower.includes('enable') || lower.includes('disable')) {
    return Settings;
  }
  return Wrench;
}

interface FindingCardProps {
  finding: Finding;
  index: number;
}

function FindingCard({ finding, index }: FindingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const palette = severityPalette[finding.severity];
  const RemediationIcon = getRemediationIcon(finding.remediation);

  const copyRemediation = () => {
    navigator.clipboard.writeText(finding.remediation);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className={`group relative overflow-hidden rounded-lg backdrop-blur-xl bg-slate-900/95 border border-white/10 shadow-2xl hover:${palette.glow} transition-all`}
    >
      {/* Minimalist top bar animation */}
      <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden">
        {/* Pulsing gradient base */}
        <motion.div
          animate={{
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={`absolute inset-0 bg-gradient-to-r ${palette.gradient}`}
        />

        {/* Single smooth wave */}
        <motion.div
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
          className={`absolute top-0 h-full w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent`}
          style={{ left: 0 }}
        />
      </div>

      {/* Card content */}
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 flex-1">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${palette.bg} ${palette.text} ring-1 ${palette.ring}`}
            >
              <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
              {palette.label}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.15em] text-slate-300">
              {finding.source_agent}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-white mb-2 leading-tight">{finding.title}</h3>

        {/* Description */}
        <p className="text-sm text-slate-300 leading-relaxed mb-4 line-clamp-3">{finding.description}</p>

        {/* Remediation preview */}
        <div className="flex items-center gap-2 mb-3">
          <RemediationIcon className="w-4 h-4 text-cyan-400" />
          <p className="text-xs text-slate-400 font-medium line-clamp-1">{finding.remediation}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-cyan-300 transition-colors"
          >
            Details
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={copyRemediation}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors"
          >
            <Copy className="w-3 h-3" />
            Copy
          </button>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Description</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{finding.description}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Remediation</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{finding.remediation}</p>
                  </div>
                  {finding.references && finding.references.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">References</h4>
                      <div className="flex flex-wrap gap-2">
                        {finding.references.map((ref, idx) => (
                          <a
                            key={idx}
                            href={ref}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 underline"
                          >
                            Reference {idx + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {finding.metadata && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Metadata</h4>
                      <pre className="text-xs text-slate-400 bg-black/30 rounded p-2 overflow-auto max-h-32">
                        {JSON.stringify(finding.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function FindingsGrid({ findings }: Props) {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<(typeof severityFilters)[number]['value']>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  const filteredFindings = useMemo(() => {
    return findings.filter((finding) => {
      const matchesSeverity = severity === 'all' || finding.severity === severity;
      const normalized = `${finding.title} ${finding.description} ${finding.source_agent}`.toLowerCase();
      const matchesQuery = normalized.includes(search.trim().toLowerCase());
      return matchesSeverity && matchesQuery;
    });
  }, [findings, search, severity]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredFindings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedFindings = filteredFindings.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [search, severity]);

  if (!findings.length) {
    return (
      <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-8 text-sm text-slate-400">
        No findings yet. Launch a scan to populate results.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/5 bg-slate-950/60 p-6 shadow-xl shadow-black/30 backdrop-blur">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Findings</p>
          <h3 className="text-2xl font-semibold text-white">
            {filteredFindings.length} of {findings.length} surfaced issues
          </h3>
          <p className="text-sm text-slate-400">
            Search, filter, and prioritize remediation work without leaving the dashboard.
          </p>
        </div>

        {/* Search and filters */}
        <div className="flex w-full flex-col gap-3 sm:max-w-sm">
          <div className="relative">
            <input
              type="search"
              placeholder="Search findings, agents, or remediations…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs uppercase tracking-[0.2em] text-slate-500">
              ctrl+k
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {severityFilters.map(({ label, value }) => {
              const isActive = severity === value;
              return (
                <button
                  key={value}
                  onClick={() => setSeverity(value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    isActive
                      ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200 shadow-lg shadow-cyan-500/30'
                      : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid of findings */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {paginatedFindings.map((finding, index) => (
          <FindingCard key={finding.id} finding={finding} index={index} />
        ))}
      </div>

      {/* Empty state */}
      {!filteredFindings.length && (
        <div className="flex items-center justify-center py-10 text-sm text-slate-400">
          No findings match your filters.
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-6">
          <div className="text-sm text-slate-400">
            Showing <span className="font-semibold text-cyan-300">{startIndex + 1}</span> to{' '}
            <span className="font-semibold text-cyan-300">{Math.min(endIndex, filteredFindings.length)}</span> of{' '}
            <span className="font-semibold text-cyan-300">{filteredFindings.length}</span> findings
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                currentPage === 1
                  ? 'cursor-not-allowed bg-white/5 text-slate-600'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </motion.button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <motion.button
                  key={page}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setCurrentPage(page)}
                  className={`h-10 w-10 rounded-lg text-sm font-bold transition-all ${
                    currentPage === page
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {page}
                </motion.button>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                currentPage === totalPages
                  ? 'cursor-not-allowed bg-white/5 text-slate-600'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white'
              }`}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}
