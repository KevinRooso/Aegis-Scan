import { motion } from 'framer-motion';
import {
  Shield,
  Package,
  Key,
  Zap,
  Search,
  Target,
  Brain,
  AlertTriangle,
  FileText,
} from 'lucide-react';

import type { AgentProgress } from '../types/api';

interface Props {
  items: AgentProgress[];
}

// Map agent names to icons
const agentIcons: Record<string, typeof Shield> = {
  static: Shield,
  dependency: Package,
  secret: Key,
  dast: Zap,
  fuzzer: Search,
  template: Target,
  adaptive: Brain,
  threat: AlertTriangle,
  report: FileText,
};

// Status color mappings
const statusColors: Record<AgentProgress['status'], { ring: string; fill: string; glow: string; text: string }> = {
  pending: {
    ring: 'stroke-slate-600',
    fill: 'stroke-slate-400',
    glow: 'shadow-slate-500/20',
    text: 'text-slate-400',
  },
  running: {
    ring: 'stroke-cyan-600',
    fill: 'stroke-cyan-400',
    glow: 'shadow-cyan-500/50',
    text: 'text-cyan-300',
  },
  completed: {
    ring: 'stroke-emerald-600',
    fill: 'stroke-emerald-400',
    glow: 'shadow-emerald-500/30',
    text: 'text-emerald-300',
  },
  failed: {
    ring: 'stroke-red-600',
    fill: 'stroke-red-400',
    glow: 'shadow-red-500/50',
    text: 'text-red-300',
  },
  skipped: {
    ring: 'stroke-amber-600',
    fill: 'stroke-amber-400',
    glow: 'shadow-amber-500/30',
    text: 'text-amber-300',
  },
};

interface AgentCardProps {
  agent: AgentProgress;
  index: number;
}

function AgentCard({ agent, index }: AgentCardProps) {
  const Icon = agentIcons[agent.agent] || Shield;
  const colors = statusColors[agent.status];
  const progress = agent.percent_complete || 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className={`relative overflow-hidden rounded-xl backdrop-blur-xl bg-slate-900/95 border border-white/10 shadow-2xl ${
        colors.glow
      } p-6 ${agent.status === 'running' ? 'animate-pulse' : ''}`}
    >
      {/* Scan line animation for running agents */}
      {agent.status === 'running' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{
              y: ['0%', '100%'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="absolute w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
            style={{ top: -4 }}
          />
        </div>
      )}

      {/* Circular progress */}
      <div className="flex flex-col items-center">
        <div className="relative">
          <svg className="w-24 h-24 transform -rotate-90">
            {/* Background ring */}
            <circle
              cx="48"
              cy="48"
              r={radius}
              fill="none"
              className={colors.ring}
              strokeWidth="6"
              opacity="0.3"
            />
            {/* Progress ring */}
            <circle
              cx="48"
              cy="48"
              r={radius}
              fill="none"
              className={colors.fill}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.5s ease-in-out',
              }}
            />
          </svg>

          {/* Icon in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className={`w-8 h-8 ${colors.text}`} />
          </div>
        </div>

        {/* Agent name */}
        <div className="mt-4 text-center">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-1">{agent.agent}</h3>
          <div className="flex items-center justify-center gap-2">
            <span className={`text-xs font-semibold uppercase ${colors.text}`}>{agent.status}</span>
            {agent.status === 'running' && (
              <span className={`text-xs font-bold ${colors.text}`}>{Math.round(progress)}%</span>
            )}
          </div>
          {agent.message && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{agent.message}</p>}
        </div>
      </div>
    </motion.div>
  );
}

export function AgentCommandCenter({ items }: Props) {
  // Calculate summary stats
  const stats = items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="rounded-3xl border border-white/5 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Security Agents</p>
        <h3 className="text-2xl font-semibold text-white">Command Center</h3>
        <p className="text-sm text-slate-400">Real-time agent status and execution monitoring</p>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
        {items.map((agent, index) => (
          <AgentCard key={agent.agent} agent={agent} index={index} />
        ))}
      </div>

      {/* Status summary */}
      <div className="flex flex-wrap gap-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-400" />
          <span className="text-xs font-semibold text-slate-400">Pending: {stats.pending || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-semibold text-cyan-300">Running: {stats.running || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
          <span className="text-xs font-semibold text-emerald-300">Completed: {stats.completed || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <span className="text-xs font-semibold text-red-300">Failed: {stats.failed || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="text-xs font-semibold text-amber-300">Skipped: {stats.skipped || 0}</span>
        </div>
      </div>
    </div>
  );
}
