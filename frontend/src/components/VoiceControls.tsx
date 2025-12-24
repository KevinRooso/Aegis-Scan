/**
 * VoiceControls - Enhanced controls for voice agent session
 *
 * Provides clean toggle button and status indicator for ElevenLabs connection.
 */

import { motion } from 'framer-motion';

export interface VoiceControlsProps {
  isConnected: boolean;
  isSpeaking: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function VoiceControls({
  isConnected,
  isSpeaking,
  onToggle,
  disabled = false,
}: VoiceControlsProps) {
  const getStatusText = () => {
    if (isSpeaking) return 'Transmitting';
    if (isConnected) return 'Active';
    return 'Offline';
  };

  const getStatusColor = () => {
    if (isSpeaking) return 'text-red-400';
    if (isConnected) return 'text-emerald-400';
    return 'text-slate-500';
  };

  const getStatusBgColor = () => {
    if (isSpeaking) return 'bg-red-500/20 border-red-400/30';
    if (isConnected) return 'bg-emerald-500/20 border-emerald-400/30';
    return 'bg-slate-500/10 border-slate-500/20';
  };

  return (
    <div className="mt-16 flex flex-col items-center space-y-6">
      {/* Status card - Better aligned and positioned */}
      <motion.div
        className={`flex items-center gap-3 rounded-full border px-6 py-3 backdrop-blur-sm ${getStatusBgColor()}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Animated status indicator */}
        <motion.div
          className={`relative h-2.5 w-2.5 rounded-full ${
            isSpeaking
              ? 'bg-red-400'
              : isConnected
              ? 'bg-emerald-400'
              : 'bg-slate-500'
          }`}
          animate={{
            scale: isSpeaking || isConnected ? [1, 1.3, 1] : 1,
            opacity: isSpeaking || isConnected ? [1, 0.6, 1] : 1,
          }}
          transition={{
            duration: 1.5,
            repeat: isSpeaking || isConnected ? Infinity : 0,
            ease: 'easeInOut',
          }}
        >
          {/* Pulse ring */}
          {(isSpeaking || isConnected) && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: isSpeaking ? 'rgb(248 113 113)' : 'rgb(52 211 153)',
              }}
              animate={{
                scale: [1, 2.5],
                opacity: [0.5, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
          )}
        </motion.div>

        {/* Status text */}
        <span className={`text-sm font-bold uppercase tracking-wider ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </motion.div>

      {/* Toggle button */}
      <motion.button
        onClick={onToggle}
        disabled={disabled}
        className={`
          group relative overflow-hidden rounded-2xl px-10 py-4 text-base font-bold uppercase tracking-wider shadow-2xl transition-all
          ${
            isConnected
              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/50 hover:shadow-red-500/70'
              : 'border-2 border-cyan-400/40 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-300 hover:border-cyan-400/60 hover:from-cyan-500/20 hover:to-blue-500/20'
          }
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        `}
        whileHover={!disabled ? { scale: 1.05, y: -2 } : {}}
        whileTap={!disabled ? { scale: 0.98 } : {}}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {/* Animated background glow */}
        {isConnected && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-red-400/30 via-red-500/30 to-red-600/30"
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        {/* Button shimmer effect */}
        {!isConnected && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{
              x: ['-200%', '200%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
              repeatDelay: 1,
            }}
          />
        )}

        <span className="relative z-10 flex items-center gap-3">
          <span>{isConnected ? '⏹' : '▶'}</span>
          <span>{isConnected ? 'End Voice Session' : 'Start Voice Session'}</span>
        </span>
      </motion.button>

      {/* Helper text - Only when disconnected */}
      {!isConnected && (
        <motion.p
          className="max-w-md text-center text-xs leading-relaxed text-slate-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          Initiate conversational interface with Aegis AI security assistant
        </motion.p>
      )}

      {/* Connection status banner when connected */}
      {isConnected && !isSpeaking && (
        <motion.div
          className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-xs text-emerald-400">
            <span className="font-bold">✓ Connection Established</span> · Ready for voice commands
          </p>
        </motion.div>
      )}

      {/* Speaking indicator */}
      {isSpeaking && (
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-1 w-1 rounded-full bg-red-400"
                animate={{
                  scaleY: [1, 2, 1],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
          <span className="text-xs text-red-400">Aegis is speaking...</span>
        </motion.div>
      )}
    </div>
  );
}
