/**
 * FindingsVisualizations - Data visualization components for security findings
 *
 * Provides various chart types to visualize findings data:
 * - Severity distribution (pie chart)
 * - Findings by agent (bar chart)
 * - Severity breakdown by agent (stacked bar chart)
 */

import { useMemo } from "react";
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
} from "recharts";

import type { Finding } from "../types/api";

interface Props {
  findings: Finding[];
}

const SEVERITY_COLORS = {
  critical: "#f43f5e",  // rose-500
  high: "#fb923c",      // orange-400
  medium: "#fbbf24",    // amber-400
  low: "#34d399",       // emerald-400
  informational: "#94a3b8", // slate-400
} as const;

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "informational"] as const;

export function FindingsVisualizations({ findings }: Props) {
  // Calculate severity distribution
  const severityData = useMemo(() => {
    const counts: Record<string, number> = {};
    findings.forEach((f) => {
      counts[f.severity] = (counts[f.severity] || 0) + 1;
    });

    return SEVERITY_ORDER
      .filter(sev => counts[sev] > 0)
      .map((severity) => ({
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
      agentCounts[f.source_agent][f.severity] =
        (agentCounts[f.source_agent][f.severity] || 0) + 1;
    });

    return Object.entries(agentCounts).map(([agent, severities]) => ({
      agent: agent.toUpperCase(),
      critical: severities.critical || 0,
      high: severities.high || 0,
      medium: severities.medium || 0,
      low: severities.low || 0,
      informational: severities.informational || 0,
      total: Object.values(severities).reduce((sum, val) => sum + val, 0),
    }));
  }, [findings]);

  if (!findings.length) {
    return (
      <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-8 text-center text-sm text-slate-400">
        No findings to visualize. Launch a scan to see analytics.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Severity Distribution */}
      <div className="rounded-3xl border border-white/5 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Severity Distribution
          </p>
          <h3 className="text-2xl font-semibold text-white">
            Risk breakdown
          </h3>
          <p className="text-sm text-slate-400">
            Visual distribution of findings by severity level
          </p>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={severityData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {severityData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#fff'
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          {severityData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-slate-300">
                {item.name}: {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Findings by Agent */}
      <div className="rounded-3xl border border-white/5 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Findings by Agent
          </p>
          <h3 className="text-2xl font-semibold text-white">
            Agent performance
          </h3>
          <p className="text-sm text-slate-400">
            Number of findings discovered by each security agent
          </p>
        </div>

        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={agentData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="agent"
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#fff'
              }}
            />
            <Legend
              wrapperStyle={{ color: '#94a3b8' }}
            />
            <Bar dataKey="critical" stackId="a" fill={SEVERITY_COLORS.critical} name="Critical" />
            <Bar dataKey="high" stackId="a" fill={SEVERITY_COLORS.high} name="High" />
            <Bar dataKey="medium" stackId="a" fill={SEVERITY_COLORS.medium} name="Medium" />
            <Bar dataKey="low" stackId="a" fill={SEVERITY_COLORS.low} name="Low" />
            <Bar dataKey="informational" stackId="a" fill={SEVERITY_COLORS.informational} name="Info" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Findings"
          value={findings.length}
          color="emerald"
        />
        <StatCard
          label="Critical"
          value={findings.filter(f => f.severity === "critical").length}
          color="rose"
        />
        <StatCard
          label="High"
          value={findings.filter(f => f.severity === "high").length}
          color="orange"
        />
        <StatCard
          label="Agents Active"
          value={new Set(findings.map(f => f.source_agent)).size}
          color="sky"
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: "emerald" | "rose" | "orange" | "sky";
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorClasses = {
    emerald: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/40",
    rose: "text-rose-300 bg-rose-500/10 ring-rose-500/40",
    orange: "text-orange-300 bg-orange-500/10 ring-orange-500/40",
    sky: "text-sky-300 bg-sky-500/10 ring-sky-500/40",
  };

  return (
    <div className={`rounded-2xl border border-white/5 ${colorClasses[color].split(' ')[1]} p-4 ring-1 ${colorClasses[color].split(' ')[2]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${colorClasses[color].split(' ')[0]}`}>
        {value}
      </p>
    </div>
  );
}
