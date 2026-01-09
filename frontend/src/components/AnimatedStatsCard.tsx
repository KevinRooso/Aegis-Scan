import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface AnimatedStatsCardProps {
  title: string;
  value: number;
  icon?: React.ComponentType<{ className?: string }>;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export default function AnimatedStatsCard({ title, value, icon: Icon, severity }: AnimatedStatsCardProps) {
  const [count, setCount] = useState(0);
  const [showParticles, setShowParticles] = useState(false);

  // Counting animation
  useEffect(() => {
    if (value === 0) {
      setCount(0);
      return;
    }

    const duration = 1500; // 1.5 seconds
    const steps = 60;
    const increment = value / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setCount(value);
        setShowParticles(true);
        setTimeout(() => setShowParticles(false), 1000);
        clearInterval(timer);
      } else {
        setCount(Math.floor(increment * currentStep));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value]);

  // Severity colors
  const getSeverityColors = () => {
    switch (severity) {
      case 'critical':
        return {
          gradient: 'from-red-600 via-red-500 to-rose-600',
          glow: 'shadow-red-500/50',
          pulse: true,
        };
      case 'high':
        return {
          gradient: 'from-orange-600 via-orange-500 to-amber-600',
          glow: 'shadow-orange-500/50',
          pulse: true,
        };
      case 'medium':
        return {
          gradient: 'from-yellow-600 via-yellow-500 to-amber-500',
          glow: 'shadow-yellow-500/30',
          pulse: false,
        };
      case 'low':
        return {
          gradient: 'from-blue-600 via-blue-500 to-cyan-600',
          glow: 'shadow-blue-500/30',
          pulse: false,
        };
      default:
        return {
          gradient: 'from-slate-600 via-slate-500 to-gray-600',
          glow: 'shadow-slate-500/30',
          pulse: false,
        };
    }
  };

  const colors = getSeverityColors();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      className={`relative overflow-hidden rounded-lg backdrop-blur-xl bg-slate-900/95 border border-white/10 shadow-lg ${colors.glow} ${
        colors.pulse ? 'animate-pulse' : ''
      }`}
    >
      {/* AAA top bar animation */}
      <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden">
        {/* Pulsing gradient base */}
        <motion.div
          animate={{
            opacity: [0.4, 0.7, 0.4],
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={`absolute inset-0 bg-gradient-to-r ${colors.gradient}`}
          style={{ backgroundSize: '200% 100%' }}
        />

        {/* Energy waves with echo trails */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={`wave-group-${i}`}>
            {/* Main wave */}
            <motion.div
              animate={{
                x: ['-100%', '200%'],
                scaleX: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: i * 1.25,
                ease: 'linear',
              }}
              className={`absolute top-0 h-full w-32 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-[1px]`}
              style={{ left: 0 }}
            />
            {/* Echo trail */}
            <motion.div
              animate={{
                x: ['-100%', '200%'],
                opacity: [0, 0.3, 0],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: i * 1.25 + 0.15,
                ease: 'linear',
              }}
              className={`absolute top-0 h-full w-48 bg-gradient-to-r ${colors.gradient} blur-sm`}
              style={{ left: 0 }}
            />
          </div>
        ))}

        {/* Dual-speed scanners */}
        <motion.div
          animate={{
            x: ['-5%', '105%'],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-0 h-full w-px bg-white/90 shadow-lg"
          style={{ left: 0, boxShadow: `0 0 8px ${colors.gradient}` }}
        />
        <motion.div
          animate={{
            x: ['-5%', '35%', '-5%'],
            opacity: [0, 0.7, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
          className={`absolute top-0 h-full w-px bg-gradient-to-r ${colors.gradient}`}
          style={{ left: 0 }}
        />

        {/* Event-driven particle bursts */}
        <motion.div
          animate={{
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 0.3,
            repeat: Infinity,
            repeatDelay: 4.7,
          }}
          className="absolute top-0 left-1/2 h-full w-full"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={`burst-${i}`}
              animate={{
                x: [0, (i - 1) * 40],
                opacity: [1, 0],
                scale: [1, 0.3],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                repeatDelay: 4.4,
                delay: i * 0.05,
                ease: 'easeOut',
              }}
              className={`absolute top-0 h-full w-2 rounded-full bg-gradient-to-r ${colors.gradient}`}
            />
          ))}
        </motion.div>

        {/* Glow pulse */}
        <motion.div
          animate={{
            opacity: [0.2, 0.5, 0.2],
            scaleY: [1, 1.5, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={`absolute inset-0 bg-gradient-to-r ${colors.gradient} blur-md`}
        />
      </div>

      {/* Icon in top-right */}
      {Icon && (
        <div className="absolute top-3 right-3 opacity-20">
          <Icon className="w-8 h-8" />
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        <div className="text-slate-400 text-sm font-medium mb-2">{title}</div>
        <div className={`text-4xl font-bold bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent`}>
          {count}
        </div>
      </div>

      {/* Particle burst effect */}
      {showParticles && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 360) / 12;
            const distance = 60;
            const x = Math.cos((angle * Math.PI) / 180) * distance;
            const y = Math.sin((angle * Math.PI) / 180) * distance;

            return (
              <motion.div
                key={i}
                initial={{ x: '50%', y: '50%', opacity: 1, scale: 1 }}
                animate={{
                  x: `calc(50% + ${x}px)`,
                  y: `calc(50% + ${y}px)`,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`absolute w-2 h-2 rounded-full bg-gradient-to-r ${colors.gradient}`}
                style={{ left: 0, top: 0 }}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
