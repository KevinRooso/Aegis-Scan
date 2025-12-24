/**
 * VoiceTranscript - Conversation history display
 *
 * Shows voice events from Aegis with automatic scrolling and timestamps.
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VoiceEvent } from '../types/api';

export interface VoiceTranscriptProps {
  events: VoiceEvent[];
  className?: string;
}

export function VoiceTranscript({ events, className = '' }: VoiceTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [events]);

  if (events.length === 0) {
    return null;
  }

  return (
    <motion.div
      className={`mt-12 w-full max-w-2xl ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Conversation Log
        </h3>
        <span className="text-xs text-gray-600">{events.length} messages</span>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg border-2 border-aegis-red/30 bg-aegis-black p-6 shadow-[0_0_20px_rgba(255,51,51,0.1)]">
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {events.map((event, i) => (
              <TranscriptMessage key={`${event.timestamp}-${i}`} event={event} index={i} />
            ))}
          </AnimatePresence>
          {/* Invisible scroll anchor */}
          <div ref={scrollRef} />
        </div>
      </div>
    </motion.div>
  );
}

interface TranscriptMessageProps {
  event: VoiceEvent;
  index: number;
}

function TranscriptMessage({ event, index }: TranscriptMessageProps) {
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'greeting':
        return '👋';
      case 'agent_start':
        return '🔍';
      case 'finding':
        return '⚠️';
      case 'thinking':
        return '💭';
      case 'completion':
        return '✅';
      default:
        return '🔊';
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'greeting':
        return 'text-blue-400';
      case 'agent_start':
        return 'text-yellow-400';
      case 'finding':
        return 'text-aegis-red';
      case 'thinking':
        return 'text-purple-400';
      case 'completion':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <motion.div
      className="flex flex-col space-y-1"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      {/* Timestamp and event type */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-base">{getEventIcon(event.event_type)}</span>
          <span className={`text-xs font-medium uppercase ${getEventColor(event.event_type)}`}>
            {event.event_type.replace('_', ' ')}
          </span>
        </div>
        <span className="text-xs text-gray-600">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Message content */}
      <motion.div
        className="relative pl-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {/* Connection line */}
        <div className="absolute left-2 top-0 h-full w-0.5 bg-aegis-red/20" />

        <div className="rounded-lg bg-aegis-red/5 p-3 backdrop-blur-sm">
          <p className="text-sm leading-relaxed text-gray-300">
            <span className="font-semibold text-aegis-red">AEGIS:</span>{' '}
            {event.message}
          </p>

          {/* Metadata if available */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className="mt-2 rounded bg-black/50 p-2">
              <pre className="overflow-x-auto text-xs text-gray-500">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
