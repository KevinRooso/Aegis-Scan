import { useMemo, useState } from "react";

import type { Finding } from "../types/api";

interface Props {
  findings: Finding[];
}

const severityPalette: Record<
  Finding["severity"],
  { text: string; bg: string; ring: string; label: string }
> = {
  critical: {
    text: "text-rose-200",
    bg: "bg-rose-500/10",
    ring: "ring-rose-500/40",
    label: "Critical",
  },
  high: {
    text: "text-orange-200",
    bg: "bg-orange-500/10",
    ring: "ring-orange-500/40",
    label: "High",
  },
  medium: {
    text: "text-amber-200",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/40",
    label: "Medium",
  },
  low: {
    text: "text-emerald-200",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/40",
    label: "Low",
  },
  informational: {
    text: "text-slate-200",
    bg: "bg-slate-500/10",
    ring: "ring-slate-500/40",
    label: "Info",
  },
};

const severityFilters: Array<{ label: string; value: Finding["severity"] | "all" }> = [
  { label: "All severities", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
  { label: "Info", value: "informational" },
];

export function FindingsTable({ findings }: Props) {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<(typeof severityFilters)[number]["value"]>("all");

  const filteredFindings = useMemo(() => {
    return findings.filter((finding) => {
      const matchesSeverity = severity === "all" || finding.severity === severity;
      const normalized = `${finding.title} ${finding.description} ${finding.source_agent}`.toLowerCase();
      const matchesQuery = normalized.includes(search.trim().toLowerCase());
      return matchesSeverity && matchesQuery;
    });
  }, [findings, search, severity]);

  if (!findings.length) {
    return (
      <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-8 text-sm text-slate-400">
        No findings yet. Launch a scan to populate results.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/5 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Findings
          </p>
          <h3 className="text-2xl font-semibold text-white">
            {filteredFindings.length} of {findings.length} surfaced issues
          </h3>
          <p className="text-sm text-slate-400">
            Search, filter, and prioritize remediation work without leaving the dashboard.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:max-w-sm">
          <div className="relative">
            <input
              type="search"
              placeholder="Search findings, agents, or remediations…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400/60 focus:outline-none"
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
                      ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200"
                      : "border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 max-h-[560px] overflow-hidden rounded-2xl border border-white/5">
        <div className="max-h-[560px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-950/95 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 backdrop-blur">
              <tr>
                <th className="px-5 py-4">Finding</th>
                <th className="px-5 py-4">Severity</th>
                <th className="px-5 py-4">Agent</th>
                <th className="px-5 py-4">Remediation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredFindings.map((finding) => {
                const palette = severityPalette[finding.severity];
                return (
                  <tr
                    key={finding.id}
                    className="bg-slate-900/40 transition hover:bg-slate-900/80"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">{finding.title}</p>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-3">
                        {finding.description}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${palette.bg} ${palette.text} ring-1 ${palette.ring}`}
                      >
                        <span className="h-2 w-2 rounded-full bg-current" />
                        {palette.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-200">
                        {finding.source_agent}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-200">
                      <p className="text-xs leading-relaxed text-slate-300">{finding.remediation}</p>
                      {finding.metadata?.references && Array.isArray(finding.metadata.references) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(finding.metadata.references as string[]).slice(0, 2).map((ref) => (
                            <a
                              key={ref}
                              href={ref}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                            >
                              Reference
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredFindings.length && (
            <div className="flex items-center justify-center px-5 py-10 text-sm text-slate-400">
              No findings match your filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
