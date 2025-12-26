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
  const [highlightedFindingId, setHighlightedFindingId] = useState<string | null>(null);
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

  // Handle voice focus commands from ElevenLabs
  const handleVoiceFocus = useCallback((message: any) => {
    const { action, data } = message;
    console.log('handleVoiceFocus called:', { action, data });

    switch (action) {
      case 'highlight_finding':
        if (data.finding_id) {
          console.log('Highlighting finding:', data.finding_id);

          // Find the actual finding in status that matches this CVE ID
          const matchingFinding = status?.findings?.find(f =>
            f.id.endsWith(data.finding_id) || f.id === data.finding_id
          );

          if (matchingFinding) {
            console.log('Found matching finding:', matchingFinding.id);

            // Find the index of this finding in the findings array
            const findingIndex = status?.findings?.findIndex(f => f.id === matchingFinding.id) ?? -1;

            if (findingIndex !== -1) {
              console.log('Navigating carousel to index:', findingIndex);
              // Navigate carousel to show this finding
              setCurrentFindingIndex(findingIndex);
            }

            // Set the highlight
            setHighlightedFindingId(matchingFinding.id);

            // Scroll to the finding after carousel updates
            setTimeout(() => {
              const element = document.getElementById(`finding-${matchingFinding.id}`);
              console.log('Looking for element with ID:', `finding-${matchingFinding.id}`, 'Found:', element);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } else {
                console.error('Element not found in DOM!');
              }
            }, 300);

            // Auto-clear highlight after 10 seconds
            setTimeout(() => {
              setHighlightedFindingId(null);
            }, 10000);
          } else {
            console.error('No matching finding found for:', data.finding_id);
          }
        } else {
          console.error('No finding_id in data:', data);
        }
        break;

      case 'show_critical':
      case 'show_high':
        // Filter findings by severity
        // This will be implemented with the filter component
        console.log(`Voice command: Show ${action.replace('show_', '')} findings`);
        break;

      case 'next_finding':
        setCurrentFindingIndex((prev) => {
          const findings = status?.findings ?? [];
          return prev < findings.length - 1 ? prev + 1 : prev;
        });
        break;

      case 'previous_finding':
        setCurrentFindingIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;

      case 'reset_view':
        setHighlightedFindingId(null);
        setCurrentFindingIndex(0);
        break;
    }
  }, [status]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((payload: any) => {
    console.log('WebSocket message received:', payload);

    // Check for voice focus commands FIRST
    if (payload.type === 'voice_focus') {
      console.log('Voice focus command:', payload.action, payload.data);
      handleVoiceFocus(payload);
      return; // Don't treat this as a scan status update
    }

    // Regular scan status update
    setStatus(payload);

    // Check for voice events
    if (payload.voice_events && payload.voice_events.length > 0) {
      const latestEvent = payload.voice_events[payload.voice_events.length - 1];
      syncManager.handleVoiceEvent(latestEvent);
    }
  }, [syncManager, handleVoiceFocus]);

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
            {/* Scan Summary Dashboard - Redesigned */}
            <motion.div
              className="mx-auto max-w-6xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Enhanced Stats Card */}
              <div className="overflow-hidden rounded-2xl border border-gray-700/50 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-8 shadow-2xl backdrop-blur">
                {/* Scan Info Header */}
                <div className="mb-8 border-b border-gray-700/50 pb-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-white">
                        {status?.target ? (
                          status.target.includes('github.com') ? (
                            status.target.split('/').slice(-1)[0]
                          ) : (
                            status.target
                          )
                        ) : (
                          'Security Analysis'
                        )}
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">
                        {status?.target && (
                          <span className="font-mono text-cyan-400">{status.target}</span>
                        )}
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Completed {status?.created_at ? new Date(status.created_at).toLocaleDateString() : ''}
                        </span>
                        {status?.created_at && (
                          <span>
                            {new Date(status.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2">
                      <button
                        className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 transition-all hover:bg-cyan-500/20"
                        title="Export report"
                      >
                        <span>↓</span>
                        <span>Export</span>
                      </button>
                      <button
                        className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-2 text-sm font-medium text-gray-300 transition-all hover:bg-gray-700/50"
                        title="Share link"
                      >
                        <span>🔗</span>
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Severity Stats - Horizontal Layout */}
                <div className="grid grid-cols-5 gap-4">
                  {[
                    {
                      label: 'Critical',
                      count: findings.filter(f => f.severity === 'critical').length,
                      color: 'red',
                      bgColor: 'bg-red-500/20',
                      borderColor: 'border-red-400/30',
                      textColor: 'text-red-400',
                      dotColor: 'bg-red-400',
                    },
                    {
                      label: 'High',
                      count: findings.filter(f => f.severity === 'high').length,
                      color: 'orange',
                      bgColor: 'bg-orange-500/20',
                      borderColor: 'border-orange-400/30',
                      textColor: 'text-orange-400',
                      dotColor: 'bg-orange-400',
                    },
                    {
                      label: 'Medium',
                      count: findings.filter(f => f.severity === 'medium').length,
                      color: 'amber',
                      bgColor: 'bg-amber-500/20',
                      borderColor: 'border-amber-400/30',
                      textColor: 'text-amber-400',
                      dotColor: 'bg-amber-400',
                    },
                    {
                      label: 'Low',
                      count: findings.filter(f => f.severity === 'low').length,
                      color: 'blue',
                      bgColor: 'bg-blue-500/20',
                      borderColor: 'border-blue-400/30',
                      textColor: 'text-blue-400',
                      dotColor: 'bg-blue-400',
                    },
                    {
                      label: 'Info',
                      count: findings.filter(f => f.severity === 'informational').length,
                      color: 'gray',
                      bgColor: 'bg-gray-500/20',
                      borderColor: 'border-gray-400/30',
                      textColor: 'text-gray-400',
                      dotColor: 'bg-gray-400',
                    },
                  ].map((stat, idx) => (
                    <motion.div
                      key={stat.label}
                      className="group cursor-pointer"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      whileHover={{ y: -2 }}
                    >
                      <div className={`rounded-xl border ${stat.borderColor} ${stat.bgColor} p-4 transition-all group-hover:shadow-lg`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-bold uppercase tracking-wide ${stat.textColor}`}>
                            {stat.label}
                          </span>
                          <div className={`h-2 w-2 rounded-full ${stat.dotColor}`} />
                        </div>
                        <div className="text-3xl font-bold text-white">{stat.count}</div>

                        {/* Mini progress bar */}
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-800">
                          <motion.div
                            className={`h-full ${stat.dotColor}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${findings.length > 0 ? (stat.count / findings.length) * 100 : 0}%` }}
                            transition={{ duration: 1, delay: idx * 0.1 }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Total Findings Summary */}
                <div className="mt-6 rounded-lg bg-gray-800/30 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/30">
                        <span className="text-lg">⚡</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-400">Total Findings</p>
                        <p className="text-2xl font-bold text-white">{findings.length}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Risk Level</p>
                      <p className={`text-sm font-bold ${
                        findings.some(f => f.severity === 'critical')
                          ? 'text-red-400'
                          : findings.some(f => f.severity === 'high')
                          ? 'text-orange-400'
                          : 'text-emerald-400'
                      }`}>
                        {findings.some(f => f.severity === 'critical')
                          ? 'CRITICAL'
                          : findings.some(f => f.severity === 'high')
                          ? 'HIGH'
                          : 'MODERATE'}
                      </p>
                    </div>
                  </div>
                </div>
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
                  id={`finding-${currentFinding.id}`}
                  key={currentFinding.id}
                  className={`relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur transition-all duration-500 ${
                    highlightedFindingId === currentFinding.id
                      ? 'border-red-400 bg-gradient-to-br from-red-900/30 to-slate-950/90 shadow-red-500/50'
                      : 'border-gray-700 bg-gradient-to-br from-slate-900/90 to-slate-950/90'
                  }`}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: highlightedFindingId === currentFinding.id ? 1.02 : 1,
                  }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.4 }}
                >
                  {/* Highlight pulse effect */}
                  {highlightedFindingId === currentFinding.id && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl border-2 border-red-400"
                      animate={{
                        opacity: [0.3, 0.6, 0.3],
                        scale: [1, 1.01, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                  )}

                  {/* Thick left accent bar - signature visual element */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-2 ${
                      currentFinding.severity === 'critical'
                        ? 'bg-gradient-to-b from-red-500 to-rose-600'
                        : currentFinding.severity === 'high'
                        ? 'bg-gradient-to-b from-orange-500 to-amber-600'
                        : currentFinding.severity === 'medium'
                        ? 'bg-gradient-to-b from-amber-500 to-yellow-600'
                        : currentFinding.severity === 'low'
                        ? 'bg-gradient-to-b from-blue-500 to-cyan-600'
                        : 'bg-gradient-to-b from-gray-500 to-slate-600'
                    }`}
                  />

                  <div className="p-8 pl-10">
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

                    {/* Title with CVE ID if available */}
                    <div className="mb-6">
                      <h3 className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-3xl font-bold leading-tight text-transparent">
                        {currentFinding.title}
                      </h3>
                      {currentFinding.id.startsWith('CVE-') && (
                        <p className="mt-2 font-mono text-sm text-gray-500">
                          {currentFinding.id}
                        </p>
                      )}
                    </div>

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

                {/* Quick Actions - Enhanced */}
                <div className="mt-6 flex items-center justify-center gap-3">
                  <motion.button
                    className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-5 py-2.5 text-sm font-medium text-cyan-400 transition-all hover:bg-cyan-500/20"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span>📋</span>
                    <span>Copy Details</span>
                  </motion.button>
                  {currentFinding.id.startsWith('CVE-') && (
                    <motion.button
                      className="flex items-center gap-2 rounded-lg border border-blue-400/30 bg-blue-500/10 px-5 py-2.5 text-sm font-medium text-blue-400 transition-all hover:bg-blue-500/20"
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span>🔍</span>
                      <span>View CVE</span>
                    </motion.button>
                  )}
                  <motion.button
                    className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800/50 px-5 py-2.5 text-sm font-medium text-gray-300 transition-all hover:bg-gray-700/50"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span>↓</span>
                    <span>Export</span>
                  </motion.button>
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
