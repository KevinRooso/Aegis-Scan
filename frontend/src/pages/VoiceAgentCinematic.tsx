/**
 * VoiceAgentCinematic - Full cinematic presentation mode
 * HAL Eye in bottom-right, content cards fade in/out center stage
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { HalEye, type EyeState } from '../components/HalEye';
import { PresentationCard } from '../components/PresentationCard';
import { useElevenLabs } from '../hooks/useElevenLabs';
import { useScanWebsocket } from '../hooks/useWebsocket';
import { fetchScanStatus } from '../lib/api';
import { useScan } from '../contexts/ScanContext';
import type { ScanStatus, Finding } from '../types/api';

type ContentType = 'summary' | 'stats' | 'finding' | 'agent-status' | null;

interface ContentState {
  type: ContentType;
  data?: any;
}

export function VoiceAgentCinematic() {
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [eyeState, setEyeState] = useState<EyeState>('idle');
  const [currentContent, setCurrentContent] = useState<ContentState>({ type: null });
  const [isHalMinimized, setIsHalMinimized] = useState(false);
  const { activeScanId } = useScan();

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
    enabled: !!activeScanId,
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
    console.log('Voice focus command:', action, data);

    switch (action) {
      case 'highlight_finding':
        if (data.finding_id && status?.findings) {
          // Find matching finding
          const finding = status.findings.find(f =>
            f.id.endsWith(data.finding_id) || f.id === data.finding_id
          );

          if (finding) {
            console.log('Showing finding card:', finding.id);
            setCurrentContent({ type: 'finding', data: finding });
            // Minimize HAL eye when showing content
            setIsHalMinimized(true);
          }
        }
        break;

      case 'show_summary':
        if (status) {
          console.log('Showing summary card');
          setCurrentContent({ type: 'summary', data: status });
          setIsHalMinimized(true);
        }
        break;

      case 'show_stats':
      case 'show_critical':
      case 'show_high':
        if (status?.findings) {
          const findings = status.findings;
          const stats = {
            critical: findings.filter(f => f.severity === 'critical').length,
            high: findings.filter(f => f.severity === 'high').length,
            medium: findings.filter(f => f.severity === 'medium').length,
            low: findings.filter(f => f.severity === 'low').length,
            info: findings.filter(f => f.severity === 'informational').length,
          };
          console.log('Showing stats card');
          setCurrentContent({ type: 'stats', data: stats });
          setIsHalMinimized(true);
        }
        break;

      case 'reset_view':
      case 'clear':
        console.log('Clearing content');
        setCurrentContent({ type: null });
        setIsHalMinimized(false);
        break;

      default:
        console.log('Unknown action:', action);
    }
  }, [status]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((payload: any) => {
    console.log('WebSocket message:', payload);

    // Check for voice focus commands
    if (payload.type === 'voice_focus') {
      handleVoiceFocus(payload);
      return;
    }

    // Regular scan status update
    setStatus(payload);
  }, [handleVoiceFocus]);

  // Connect WebSocket
  useScanWebsocket({
    scanId: activeScanId ?? undefined,
    onMessage: handleWebSocketMessage,
  });

  // Update eye state based on voice connection
  useEffect(() => {
    if (isSpeaking) {
      setEyeState('speaking');
    } else if (isConnected) {
      setEyeState('listening');
    } else {
      setEyeState('idle');
    }
  }, [isConnected, isSpeaking]);

  // Handle voice session toggle
  const handleVoiceToggle = async () => {
    if (isConnected) {
      await endConversation();
      setIsHalMinimized(false);
      setCurrentContent({ type: null });
    } else {
      await startConversation();

      // Send scan context after connection
      if (status && activeScanId) {
        setTimeout(async () => {
          const findings = status.findings || [];
          const severityCounts = {
            critical: findings.filter(f => f.severity === 'critical').length,
            high: findings.filter(f => f.severity === 'high').length,
            medium: findings.filter(f => f.severity === 'medium').length,
            low: findings.filter(f => f.severity === 'low').length,
            info: findings.filter(f => f.severity === 'informational').length,
          };

          const contextMessage = `[SCAN CONTEXT]
A security scan has completed for: ${status.target}

Total Findings: ${findings.length}
- Critical: ${severityCounts.critical}
- High: ${severityCounts.high}
- Medium: ${severityCounts.medium}
- Low: ${severityCounts.low}
- Info: ${severityCounts.info}

Scan ID: ${activeScanId}

INSTRUCTIONS:
- Use get_latest_scan_findings webhook for detailed findings
- Use focus_on_finding webhook to show findings visually
- Available actions: highlight_finding, show_summary, show_stats, reset_view
- Always call focus commands BEFORE explaining content

You can now interact with me about these findings.`;

          await sendMessage(contextMessage);
        }, 2000);
      }
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* Animated background */}
      <div className="absolute inset-0">
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />

        {/* Radial gradients */}
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />

        {/* Scan lines effect */}
        <motion.div
          className="absolute inset-0 bg-[linear-gradient(0deg,transparent_50%,rgba(56,189,248,0.03)_50%)] bg-[length:100%_4px]"
          animate={{ backgroundPosition: ['0% 0%', '0% 100%'] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Main presentation area - center stage */}
      <div className="relative z-10 flex h-full items-center justify-center p-8">
        <AnimatePresence mode="wait">
          {currentContent.type === null ? (
            // Welcome/Idle state
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="mb-8 text-8xl"
              >
                👁️
              </motion.div>
              <h1 className="mb-4 text-5xl font-bold text-white">
                {isConnected ? 'Listening...' : 'Ready'}
              </h1>
              <p className="text-xl text-gray-400">
                {isConnected
                  ? 'Ask me about the scan results'
                  : 'Start a voice session to begin'}
              </p>

              {!isConnected && status && status.findings && status.findings.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  onClick={handleVoiceToggle}
                  className="mt-8 rounded-full border border-cyan-500/50 bg-cyan-500/10 px-8 py-4 text-lg font-semibold text-cyan-400 transition-all hover:bg-cyan-500/20 hover:border-cyan-400"
                >
                  Start Voice Session
                </motion.button>
              )}
            </motion.div>
          ) : currentContent.type === 'finding' ? (
            <PresentationCard
              key={`finding-${currentContent.data.id}`}
              type="finding"
              finding={currentContent.data}
            />
          ) : currentContent.type === 'summary' ? (
            <PresentationCard
              key="summary"
              type="summary"
              status={currentContent.data}
            />
          ) : currentContent.type === 'stats' ? (
            <PresentationCard
              key="stats"
              type="stats"
              stats={currentContent.data}
            />
          ) : currentContent.type === 'agent-status' ? (
            <PresentationCard
              key="agent-status"
              type="agent-status"
              agentName={currentContent.data.agentName}
              status={currentContent.data.status}
              message={currentContent.data.message}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {/* HAL Eye - transitions between center and bottom-right */}
      <motion.div
        className="absolute z-20"
        animate={isHalMinimized ? {
          bottom: '2rem',
          right: '2rem',
          top: 'auto',
          left: 'auto',
          scale: 0.5,
        } : {
          bottom: 'auto',
          right: 'auto',
          top: '50%',
          left: '50%',
          scale: 1,
          x: '-50%',
          y: '-50%',
        }}
        transition={{
          duration: 0.8,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full bg-red-500/30 blur-2xl" />

          {/* HAL Eye component */}
          <div className="relative">
            <HalEye state={eyeState} />
          </div>

          {/* Voice controls when minimized */}
          {isHalMinimized && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap"
            >
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-4 py-2 backdrop-blur-xl">
                <div className={`h-2 w-2 rounded-full ${isSpeaking ? 'bg-red-500 animate-pulse' : isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-sm font-medium text-white">
                  {isSpeaking ? 'Speaking' : isConnected ? 'Listening' : 'Offline'}
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Voice control button - bottom-left */}
      <motion.button
        className="absolute bottom-8 left-8 z-20 flex items-center gap-3 rounded-full border border-white/10 bg-black/80 px-6 py-3 backdrop-blur-xl transition-all hover:bg-black/90 hover:border-white/20"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleVoiceToggle}
      >
        <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
        <span className="font-semibold text-white">
          {isConnected ? 'End Session' : 'Start Voice Session'}
        </span>
      </motion.button>

      {/* Scan info - top-left */}
      {status && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-8 left-8 z-20 rounded-2xl border border-white/10 bg-black/60 px-6 py-4 backdrop-blur-xl"
        >
          <div className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Current Scan
          </div>
          <div className="mt-1 text-lg font-bold text-white">
            {status.target}
          </div>
          {status.findings && (
            <div className="mt-2 text-sm text-cyan-400">
              {status.findings.length} findings
            </div>
          )}
        </motion.div>
      )}

      {/* Debug clear button - top-right */}
      {currentContent.type && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-8 right-8 z-20 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-xl transition-all hover:bg-black/80"
          onClick={() => {
            setCurrentContent({ type: null });
            setIsHalMinimized(false);
          }}
        >
          Clear View
        </motion.button>
      )}
    </div>
  );
}
