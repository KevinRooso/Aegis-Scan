/**
 * FindingsVisualizations - AAA-Style Data Visualization for Security Findings
 *
 * Enhanced with:
 * - Animated chart entrances
 * - Glassmorphic containers with glows
 * - Radar chart for threat analysis
 * - Enhanced donut chart with center stats
 * - Gradient-filled bars with particle effects
 * - Interactive info toggles
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { Info, X } from 'lucide-react';

import type { Finding } from '../types/api';

interface Props {
  findings: Finding[];
}

const SEVERITY_COLORS = {
  critical: '#ef4444', // red-500
  high: '#f97316', // orange-500
  medium: '#eab308', // yellow-500
  low: '#3b82f6', // blue-500
  informational: '#64748b', // slate-500
} as const;

const SEVERITY_GRADIENTS = {
  critical: ['#dc2626', '#ef4444', '#f87171'],
  high: ['#ea580c', '#f97316', '#fb923c'],
  medium: ['#ca8a04', '#eab308', '#fbbf24'],
  low: ['#2563eb', '#3b82f6', '#60a5fa'],
  informational: ['#475569', '#64748b', '#94a3b8'],
} as const;

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'informational'] as const;

// Animated top accent bar component
function AnimatedTopBar({ colors }: { colors: string[] }) {
  return (
    <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden">
      {/* Pulsing gradient base */}
      <motion.div
        animate={{
          background: [
            `linear-gradient(90deg, ${colors[0]}, ${colors[1]}, ${colors[2]})`,
            `linear-gradient(90deg, ${colors[2]}, ${colors[1]}, ${colors[0]})`,
            `linear-gradient(90deg, ${colors[0]}, ${colors[1]}, ${colors[2]})`,
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0"
      />

      {/* Animated particles */}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            x: ['-20px', '100%'],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 2 + i * 0.3,
            repeat: Infinity,
            delay: i * 0.4,
            ease: 'linear',
          }}
          className="absolute top-0 w-8 h-1 bg-white/60 blur-sm"
          style={{ left: `${i * 20}%` }}
        />
      ))}
    </div>
  );
}

