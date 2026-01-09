/**
 * HalEye - AAA-Lite Enhanced HAL 9000-inspired Aegis eye
 *
 * Performance-optimized cinematic eye with:
 * - Iris aperture blades
 * - 3-layer glow system with color temperature
 * - Refined particle system (20-30 particles)
 * - HUD targeting reticles
 * - Pupil dilation animations
 */

import { motion } from 'framer-motion';

export type EyeState = 'idle' | 'listening' | 'speaking' | 'thinking';

export interface HalEyeProps {
  state: EyeState;
  className?: string;
}

// Color temperature by state
const STATE_COLORS = {
  idle: {
    primary: '#ef4444', // red (classic HAL)
    secondary: '#dc2626',
    glow: 'rgba(239, 68, 68, 0.6)',
  },
  listening: {
    primary: '#10b981', // green
    secondary: '#059669',
    glow: 'rgba(16, 185, 129, 0.6)',
  },
  speaking: {
    primary: '#ff3333', // bright red (intense)
    secondary: '#ff1a1a',
    glow: 'rgba(255, 51, 51, 0.9)',
  },
  thinking: {
    primary: '#f59e0b', // amber
    secondary: '#d97706',
    glow: 'rgba(245, 158, 11, 0.6)',
  },
};

export function HalEye({ state, className = '' }: HalEyeProps) {
  const colors = STATE_COLORS[state];

  // Aperture opening (0-1, where 1 is fully open)
  const getApertureOpening = () => {
    switch (state) {
      case 'speaking': return 0.4; // Contracted (focused)
      case 'thinking': return 1.0; // Fully open (processing)
      case 'listening': return 0.6;
      case 'idle': return 0.8;
    }
  };

  // Pupil size multiplier
  const getPupilScale = () => {
    switch (state) {
      case 'speaking': return 0.75; // Constricted
      case 'thinking': return 1.3; // Dilated
      case 'listening': return 1.0;
      case 'idle': return 0.9;
    }
  };

  // Animation speed
  const getAnimationDuration = () => {
    switch (state) {
      case 'speaking': return 0.8;
      case 'thinking': return 2.5;
      case 'listening': return 1.5;
      default: return 2.0;
    }
  };

  // Glow layers intensity
  const getGlowLayers = () => {
    const base = state === 'speaking' ? 1.2 : 1.0;
    return {
      inner: `0 0 ${20 * base}px ${colors.glow}, 0 0 ${40 * base}px ${colors.glow}`,
      middle: `0 0 ${60 * base}px ${colors.glow}`,
      outer: `0 0 ${100 * base}px ${colors.glow.replace('0.6', '0.3')}`,
    };
  };

  const apertureOpening = getApertureOpening();
  const pupilScale = getPupilScale();
  const duration = getAnimationDuration();
  const glowLayers = getGlowLayers();

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer glow ring - Layer 3 */}
      <motion.div
        className="absolute h-[30rem] w-[30rem] rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.primary}10 0%, transparent 70%)`,
        }}
        animate={{
          scale: state === 'speaking' ? [1, 1.3, 1] : [1, 1.15, 1],
          opacity: state === 'speaking' ? [0.3, 0.5, 0.3] : [0.2, 0.3, 0.2],
          rotate: [0, 360],
        }}
        transition={{
          duration: duration * 3,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Middle glow ring - Layer 2 */}
      <motion.div
        className="absolute h-[24rem] w-[24rem] rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.primary}20 0%, transparent 60%)`,
        }}
        animate={{
          scale: state === 'speaking' ? [1, 1.2, 1] : [1, 1.1, 1],
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: duration * 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Main eye container */}
      <div className="relative h-72 w-72">
        {/* Outer metallic rim with enhanced glow */}
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-700 via-slate-900 to-black shadow-2xl"
          animate={{
            boxShadow: [glowLayers.outer, glowLayers.outer],
          }}
          transition={{
            duration: duration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Inner chrome ring */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-slate-800 to-slate-950 shadow-inner" />
        </motion.div>

        {/* Main eye lens */}
        <div className="absolute inset-6 overflow-hidden rounded-full bg-black">
          {/* HUD Targeting Reticles */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 240 240">
            {/* Outer targeting ring */}
            <motion.circle
              cx="120"
              cy="120"
              r="110"
              fill="none"
              stroke={colors.primary}
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.3"
              animate={{
                rotate: [0, 360],
                opacity: state === 'speaking' ? [0.3, 0.6, 0.3] : [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: duration * 4,
                repeat: Infinity,
                ease: 'linear',
              }}
              style={{ transformOrigin: 'center' }}
            />

            {/* Middle targeting ring */}
            <motion.circle
              cx="120"
              cy="120"
              r="85"
              fill="none"
              stroke={colors.primary}
              strokeWidth="1"
              strokeDasharray="2 6"
              opacity="0.25"
              animate={{
                rotate: [360, 0],
                opacity: [0.25, 0.5, 0.25],
              }}
              transition={{
                duration: duration * 3,
                repeat: Infinity,
                ease: 'linear',
              }}
              style={{ transformOrigin: 'center' }}
            />

            {/* Crosshair markers */}
            {[0, 90, 180, 270].map((angle) => (
              <motion.line
                key={angle}
                x1="120"
                y1="10"
                x2="120"
                y2="25"
                stroke={colors.primary}
                strokeWidth="2"
                opacity="0.4"
                transform={`rotate(${angle} 120 120)`}
                animate={{
                  opacity: state === 'speaking' ? [0.4, 0.8, 0.4] : [0.3, 0.5, 0.3],
                }}
                transition={{
                  duration: duration,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: angle / 360,
                }}
              />
            ))}

            {/* Corner brackets */}
            {[45, 135, 225, 315].map((angle) => (
              <g key={angle} transform={`rotate(${angle} 120 120)`}>
                <motion.path
                  d="M 120 20 L 120 30 L 130 30"
                  stroke={colors.primary}
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.3"
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: duration * 1.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: angle / 720,
                  }}
                />
              </g>
            ))}
          </svg>

          {/* Iris with radial fiber pattern */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(circle at 35% 35%, ${colors.primary}40 0%, transparent 50%),
                conic-gradient(from 0deg, ${colors.primary}60, ${colors.secondary}40, ${colors.primary}60),
                radial-gradient(circle, ${colors.secondary} 0%, ${colors.primary}20 50%, transparent 100%)
              `,
            }}
            animate={{
              rotate: [0, 360],
              opacity: state === 'speaking' ? [0.9, 1, 0.9] : [0.85, 0.95, 0.85],
            }}
            transition={{
              rotate: {
                duration: 20,
                repeat: Infinity,
                ease: 'linear',
              },
              opacity: {
                duration: duration,
                repeat: Infinity,
                ease: 'easeInOut',
              },
            }}
          />

          {/* Iris Aperture Blades */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="relative h-32 w-32"
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              {[...Array(8)].map((_, i) => {
                const angle = (i * 360) / 8;
                return (
                  <motion.div
                    key={i}
                    className="absolute left-1/2 top-1/2 origin-bottom"
                    style={{
                      width: '2px',
                      height: '64px',
                      background: `linear-gradient(to top, ${colors.primary}40, transparent)`,
                      transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                    }}
                    animate={{
                      scaleY: apertureOpening,
                      opacity: [0.6, 0.8, 0.6],
                    }}
                    transition={{
                      scaleY: {
                        duration: 0.6,
                        ease: 'easeInOut',
                      },
                      opacity: {
                        duration: duration,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: i * 0.05,
                      },
                    }}
                  />
                );
              })}
            </motion.div>
          </div>

          {/* Animated scan lines */}
          <div className="absolute inset-0 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute h-0.5 w-full"
                style={{
                  background: `linear-gradient(to right, transparent, ${colors.primary}40, transparent)`,
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

          {/* Pupil with dilation */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-radial from-black via-slate-950 to-black shadow-[inset_0_0_40px_rgba(0,0,0,0.9)]"
            style={{
              width: '96px',
              height: '96px',
            }}
            animate={{
              scale: pupilScale,
              boxShadow: [
                `inset 0 0 40px rgba(0,0,0,0.9), 0 0 20px ${colors.glow}`,
                `inset 0 0 40px rgba(0,0,0,0.9), 0 0 30px ${colors.glow}`,
                `inset 0 0 40px rgba(0,0,0,0.9), 0 0 20px ${colors.glow}`,
              ],
            }}
            transition={{
              scale: {
                duration: 0.6,
                ease: 'easeInOut',
              },
              boxShadow: {
                duration: duration,
                repeat: Infinity,
                ease: 'easeInOut',
              },
            }}
          >
            {/* Inner pupil glow */}
            <motion.div
              className="absolute inset-2 rounded-full"
              style={{
                background: `radial-gradient(circle, ${colors.primary}30, transparent)`,
              }}
              animate={{
                opacity: state === 'speaking' ? [0.4, 0.7, 0.4] : [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: duration * 0.7,
                repeat: Infinity,
              }}
            />
          </motion.div>

          {/* Lens reflection (upper left) */}
          <motion.div
            className="absolute left-[25%] top-[25%] h-16 w-16 rounded-full bg-gradient-radial from-white/20 to-transparent blur-md"
            animate={{
              opacity: state === 'speaking' ? [0.2, 0.3, 0.2] : [0.15, 0.25, 0.15],
            }}
            transition={{
              duration: duration,
              repeat: Infinity,
            }}
          />

          {/* Secondary sparkle */}
          <motion.div
            className="absolute right-[30%] top-[35%] h-6 w-6 rounded-full bg-white/10 blur-sm"
            animate={{
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: duration * 1.3,
              repeat: Infinity,
            }}
          />
        </div>

        {/* Enhanced Particle System - Only during speaking */}
        {state === 'speaking' && (
          <div className="absolute inset-0">
            {/* Orbital particles (12 particles) */}
            {[...Array(12)].map((_, i) => {
              const angle = (i * Math.PI * 2) / 12;
              return (
                <motion.div
                  key={`orbital-${i}`}
                  className="absolute rounded-full"
                  style={{
                    width: '4px',
                    height: '4px',
                    background: colors.primary,
                    boxShadow: `0 0 8px ${colors.glow}`,
                    left: '50%',
                    top: '50%',
                  }}
                  animate={{
                    x: [
                      Math.cos(angle) * 100,
                      Math.cos(angle + Math.PI / 6) * 120,
                      Math.cos(angle + Math.PI / 3) * 100,
                    ],
                    y: [
                      Math.sin(angle) * 100,
                      Math.sin(angle + Math.PI / 6) * 120,
                      Math.sin(angle + Math.PI / 3) * 100,
                    ],
                    opacity: [0.6, 1, 0.6],
                    scale: [1, 1.5, 1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.15,
                  }}
                />
              );
            })}

            {/* Burst particles (8 particles) */}
            {[...Array(8)].map((_, i) => {
              const angle = (i * Math.PI * 2) / 8;
              return (
                <motion.div
                  key={`burst-${i}`}
                  className="absolute rounded-full"
                  style={{
                    width: '3px',
                    height: '3px',
                    background: colors.secondary,
                    boxShadow: `0 0 6px ${colors.glow}`,
                    left: '50%',
                    top: '50%',
                  }}
                  animate={{
                    x: [0, Math.cos(angle) * 140, 0],
                    y: [0, Math.sin(angle) * 140, 0],
                    opacity: [0, 0.8, 0],
                    scale: [0, 1.8, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeOut',
                    delay: i * 0.2,
                  }}
                />
              );
            })}

            {/* Data bits (10 particles) */}
            {[...Array(10)].map((_, i) => {
              const angle = Math.random() * Math.PI * 2;
              const distance = 140 + Math.random() * 20;
              return (
                <motion.div
                  key={`data-${i}`}
                  className="absolute"
                  style={{
                    width: '2px',
                    height: '2px',
                    background: colors.primary,
                    boxShadow: `0 0 4px ${colors.glow}`,
                    left: '50%',
                    top: '50%',
                  }}
                  animate={{
                    x: [Math.cos(angle) * distance, 0],
                    y: [Math.sin(angle) * distance, 0],
                    opacity: [0.8, 0],
                    scale: [1.2, 0],
                  }}
                  transition={{
                    duration: 1.5 + Math.random(),
                    repeat: Infinity,
                    ease: 'easeIn',
                    delay: i * 0.15 + Math.random() * 0.5,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Enhanced Status Display */}
      <div className="absolute -bottom-20 w-full text-center">
        <motion.div
          className="bg-gradient-to-r bg-clip-text text-4xl font-bold tracking-[0.4em] text-transparent"
          style={{
            backgroundImage: `linear-gradient(to right, ${colors.primary}, ${colors.secondary})`,
          }}
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

        {/* Status text with HUD style */}
        <motion.div
          className="mt-3 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.3em]"
          animate={{
            opacity: state === 'speaking' ? 1 : 0.6,
            color: colors.primary,
          }}
          transition={{
            duration: 0.3,
          }}
        >
          {/* Status indicator dot */}
          <motion.div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: colors.primary }}
            animate={{
              opacity: [0.6, 1, 0.6],
              scale: state === 'speaking' ? [1, 1.3, 1] : [1, 1.1, 1],
            }}
            transition={{
              duration: duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Status text */}
          <span>
            {state === 'speaking' && 'TRANSMITTING'}
            {state === 'listening' && 'ACTIVE'}
            {state === 'thinking' && 'PROCESSING'}
            {state === 'idle' && 'STANDBY'}
          </span>

          {/* Animated brackets */}
          <motion.span
            animate={{
              opacity: [0.4, 0.8, 0.4],
            }}
            transition={{
              duration: duration * 1.5,
              repeat: Infinity,
            }}
          >
            [{state === 'speaking' ? '███' : state === 'thinking' ? '▓▓░' : '░░░'}]
          </motion.span>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * MiniHalEye - Smaller version for navigation/header with AAA-Lite enhancements
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

  const colors = STATE_COLORS[state];

  const getAnimation = () => {
    return state === 'speaking'
      ? {
          scale: [1, 1.15, 1],
          opacity: [1, 0.9, 1],
        }
      : {
          scale: [1, 1.05, 1],
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
        className={`${sizeClasses[size]} rounded-full shadow-lg`}
        style={{
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          boxShadow:
            state === 'speaking'
              ? `0 0 20px ${colors.glow}, 0 0 40px ${colors.glow.replace('0.6', '0.3')}`
              : `0 0 12px ${colors.glow}`,
        }}
      >
        <div
          className="absolute inset-2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${colors.primary}, ${colors.secondary})`,
          }}
        />
        <motion.div
          className="absolute inset-[35%] rounded-full bg-black shadow-inner"
          animate={{
            scale: state === 'speaking' ? [1, 0.8, 1] : [1, 0.95, 1],
          }}
          transition={{
            duration: state === 'speaking' ? 0.8 : 1.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <div
          className="absolute left-[25%] top-[25%] h-[25%] w-[25%] rounded-full bg-white/15"
        />
      </div>
    </motion.div>
  );
}
