/**
 * VoiceSyncManager - Cinematic synchronization between voice narration and UI
 *
 * Maps voice events from Aegis to specific UI components and orchestrates
 * fade in/out animations to create a guided, documentary-like experience.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type ComponentId =
  | 'scan-form'
  | 'agent-progress'
  | 'findings-table'
  | 'finding-card'
  | 'critical-finding'
  | 'dependency-table'
  | 'secret-finding'
  | 'report-summary'
  | 'logs-panel'
  | 'hal-eye'
  | 'none';

export interface VoiceEvent {
  scan_id: string;
  event_type: 'greeting' | 'agent_start' | 'finding' | 'completion' | 'thinking';
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface VoiceSyncState {
  currentFocus: ComponentId;
  previousFocus: ComponentId;
  isAnimating: boolean;
  isPaused: boolean;
  voiceEvents: VoiceEvent[];
}

export interface VoiceSyncManager {
  state: VoiceSyncState;
  focusComponent: (id: ComponentId, smooth?: boolean) => void;
  transitionTo: (id: ComponentId) => void;
  pauseNarration: () => void;
  resumeNarration: () => void;
  handleVoiceEvent: (event: VoiceEvent) => void;
  isComponentVisible: (id: ComponentId) => boolean;
}

/**
 * Maps voice event types and metadata to specific UI components
 */
function mapVoiceEventToComponent(event: VoiceEvent): ComponentId {
  const { event_type, message, metadata } = event;

  // Greeting - focus on HAL eye and scan form
  if (event_type === 'greeting') {
    return 'scan-form';
  }

  // Agent start - focus on progress tracker
  if (event_type === 'agent_start') {
    return 'agent-progress';
  }

  // Findings - focus on specific finding cards
  if (event_type === 'finding') {
    const severity = metadata?.severity?.toLowerCase();

    if (severity === 'critical' || severity === 'high') {
      return 'critical-finding';
    }

    // Check for specific finding types
    if (message.toLowerCase().includes('secret')) {
      return 'secret-finding';
    }

    if (message.toLowerCase().includes('dependency') || message.toLowerCase().includes('vulnerable package')) {
      return 'dependency-table';
    }

    return 'finding-card';
  }

  // Thinking - keep current focus or show logs
  if (event_type === 'thinking') {
    return 'logs-panel';
  }

  // Completion - show report summary
  if (event_type === 'completion') {
    return 'report-summary';
  }

  return 'none';
}

export function useVoiceSyncManager(): VoiceSyncManager {
  const [state, setState] = useState<VoiceSyncState>({
    currentFocus: 'hal-eye',
    previousFocus: 'none',
    isAnimating: false,
    isPaused: false,
    voiceEvents: [],
  });

  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transitionQueueRef = useRef<ComponentId[]>([]);

  /**
   * Focus on a specific component (with optional smooth transition)
   */
  const focusComponent = useCallback((id: ComponentId, smooth = true) => {
    if (state.isPaused && smooth) return;

    setState(prev => ({
      ...prev,
      previousFocus: prev.currentFocus,
      currentFocus: id,
      isAnimating: smooth,
    }));

    if (smooth) {
      // Clear existing timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      // Mark animation as complete after 500ms (fade duration)
      animationTimeoutRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, isAnimating: false }));
      }, 500);
    }
  }, [state.isPaused]);

  /**
   * Transition from current component to a new one with fade out/in
   */
  const transitionTo = useCallback((id: ComponentId) => {
    // If already animating, queue the transition
    if (state.isAnimating) {
      transitionQueueRef.current.push(id);
      return;
    }

    focusComponent(id, true);
  }, [state.isAnimating, focusComponent]);

  /**
   * Process queued transitions after animation completes
   */
  useEffect(() => {
    if (!state.isAnimating && transitionQueueRef.current.length > 0) {
      const nextComponent = transitionQueueRef.current.shift();
      if (nextComponent) {
        transitionTo(nextComponent);
      }
    }
  }, [state.isAnimating, transitionTo]);

  /**
   * Pause the narration (user clicked something)
   */
  const pauseNarration = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: true }));
    // Clear transition queue
    transitionQueueRef.current = [];
  }, []);

  /**
   * Resume the narration
   */
  const resumeNarration = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: false }));
  }, []);

  /**
   * Handle incoming voice event from backend
   */
  const handleVoiceEvent = useCallback((event: VoiceEvent) => {
    // Add event to history
    setState(prev => ({
      ...prev,
      voiceEvents: [...prev.voiceEvents, event],
    }));

    // Don't auto-transition if paused
    if (state.isPaused) return;

    // Map event to component and transition
    const targetComponent = mapVoiceEventToComponent(event);

    if (targetComponent !== 'none' && targetComponent !== state.currentFocus) {
      transitionTo(targetComponent);
    }
  }, [state.isPaused, state.currentFocus, transitionTo]);

  /**
   * Check if a component should be visible
   */
  const isComponentVisible = useCallback((id: ComponentId): boolean => {
    return state.currentFocus === id || state.previousFocus === id;
  }, [state.currentFocus, state.previousFocus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  return {
    state,
    focusComponent,
    transitionTo,
    pauseNarration,
    resumeNarration,
    handleVoiceEvent,
    isComponentVisible,
  };
}