export function FindingsVisualizations({ findings }: Props) {
  const [showRadarInfo, setShowRadarInfo] = useState(false);

  // Calculate severity distribution
  const severityData = useMemo(() => {
    const counts: Record<string, number> = {};
    findings.forEach((f) => {
      counts[f.severity] = (counts[f.severity] || 0) + 1;
    });

    return SEVERITY_ORDER.filter((sev) => counts[sev] > 0).map((severity) => ({
      name: severity.charAt(0).toUpperCase() + severity.slice(1),
      value: counts[severity] || 0,
      color: SEVERITY_COLORS[severity],
    }));
  }, [findings]);

  // Calculate findings by agent
  const agentData = useMemo(() => {
    const agentCounts: Record<string, Record<string, number>> = {};

    findings.forEach((f) => {
      if (!agentCounts[f.source_agent]) {
        agentCounts[f.source_agent] = {};
      }
      agentCounts[f.source_agent][f.severity] = (agentCounts[f.source_agent][f.severity] || 0) + 1;
    });

    return Object.entries(agentCounts)
      .map(([agent, severities]) => ({
        agent: agent.toUpperCase(),
        critical: severities.critical || 0,
        high: severities.high || 0,
        medium: severities.medium || 0,
        low: severities.low || 0,
        informational: severities.informational || 0,
        total: Object.values(severities).reduce((sum, val) => sum + val, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [findings]);

  // Calculate threat radar data - Real metrics based on scan results
  const radarData = useMemo(() => {
    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const highCount = findings.filter((f) => f.severity === 'high').length;
    const mediumCount = findings.filter((f) => f.severity === 'medium').length;
    const total = findings.length || 1;
    const activeAgents = new Set(findings.map((f) => f.source_agent)).size;

    return {
      metrics: [
        {
          category: 'Critical',
          value: Math.round((criticalCount / total) * 100),
          fullMark: 100,
        },
        {
          category: 'High',
          value: Math.round((highCount / total) * 100),
          fullMark: 100,
        },
        {
          category: 'Medium',
          value: Math.round((mediumCount / total) * 100),
          fullMark: 100,
        },
        {
          category: 'Coverage',
          value: Math.round((activeAgents / 9) * 100),
          fullMark: 100,
        },
        {
          category: 'Density',
          value: Math.min(100, Math.round(total * 5)),
          fullMark: 100,
        },
      ],
      details: {
        criticalCount,
        highCount,
        mediumCount,
        total,
        activeAgents,
      },
    };
  }, [findings]);

  if (!findings.length) {
    return (
      <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-8 text-center text-sm text-slate-400">
        No findings to visualize. Launch a scan to see analytics.
      </div>
    );
  }

  const totalFindings = findings.length;

  return (
    <div className="space-y-6">
      {/* Main Visualizations Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Severity Distribution - Enhanced Donut Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-purple-500/10 backdrop-blur-xl"
        >
          {/* Grid background */}
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

          {/* Animated top bar */}
          <AnimatedTopBar colors={['#9333ea', '#ec4899', '#9333ea']} />

          <div className="relative">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Severity Analysis</p>
              <h3 className="text-2xl font-semibold text-white">Risk Distribution</h3>
              <p className="text-sm text-slate-400">Proportional threat breakdown</p>
            </div>

            <div className="relative">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.5)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#fff',
                    }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center stat */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="text-4xl font-bold text-white">{totalFindings}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total</div>
              </div>
            </div>

            {/* Enhanced Legend */}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {severityData.map((item) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 backdrop-blur-sm"
                >
                  <div className="h-3 w-3 rounded-full animate-pulse" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-semibold text-slate-200">
                    {item.name}: {item.value}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Threat Radar Chart with Info Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl"
        >
          {/* Grid background */}
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

          {/* Animated top bar */}
          <AnimatedTopBar colors={['#0891b2', '#3b82f6', '#0891b2']} />

          <div className="relative">
            {/* Header with Info Toggle */}
            <div className="mb-6 flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Threat Matrix</p>
                <h3 className="text-2xl font-semibold text-white">Risk Profile</h3>
                <p className="text-sm text-slate-400">Multi-dimensional threat analysis</p>
              </div>

              {/* Info Toggle Button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowRadarInfo(!showRadarInfo)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 ring-1 ring-cyan-500/40 transition-colors"
              >
                {showRadarInfo ? (
                  <X className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Info className="w-4 h-4 text-cyan-400" />
                )}
              </motion.button>
            </div>

            <AnimatePresence mode="wait">
              {!showRadarInfo ? (
                <motion.div
                  key="chart"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData.metrics}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis
                        dataKey="category"
                        tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={false}
                        axisLine={false}
                      />
                      <Radar
                        name="Threat Level"
                        dataKey="value"
                        stroke="#06b6d4"
                        fill="#06b6d4"
                        fillOpacity={0.6}
                        strokeWidth={2}
                        animationBegin={100}
                        animationDuration={800}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          color: '#fff',
                        }}
                        labelStyle={{ color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </motion.div>
              ) : (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4 py-4"
                >
                  {/* Metric Explanations */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <h4 className="font-bold text-red-300">Critical/High/Medium %</h4>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Shows the proportion of findings at each severity level. Higher percentages indicate more
                        urgent security issues requiring immediate attention.
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs">
                        <span className="text-red-400 font-semibold">
                          Critical: {radarData.details.criticalCount} ({Math.round((radarData.details.criticalCount / radarData.details.total) * 100)}%)
                        </span>
                        <span className="text-orange-400 font-semibold">
                          High: {radarData.details.highCount} ({Math.round((radarData.details.highCount / radarData.details.total) * 100)}%)
                        </span>
                        <span className="text-yellow-400 font-semibold">
                          Medium: {radarData.details.mediumCount} ({Math.round((radarData.details.mediumCount / radarData.details.total) * 100)}%)
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-cyan-500" />
                        <h4 className="font-bold text-cyan-300">Coverage</h4>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Indicates how many of the 9 security agents detected issues. Higher coverage means more
                        comprehensive scanning across different vulnerability types.
                      </p>
                      <div className="mt-2 text-xs text-cyan-400 font-semibold">
                        {radarData.details.activeAgents} of 9 agents active ({Math.round((radarData.details.activeAgents / 9) * 100)}% coverage)
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                        <h4 className="font-bold text-purple-300">Density</h4>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Represents the concentration of findings. Higher density suggests either thorough detection
                        or significant security gaps that need addressing.
                      </p>
                      <div className="mt-2 text-xs text-purple-400 font-semibold">
                        {radarData.details.total} findings detected (Density: {Math.min(100, Math.round(radarData.details.total * 5))}%)
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Agent Performance Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl"
      >
        {/* Grid background */}
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

        {/* Animated top bar */}
        <AnimatedTopBar colors={['#059669', '#10b981', '#059669']} />

        <div className="relative">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Agent Performance</p>
            <h3 className="text-2xl font-semibold text-white">Findings by Security Agent</h3>
            <p className="text-sm text-slate-400">Stacked severity breakdown per agent</p>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={agentData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                {/* Gradient definitions for bars */}
                <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SEVERITY_GRADIENTS.critical[0]} stopOpacity={1} />
                  <stop offset="50%" stopColor={SEVERITY_GRADIENTS.critical[1]} stopOpacity={1} />
                  <stop offset="100%" stopColor={SEVERITY_GRADIENTS.critical[2]} stopOpacity={1} />
                </linearGradient>
                <linearGradient id="highGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SEVERITY_GRADIENTS.high[0]} stopOpacity={1} />
                  <stop offset="50%" stopColor={SEVERITY_GRADIENTS.high[1]} stopOpacity={1} />
                  <stop offset="100%" stopColor={SEVERITY_GRADIENTS.high[2]} stopOpacity={1} />
                </linearGradient>
                <linearGradient id="mediumGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SEVERITY_GRADIENTS.medium[0]} stopOpacity={1} />
                  <stop offset="50%" stopColor={SEVERITY_GRADIENTS.medium[1]} stopOpacity={1} />
                  <stop offset="100%" stopColor={SEVERITY_GRADIENTS.medium[2]} stopOpacity={1} />
                </linearGradient>
                <linearGradient id="lowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SEVERITY_GRADIENTS.low[0]} stopOpacity={1} />
                  <stop offset="50%" stopColor={SEVERITY_GRADIENTS.low[1]} stopOpacity={1} />
                  <stop offset="100%" stopColor={SEVERITY_GRADIENTS.low[2]} stopOpacity={1} />
                </linearGradient>
                <linearGradient id="infoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SEVERITY_GRADIENTS.informational[0]} stopOpacity={1} />
                  <stop offset="50%" stopColor={SEVERITY_GRADIENTS.informational[1]} stopOpacity={1} />
                  <stop offset="100%" stopColor={SEVERITY_GRADIENTS.informational[2]} stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="agent" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#94a3b8', paddingTop: '20px' }} />
              <Bar
                dataKey="critical"
                stackId="a"
                fill="url(#criticalGradient)"
                name="Critical"
                radius={[0, 0, 0, 0]}
                animationBegin={0}
                animationDuration={800}
              />
              <Bar
                dataKey="high"
                stackId="a"
                fill="url(#highGradient)"
                name="High"
                radius={[0, 0, 0, 0]}
                animationBegin={200}
                animationDuration={800}
              />
              <Bar
                dataKey="medium"
                stackId="a"
                fill="url(#mediumGradient)"
                name="Medium"
                radius={[0, 0, 0, 0]}
                animationBegin={400}
                animationDuration={800}
              />
              <Bar
                dataKey="low"
                stackId="a"
                fill="url(#lowGradient)"
                name="Low"
                radius={[0, 0, 0, 0]}
                animationBegin={600}
                animationDuration={800}
              />
              <Bar
                dataKey="informational"
                stackId="a"
                fill="url(#infoGradient)"
                name="Info"
                radius={[4, 4, 0, 0]}
                animationBegin={800}
                animationDuration={800}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
