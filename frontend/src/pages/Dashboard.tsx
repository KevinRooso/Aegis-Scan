/**
 * Dashboard - Tabbed security intelligence interface
 *
 * Organized view with tabs for Overview, Findings, Graphs, and Logs.
 */

import { useCallback, useEffect, useMemo, useState, Suspense, lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";

import { AgentCommandCenter } from "../components/AgentCommandCenter";
import { FindingsGrid } from "../components/FindingsGrid";
import AnimatedStatsCard from "../components/AnimatedStatsCard";
import { LogsPanel } from "../components/LogsPanel";
import { ReportActions } from "../components/ReportActions";
import { ScanForm } from "../components/ScanForm";
import { fetchScanStatus } from "../lib/api";
import { useScan } from "../contexts/ScanContext";
import type { ScanStatus } from "../types/api";
import { Target, AlertTriangle, AlertOctagon, Shield, Loader2 } from 'lucide-react';

// Lazy load the heavy visualization component
const FindingsVisualizations = lazy(() =>
  import("../components/FindingsVisualizations").then(module => ({
    default: module.FindingsVisualizations
  }))
);

type TabId = "overview" | "findings" | "graphs" | "logs";

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: "overview", label: "Overview", icon: "⚡" },
  { id: "findings", label: "Findings", icon: "🔍" },
  { id: "graphs", label: "Analytics", icon: "📊" },
  { id: "logs", label: "Logs", icon: "📡" },
];

export function Dashboard() {
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [searchParams] = useSearchParams();
  const scanContext = useScan();
  const { activeScanId, setActiveScanId, setHasFindings, markScanComplete } = scanContext;

  // Check if scan_id is in query params (from History page)
  const queryScanId = searchParams.get('scan_id');
  const displayScanId = queryScanId || activeScanId;

  // Set active scan from query params
  useEffect(() => {
    if (queryScanId && queryScanId !== activeScanId) {
      console.log('Setting active scan from query params:', queryScanId);
      setActiveScanId(queryScanId);
    }
  }, [queryScanId, activeScanId, setActiveScanId]);

  const { data } = useQuery({
    queryKey: ["scan-status", displayScanId],
    queryFn: () => fetchScanStatus(displayScanId!),
    enabled: Boolean(displayScanId),
    refetchInterval: queryScanId ? undefined : 4000, // Don't auto-refresh historical scans
  });

  useEffect(() => {
    if (data) {
      setStatus(data);

      // Update scan context
      if (data.findings && data.findings.length > 0) {
        setHasFindings(true);
      }

      // Check if scan is complete (all agents completed)
      const allCompleted = data.progress.every(
        (p) => p.status === "completed" || p.status === "failed" || p.status === "skipped"
      );
      if (allCompleted && data.progress.length > 0) {
        markScanComplete();
      }
    }
  }, [data, setHasFindings, markScanComplete]);

  const handleStart = useCallback((scanId: string) => {
    setActiveScanId(scanId);
    setActiveTab("overview");
  }, [setActiveScanId]);

  const progress = status?.progress ?? [];
  const findings = status?.findings ?? [];
  const logs = status?.logs ?? [];

  const stats = useMemo(() => {
    const critical = findings.filter((finding) => finding.severity === "critical").length;
    const high = findings.filter((finding) => finding.severity === "high").length;
    const medium = findings.filter((finding) => finding.severity === "medium").length;
    const low = findings.filter((finding) => finding.severity === "low").length;
    const completedAgents = progress.filter((item) => item.status === "completed").length;
    return {
      total: findings.length,
      critical,
      high,
      medium,
      low,
      completedAgents,
      totalAgents: progress.length,
    };
  }, [findings, progress]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header Section */}
        <section className="rounded-2xl border border-cyan-500/20 bg-slate-900/50 p-8 shadow-xl shadow-cyan-500/5 backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50"></div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">
                  AegisScan Security Platform
                </p>
              </div>
              <h1 className="mt-2 bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-4xl font-bold text-transparent">
                Security Intelligence Dashboard
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-400">
                Advanced vulnerability detection and threat analysis powered by multi-agent AI
              </p>
            </div>
            <div className="space-y-2 rounded-xl border border-cyan-500/20 bg-black/40 p-4 text-sm backdrop-blur">
              <div className="flex items-center justify-between gap-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Scan ID</span>
                <span className="font-mono text-xs text-emerald-300">
                  {status?.scan_id ? `${status.scan_id.slice(0, 12)}...` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Target</span>
                <span className="max-w-xs truncate text-right text-xs text-slate-200">
                  {status?.target ?? "No active scan"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Status</span>
                <span className={`text-xs font-semibold ${stats.completedAgents === stats.totalAgents && stats.totalAgents > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {stats.completedAgents === stats.totalAgents && stats.totalAgents > 0 ? '✓ Complete' : '⟳ Running'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Overview */}
        {(findings.length > 0 || progress.length > 0) && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AnimatedStatsCard
              title="Total Findings"
              value={stats.total}
              icon={Target}
              severity="info"
            />
            <AnimatedStatsCard
              title="Critical"
              value={stats.critical}
              icon={AlertOctagon}
              severity="critical"
            />
            <AnimatedStatsCard
              title="High Severity"
              value={stats.high}
              icon={AlertTriangle}
              severity="high"
            />
            <AnimatedStatsCard
              title="Medium Severity"
              value={stats.medium}
              icon={Shield}
              severity="medium"
            />
          </section>
        )}

        {/* Tabs Navigation */}
        <div className="rounded-xl border border-cyan-500/20 bg-slate-900/30 p-1.5 backdrop-blur">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex-1 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all
                  ${
                    activeTab === tab.id
                      ? "border-cyan-400/60 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 shadow-lg shadow-cyan-500/20"
                      : "border-transparent text-slate-400 hover:border-slate-600/50 hover:bg-slate-800/50 hover:text-slate-300"
                  }
                `}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-lg border-2 border-cyan-400/40"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/50 p-6 shadow-xl backdrop-blur">
                  <ScanForm onStart={handleStart} />
                </div>

                <AgentCommandCenter items={progress} />

                <ReportActions scanId={activeScanId ?? undefined} />
              </div>
            )}

            {activeTab === "findings" && (
              <div className="space-y-6">
                <FindingsGrid findings={findings} />
              </div>
            )}

            {activeTab === "graphs" && (
              <div className="space-y-6">
                {findings.length > 0 ? (
                  <Suspense fallback={
                    <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/50 p-12 backdrop-blur">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                        <p className="text-sm font-semibold text-cyan-300">Loading Analytics...</p>
                        <p className="text-xs text-slate-400">Preparing data visualizations</p>
                      </div>
                    </div>
                  }>
                    <FindingsVisualizations findings={findings} />
                  </Suspense>
                ) : (
                  <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/50 p-12 text-center backdrop-blur">
                    <p className="text-slate-400">No findings data available. Start a scan to see visualizations.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "logs" && (
              <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/50 p-6 shadow-xl backdrop-blur">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-cyan-300">
                  <span>📡</span>
                  <span>Live Command Stream</span>
                  <span className="ml-auto text-xs font-normal text-slate-400">{logs.length} entries</span>
                </h3>
                <LogsPanel logs={logs} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
