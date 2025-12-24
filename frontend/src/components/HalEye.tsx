/**
 * HalEye - Enhanced HAL 9000-inspired Aegis eye
 *
 * Dynamic, living eye with scan lines, particles, and realistic animations.
 */

import { motion } from 'framer-motion';

export type EyeState = 'idle' | 'listening' | 'speaking' | 'thinking';

export interface HalEyeProps {
  state: EyeState;
  className?: string;
}

export function HalEye({ state, className = '' }: HalEyeProps) {
  const getAnimation = () => {
    switch (state) {
      case 'idle':
        return {
          scale: [1, 1.02, 1],
          opacity: [0.85, 0.95, 0.85],
        };
      case 'listening':
        return {
          scale: [1, 1.05, 1],
          opacity: [0.95, 1, 0.95],
        };
      case 'speaking':
        return {
          scale: [1, 1.12, 1.06, 1],
          opacity: [1, 0.95, 1, 0.95],
        };
      case 'thinking':
        return {
          scale: [1, 1.03, 1],
          opacity: [0.75, 0.9, 0.75],
        };
    }
  };

  const getGlowIntensity = () => {
    switch (state) {
      case 'idle':
        return '0 0 40px rgba(255, 51, 51, 0.4), 0 0 80px rgba(255, 51, 51, 0.2)';
      case 'listening':
        return '0 0 60px rgba(255, 51, 51, 0.6), 0 0 100px rgba(255, 51, 51, 0.3)';
      case 'speaking':
        return '0 0 90px rgba(255, 51, 51, 0.9), 0 0 140px rgba(255, 51, 51, 0.5), 0 0 200px rgba(255, 51, 51, 0.2)';
      case 'thinking':
        return '0 0 50px rgba(255, 51, 51, 0.5), 0 0 90px rgba(255, 51, 51, 0.25)';
    }
  };

  const getDuration = () => {
    switch (state) {
      case 'speaking':
        return 1;
      case 'thinking':
        return 2.5;
      default:
        return 1.8;
    }
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer glow rings */}
      <motion.div
        className="absolute h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-red-500/10 via-red-600/5 to-transparent"
        animate={{
          scale: state === 'speaking' ? [1, 1.4, 1] : [1, 1.15, 1],
          opacity: state === 'speaking' ? [0.4, 0.6, 0.4] : [0.25, 0.35, 0.25],
          rotate: [0, 360],
        }}
        transition={{
          duration: getDuration() * 2,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Middle pulse ring */}
      <motion.div
        className="absolute h-96 w-96 rounded-full bg-gradient-radial from-red-500/20 via-red-600/10 to-transparent"
        animate={{
          scale: state === 'speaking' ? [1, 1.25, 1] : [1, 1.08, 1],
          opacity: state === 'speaking' ? [0.5, 0.7, 0.5] : [0.35, 0.45, 0.35],
        }}
        transition={{
          duration: getDuration() * 0.9,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.15,
        }}
      />

      {/* Main eye container */}
      <div className="relative h-72 w-72">
        {/* Outer rim with metallic effect */}
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-700 via-slate-900 to-black shadow-2xl"
          animate={{
            boxShadow: getGlowIntensity(),
          }}
          transition={{
            duration: getDuration(),
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Inner chrome ring */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-slate-800 to-slate-950 shadow-inner" />
        </motion.div>

        {/* Main eye lens */}
        <motion.div
          className="absolute inset-6 overflow-hidden rounded-full bg-black"
          animate={getAnimation()}
          transition={{
            duration: getDuration(),
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Glowing red core */}
          <motion.div
            className="absolute inset-0 bg-gradient-radial from-red-400 via-red-600 to-red-900"
            animate={{
              scale: state === 'speaking' ? [1, 1.15, 1] : [1, 1.03, 1],
              opacity: state === 'speaking' ? [0.95, 1, 0.95] : [0.9, 0.95, 0.9],
            }}
            transition={{
              duration: getDuration(),
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Animated scan lines */}
          <div className="absolute inset-0 overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="absolute h-0.5 w-full bg-gradient-to-r from-transparent via-red-300/40 to-transparent"
                style={{
                  top: `${20 * i}%`,
                }}
                animate={{
                  opacity: state === 'speaking' ? [0.3, 0.7, 0.3] : [0.2, 0.4, 0.2],
                  y: ['0%', '500%'],
                }}
                transition={{
                  duration: 3 + i * 0.5,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: i * 0.3,
                }}
              />
            ))}
          </div>

          {/* Vertical scan lines (static overlay) */}
          <div className="absolute inset-0 opacity-20">
            <div className="h-full w-full bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,rgba(255,51,51,0.1)_2px,rgba(255,51,51,0.1)_4px)]" />
          </div>

          {/* Center pupil with depth */}
          <motion.div
            className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-radial from-red-950 via-black to-black shadow-[inset_0_0_30px_rgba(0,0,0,0.9)]"
            animate={{
              scale: state === 'speaking' ? [1, 0.85, 1] : [1, 0.95, 1],
            }}
            transition={{
              duration: getDuration(),
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {/* Inner pupil glow */}
            <motion.div
              className="absolute inset-3 rounded-full bg-red-900/30"
              animate={{
                opacity: state === 'speaking' ? [0.4, 0.7, 0.4] : [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: getDuration() * 0.7,
                repeat: Infinity,
              }}
            />
          </motion.div>

          {/* Highlight reflection (upper left) */}
          <motion.div
            className="absolute left-[20%] top-[20%] h-20 w-20 rounded-full bg-gradient-radial from-white/15 to-transparent blur-sm"
            animate={{
              opacity: state === 'speaking' ? [0.15, 0.25, 0.15] : [0.12, 0.18, 0.12],
            }}
            transition={{
              duration: getDuration(),
              repeat: Infinity,
            }}
          />

          {/* Additional sparkle reflections */}
          <motion.div
            className="absolute right-[30%] top-[35%] h-8 w-8 rounded-full bg-white/10 blur-sm"
            animate={{
              opacity: [0.05, 0.15, 0.05],
            }}
            transition={{
              duration: getDuration() * 1.3,
              repeat: Infinity,
            }}
          />
        </motion.div>

        {/* Floating particles around the eye */}
        {state === 'speaking' && (
          <div className="absolute inset-0">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-red-400/60 shadow-lg shadow-red-400/50"
                style={{
                  left: '50%',
                  top: '50%',
                }}
                animate={{
                  x: [0, Math.cos((i * Math.PI * 2) / 8) * 140],
                  y: [0, Math.sin((i * Math.PI * 2) / 8) * 140],
                  opacity: [0, 0.8, 0],
                  scale: [0, 1.5, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeOut',
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Enhanced Aegis label with better positioning */}
      <div className="absolute -bottom-20 w-full text-center">
        <motion.div
          className="bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-4xl font-bold tracking-[0.4em] text-transparent"
          animate={{
            opacity: [0.85, 1, 0.85],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          AEGIS
        </motion.div>
        <motion.div
          className="mt-3 text-sm font-semibold uppercase tracking-[0.3em]"
          animate={{
            opacity: state === 'speaking' ? 1 : 0.6,
            color: state === 'speaking'
              ? '#ff3333'
              : state === 'listening'
              ? '#4ade80'
              : '#64748b',
          }}
          transition={{
            duration: 0.3,
          }}
        >
          {state === 'speaking' && '◉ TRANSMITTING'}
          {state === 'listening' && '◉ ACTIVE'}
          {state === 'thinking' && '◌ PROCESSING'}
          {state === 'idle' && '○ STANDBY'}
        </motion.div>
      </div>
    </div>
  );
}

/**
 * MiniHalEye - Smaller version for navigation/header
 */
export interface MiniHalEyeProps {
  state: EyeState;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MiniHalEye({
  state,
  size = 'md',
  className = '',
}: MiniHalEyeProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  const getAnimation = () => {
    return state === 'speaking'
      ? {
          scale: [1, 1.15, 1],
          opacity: [1, 0.9, 1],
        }
      : {
          scale: [1, 1.03, 1],
          opacity: [0.95, 1, 0.95],
        };
  };

  return (
    <motion.div
      className={`relative flex items-center justify-center ${className}`}
      animate={getAnimation()}
      transition={{
        duration: state === 'speaking' ? 0.8 : 1.8,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <div
        className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-lg`}
        style={{
          boxShadow:
            state === 'speaking'
              ? '0 0 25px rgba(255, 51, 51, 0.9), 0 0 40px rgba(255, 51, 51, 0.5)'
              : '0 0 15px rgba(255, 51, 51, 0.6)',
        }}
      >
        <div className="absolute inset-2 rounded-full bg-gradient-radial from-red-400 to-red-900" />
        <div className="absolute inset-[35%] rounded-full bg-red-950 shadow-inner" />
        <div className="absolute left-[25%] top-[25%] h-[25%] w-[25%] rounded-full bg-white/10" />
      </div>
    </motion.div>
  );
}
