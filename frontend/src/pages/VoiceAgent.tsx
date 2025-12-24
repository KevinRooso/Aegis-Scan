/**
 * VoiceAgent - Cinematic voice-guided security scanning interface
 *
 * The HAL 9000-inspired experience where Aegis narrates the scan process
 * and UI elements fade in/out synchronized with voice events.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HalEye, type EyeState } from '../components/HalEye';
import { CinematicAnimator, FocusableCard, AnimatedSection } from '../components/CinematicAnimator';
import { DetailPanel, FindingDetailContent } from '../components/DetailPanel';
import { VoiceControls } from '../components/VoiceControls';
import { VoiceTranscript } from '../components/VoiceTranscript';
import { useVoiceSyncManager } from '../hooks/useVoiceSyncManager';
import { useFocusController } from '../hooks/useFocusController';
import { useElevenLabs } from '../hooks/useElevenLabs';
import { useScanWebsocket } from '../hooks/useWebsocket';
import { fetchScanStatus } from '../lib/api';
import { useScan } from '../contexts/ScanContext';
import type { ScanStatus, Finding, VoiceEvent } from '../types/api';
import { ScanForm } from '../components/ScanForm';
import { AgentProgressList } from '../components/AgentProgressList';
import { FindingsTable } from '../components/FindingsTable';
import { LogsPanel } from '../components/LogsPanel';

export function VoiceAgent() {
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [eyeState, setEyeState] = useState<EyeState>('idle');
  const [currentFindingIndex, setCurrentFindingIndex] = useState(0);
  const { activeScanId } = useScan();

  // Core synchronization systems
  const syncManager = useVoiceSyncManager();
  const focusController = useFocusController();

  // ElevenLabs voice integration
  const {
    isConnected,
    isSpeaking,
    startConversation,
    sendMessage,
    endConversation,
  } = useElevenLabs();

  // Fetch scan status
  const { data } = useQuery({
    queryKey: ['scan-status', activeScanId],
    queryFn: () => fetchScanStatus(activeScanId!),
    enabled: Boolean(activeScanId),
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (data) {
      setStatus(data);
    }
  }, [data]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((payload: any) => {
    setStatus(payload);

    // Check for voice events
    if (payload.voice_events && payload.voice_events.length > 0) {
      const latestEvent = payload.voice_events[payload.voice_events.length - 1];
      syncManager.handleVoiceEvent(latestEvent);
    }
  }, [syncManager]);

  useScanWebsocket({
    scanId: activeScanId ?? undefined,
    onMessage: handleWebSocketMessage,
  });

  // Get scan data early (before callbacks that use it)
  const progress = status?.progress ?? [];
  const findings = status?.findings ?? [];
  const logs = status?.logs ?? [];
  const voiceEvents = status?.voice_events ?? [];
  const criticalFindings = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );

  // Update eye state based on sync manager and voice state
  useEffect(() => {
    if (isSpeaking || syncManager.state.isAnimating) {
      setEyeState('speaking');
    } else if (syncManager.state.isPaused) {
      setEyeState('idle');
    } else if (isConnected || activeScanId) {
      setEyeState('listening');
    } else {
      setEyeState('idle');
    }
  }, [syncManager.state.isAnimating, syncManager.state.isPaused, activeScanId, isConnected, isSpeaking]);

  // Handle voice session toggle
  const handleVoiceToggle = useCallback(async () => {
    if (isConnected) {
      await endConversation();
    } else {
      await startConversation();

      // After starting conversation, send scan context if available
      if (activeScanId && findings.length > 0) {
        setTimeout(async () => {
          const criticalCount = findings.filter(f => f.severity === 'critical').length;
          const highCount = findings.filter(f => f.severity === 'high').length;
          const mediumCount = findings.filter(f => f.severity === 'medium').length;
          const lowCount = findings.filter(f => f.severity === 'low').length;
          const infoCount = findings.filter(f => f.severity === 'informational').length;

          const summary = `[SCAN CONTEXT]

A security scan has just completed!

Target: ${status?.target || 'the target'}
Total Findings: ${findings.length}

Severity Breakdown:
- Critical: ${criticalCount}
- High: ${highCount}
- Medium: ${mediumCount}
- Low: ${lowCount}
- Informational: ${infoCount}

INSTRUCTIONS:
When the user asks about the scan results, findings, or vulnerabilities:
1. IMMEDIATELY use your webhooks to get fresh data:
   - Use "get_latest_scan_summary" for overview and summary
   - Use "get_latest_scan_findings" for detailed findings (optionally filter by severity)
2. DO NOT rely only on this context message - always fetch live data
3. Explain findings in simple, developer-friendly terms
4. Focus on impact and remediation steps

The user is ready to discuss the scan results.`;

          try {
            await sendMessage(summary);
          } catch (err) {
            console.error('Failed to send scan context:', err);
          }
        }, 2000); // Wait 2 seconds for connection to stabilize
      }
    }
  }, [isConnected, startConversation, endConversation, sendMessage, activeScanId, findings, status]);

  // Handle scan start (note: scan ID is managed in Dashboard)
  const handleScanStart = useCallback((scanId: string) => {
    syncManager.focusComponent('scan-form');
  }, [syncManager]);

  // Handle finding click
  const handleFindingClick = useCallback((finding: Finding) => {
    syncManager.pauseNarration();
    focusController.openDetailPanel({
      componentId: 'finding-card',
      data: finding,
      title: finding.title,
    });
  }, [syncManager, focusController]);

  // Handle resume narration
  const handleResumeNarration = useCallback(() => {
    syncManager.resumeNarration();
    focusController.closeDetailPanel();
  }, [syncManager, focusController]);

  // Get component visibility
  const isVisible = (id: Parameters<typeof syncManager.isComponentVisible>[0]) =>
    syncManager.isComponentVisible(id);
  const isFocused = (id: Parameters<typeof syncManager.isComponentVisible>[0]) =>
    syncManager.state.currentFocus === id;

  // Navigation for cinematic walkthrough
  const handleNextFinding = useCallback(() => {
    if (currentFindingIndex < findings.length - 1) {
      setCurrentFindingIndex(prev => prev + 1);
    }
  }, [currentFindingIndex, findings.length]);

  const handlePrevFinding = useCallback(() => {
    if (currentFindingIndex > 0) {
      setCurrentFindingIndex(prev => prev - 1);
    }
  }, [currentFindingIndex]);

  const currentFinding = findings[currentFindingIndex];

  // Show simplified walkthrough message if scan complete but no voice session
  const showWalkthrough = activeScanId && findings.length > 0 && !isConnected;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-black via-slate-950 to-black">
      {/* Animated background grid */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]" />

      {/* Glowing orbs */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 animate-pulse-slow rounded-full bg-red-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 animate-pulse-slow rounded-full bg-cyan-500/10 blur-[120px] [animation-delay:1s]" />
      </div>

      {/* Vignette effect */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-radial-at-t from-transparent via-transparent to-black/60" />

      <div className="relative mx-auto max-w-7xl px-6 py-12">
        {/* HAL Eye - Always visible, center stage */}
        <div className="mb-16 flex flex-col items-center justify-center">
          <HalEye state={eyeState} />

          {/* Welcome Message */}
          {!activeScanId && (
            <div className="mt-8 max-w-2xl text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Welcome to Voice Agent Experience
              </h2>
              <p className="text-gray-400 text-lg">
                Complete a security scan in the Dashboard to unlock the cinematic voice-guided analysis experience.
              </p>
            </div>
          )}

          {/* Voice Controls */}
          {activeScanId && (
            <VoiceControls
              isConnected={isConnected}
              isSpeaking={isSpeaking}
              onToggle={handleVoiceToggle}
            />
          )}

          {/* Narration status */}
          {syncManager.state.isPaused && (
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-400">Narration paused</p>
              <button
                onClick={handleResumeNarration}
                className="mt-2 rounded-lg bg-aegis-red px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-aegis-red/80"
              >
                Resume Narration
              </button>
            </div>
          )}

          {/* Voice Transcript */}
          {voiceEvents.length > 0 && <VoiceTranscript events={voiceEvents} />}
        </div>

        {/* Enhanced Cinematic Scan Overview */}
        {activeScanId && findings.length > 0 && (
          <div className="mb-12 space-y-8">
            {/* Scan Summary Dashboard */}
            <motion.div
              className="mx-auto max-w-5xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Header Section */}
              <div className="mb-8 text-center">
                <motion.div
                  className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
                  <span className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                    Scan Complete
                  </span>
                </motion.div>

                <h2 className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-4xl font-bold text-transparent">
                  Security Analysis Report
                </h2>
                <p className="mt-2 text-gray-400">
                  {status?.target && <span className="font-mono text-cyan-400">{status.target}</span>}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  {
                    label: 'Total',
                    value: findings.length,
                    color: 'cyan',
                    icon: '📊',
                    bgFrom: 'from-cyan-500/10',
                    bgTo: 'to-blue-500/10',
                    borderColor: 'border-cyan-400/30',
                  },
                  {
                    label: 'Critical',
                    value: findings.filter(f => f.severity === 'critical').length,
                    color: 'red',
                    icon: '🔥',
                    bgFrom: 'from-red-500/10',
                    bgTo: 'to-rose-500/10',
                    borderColor: 'border-red-400/30',
                  },
                  {
                    label: 'High',
                    value: findings.filter(f => f.severity === 'high').length,
                    color: 'orange',
                    icon: '⚠️',
                    bgFrom: 'from-orange-500/10',
                    bgTo: 'to-amber-500/10',
                    borderColor: 'border-orange-400/30',
                  },
                  {
                    label: 'Medium & Low',
                    value: findings.filter(f => ['medium', 'low', 'informational'].includes(f.severity)).length,
                    color: 'green',
                    icon: '✓',
                    bgFrom: 'from-emerald-500/10',
                    bgTo: 'to-green-500/10',
                    borderColor: 'border-emerald-400/30',
                  },
                ].map((stat, idx) => (
                  <motion.div
                    key={stat.label}
                    className={`rounded-xl border bg-gradient-to-br p-5 backdrop-blur ${stat.bgFrom} ${stat.bgTo} ${stat.borderColor}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        {stat.label}
                      </span>
                      <span className="text-2xl">{stat.icon}</span>
                    </div>
                    <div className="mt-2 text-4xl font-bold text-white">{stat.value}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Interactive Finding Carousel - Only show when no voice session */}
            {showWalkthrough && currentFinding && (
              <motion.div
                className="mx-auto max-w-4xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
                      Finding Explorer
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {currentFindingIndex + 1} of {findings.length}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="flex-1 mx-8">
                    <div className="h-1 overflow-hidden rounded-full bg-gray-800">
                      <motion.div
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentFindingIndex + 1) / findings.length) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>

                  {/* Navigation arrows */}
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrevFinding}
                      disabled={currentFindingIndex === 0}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ←
                    </button>
                    <button
                      onClick={handleNextFinding}
                      disabled={currentFindingIndex === findings.length - 1}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      →
                    </button>
                  </div>
                </div>

                {/* Finding Card with Animation */}
                <motion.div
                  key={currentFinding.id}
                  className="relative overflow-hidden rounded-2xl border border-gray-700 bg-gradient-to-br from-slate-900/90 to-slate-950/90 shadow-2xl backdrop-blur"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.4 }}
                >
                  {/* Severity accent bar */}
                  <div
                    className={`h-1 ${
                      currentFinding.severity === 'critical'
                        ? 'bg-gradient-to-r from-red-500 to-rose-600'
                        : currentFinding.severity === 'high'
                        ? 'bg-gradient-to-r from-orange-500 to-amber-600'
                        : currentFinding.severity === 'medium'
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-600'
                        : 'bg-gradient-to-r from-emerald-500 to-green-600'
                    }`}
                  />

                  <div className="p-8">
                    {/* Header */}
                    <div className="mb-6 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase ${
                            currentFinding.severity === 'critical'
                              ? 'bg-red-500/20 text-red-300 border border-red-400/30'
                              : currentFinding.severity === 'high'
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-400/30'
                              : currentFinding.severity === 'medium'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {currentFinding.severity}
                        </span>
                        <span className="rounded-full bg-gray-800 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                          {currentFinding.source_agent}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-3xl font-bold leading-tight text-transparent">
                      {currentFinding.title}
                    </h3>

                    {/* Content Grid */}
                    <div className="space-y-6">
                      {/* Description */}
                      <div className="rounded-lg border border-gray-800 bg-black/30 p-5">
                        <div className="mb-3 flex items-center gap-2">
                          <div className="h-1 w-1 rounded-full bg-cyan-400" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                            Description
                          </h4>
                        </div>
                        <p className="leading-relaxed text-gray-300">
                          {currentFinding.description}
                        </p>
                      </div>

                      {/* Remediation */}
                      <div className="rounded-lg border border-gray-800 bg-black/30 p-5">
                        <div className="mb-3 flex items-center gap-2">
                          <div className="h-1 w-1 rounded-full bg-emerald-400" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                            Remediation
                          </h4>
                        </div>
                        <p className="leading-relaxed text-gray-300">
                          {currentFinding.remediation}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Quick Actions */}
                <div className="mt-6 flex items-center justify-center gap-4">
                  <button className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2 text-sm font-semibold text-gray-300 transition-all hover:border-gray-600 hover:bg-gray-800">
                    <span>📋</span>
                    <span>Copy Details</span>
                  </button>
                  <button className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400 transition-all hover:bg-cyan-500/20">
                    <span>🔍</span>
                    <span>View in Dashboard</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Removed all bottom sections - keeping UI clean and focused on the carousel above */}
      </div>

      {/* Detail Panel - Full-screen modal */}
      {focusController.focusedItem && (
        <DetailPanel
          isOpen={focusController.isDetailPanelOpen}
          onClose={focusController.closeDetailPanel}
          onResumeNarration={handleResumeNarration}
          title={focusController.focusedItem.title}
          severity={focusController.focusedItem.data.severity}
        >
          <FindingDetailContent finding={focusController.focusedItem.data} />
        </DetailPanel>
      )}
    </div>
  );
}
