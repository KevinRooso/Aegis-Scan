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
  const [isProcessing, setIsProcessing] = useState(false);
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
    const { action, data, card_type, card_data } = message;
    console.log('[VOICE FOCUS] Received:', { action, card_type, has_card_data: !!card_data });

    // If backend provides pre-rendered card data, use it directly
    if (card_type && card_data) {
      console.log(`[VOICE FOCUS] Using backend card: ${card_type}`);

      switch (card_type) {
        case 'finding':
          setCurrentContent({ type: 'finding', data: card_data.finding });
          setIsHalMinimized(true);
          break;

        case 'summary':
          setCurrentContent({ type: 'summary', data: card_data.status });
          setIsHalMinimized(true);
          break;

        case 'stats':
          // Extract stats from card_data
          const findings = card_data.status?.findings || [];
          const stats = {
            critical: findings.filter((f: any) => f.severity === 'critical').length,
            high: findings.filter((f: any) => f.severity === 'high').length,
            medium: findings.filter((f: any) => f.severity === 'medium').length,
            low: findings.filter((f: any) => f.severity === 'low').length,
            info: findings.filter((f: any) => f.severity === 'informational').length,
          };
          console.log('[VOICE FOCUS] Stats:', stats);
          setCurrentContent({ type: 'stats', data: stats });
          setIsHalMinimized(true);
          break;
      }
      return;
    }

    // Fallback to old logic if no card_data provided
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
      setIsProcessing(false); // Clear processing when speaking starts
    } else if (isConnected) {
      setEyeState('listening');
    } else {
      setEyeState('idle');
    }
  }, [isConnected, isSpeaking]);

  // Show processing indicator when agent is thinking (connected but not speaking)
  useEffect(() => {
    if (isConnected && !isSpeaking) {
      const timer = setTimeout(() => {
        setIsProcessing(true);
      }, 2000); // Show after 2 seconds of silence
      return () => clearTimeout(timer);
    } else {
      setIsProcessing(false);
    }
  }, [isConnected, isSpeaking]);

  // Handle voice session toggle
  const handleVoiceToggle = async () => {
    if (isConnected) {
      await endConversation();
      setIsHalMinimized(false);
      setCurrentContent({ type: null });
    } else {
      // Check if we have scan data before starting
      if (!status || !activeScanId) {
        console.error('Cannot start voice session: No scan data loaded');
        alert('Please wait for scan data to load before starting a voice session');
        return;
      }

      console.log('Starting voice session with scan:', activeScanId);
      await startConversation();

      // Send scan context after connection
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

CRITICAL INSTRUCTIONS FOR FOCUS COMMANDS:
- The scan_id for all focus_on_finding calls MUST be: ${activeScanId}
- Use focus_on_finding webhook to show findings visually
- Available actions: highlight_finding, show_summary, show_stats, clear
- ALWAYS call focus commands BEFORE explaining content
- Finding IDs are in format: ${activeScanId}_CVE-XXXX-XXXXX

You can now interact with me about these findings.`;

        console.log('Sending context to ElevenLabs:', { activeScanId, findingsCount: findings.length });
        await sendMessage(contextMessage);
      }, 2000);
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

      {/* Main presentation area - center stage with proper padding */}
      <div className="relative z-10 flex h-full items-center justify-center px-4 py-20">
        <AnimatePresence mode="wait">
          {currentContent.type === 'finding' ? (
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

      {/* HAL Eye - enhanced with better glow */}
      <motion.div
        className="absolute z-30"
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
          {/* Enhanced multi-layer glow effect */}
          <div className="absolute inset-0 -m-4 rounded-full bg-red-500/40 blur-3xl" />
          <div className="absolute inset-0 -m-2 rounded-full bg-red-600/30 blur-xl" />

          {/* HAL Eye component with shadow */}
          <div className="relative drop-shadow-2xl">
            <HalEye state={eyeState} />
          </div>

          {/* Voice status indicator when minimized */}
          {isHalMinimized && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap"
            >
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/90 px-3 py-1.5 backdrop-blur-xl shadow-lg">
                <div className={`h-2 w-2 rounded-full ${
                  isSpeaking ? 'bg-red-500 animate-pulse' :
                  isProcessing ? 'bg-yellow-500 animate-pulse' :
                  isConnected ? 'bg-green-500' :
                  'bg-gray-500'
                }`} />
                <span className="text-xs font-medium text-white">
                  {isSpeaking ? 'Speaking' :
                   isProcessing ? 'Processing...' :
                   isConnected ? 'Listening' :
                   'Offline'}
                </span>
              </div>
            </motion.div>
          )}

          {/* Processing indicator when not minimized - HAL 9000 style */}
          {!isHalMinimized && isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-32"
            >
              <div className="flex flex-col items-center gap-4">
                {/* Scanning line effect */}
                <div className="relative">
                  <motion.div
                    className="h-0.5 w-64 bg-gradient-to-r from-transparent via-red-500 to-transparent"
                    animate={{
                      x: [-256, 256],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <div className="absolute inset-0 h-0.5 w-64 bg-red-500/20" />
                </div>

                {/* Status text */}
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="text-center"
                >
                  <div className="text-sm font-mono text-red-500/80 tracking-widest uppercase">
                    Analyzing Security Data
                  </div>
                  <div className="mt-1 text-xs font-mono text-red-500/50">
                    Processing vulnerabilities...
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Voice control button - bottom-left - always visible */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-6 left-6 z-20 flex items-center gap-3 rounded-full border border-white/20 bg-black/90 px-6 py-3 backdrop-blur-xl transition-all hover:bg-black hover:border-white/30 shadow-xl"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleVoiceToggle}
      >
        <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
        <span className="font-semibold text-white">
          {isConnected ? 'End Session' : 'Start Voice Session'}
        </span>
      </motion.button>

      {/* Compact scan info - top-left - minimize when content is shown */}
      {status && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={currentContent.type === null ? {
            opacity: 1,
            x: 0,
            scale: 1,
          } : {
            opacity: 0.7,
            x: 0,
            scale: 0.9,
          }}
          className="absolute top-6 left-6 z-20 rounded-xl border border-white/10 bg-black/80 px-4 py-3 backdrop-blur-xl shadow-lg max-w-xs"
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Current Scan
          </div>
          <div className="mt-1 text-sm font-bold text-white truncate">
            {status.target}
          </div>
          {status.findings && (
            <div className="mt-1 text-xs text-cyan-400">
              {status.findings.length} findings
            </div>
          )}
        </motion.div>
      )}

      {/* Clear button - top-right - only show when content is displayed */}
      {currentContent.type && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="absolute top-6 right-6 z-20 rounded-full border border-white/20 bg-black/90 px-4 py-2 text-sm font-medium text-white backdrop-blur-xl transition-all hover:bg-black hover:border-white/30 shadow-lg"
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
