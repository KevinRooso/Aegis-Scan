/**
 * CinematicAnimator - Wraps components with voice-synchronized animations
 *
 * Provides smooth fade in/out and scale effects based on voice narration focus.
 * Creates the "documentary" feel where elements appear and disappear as Aegis speaks.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';
import { ComponentId } from '../hooks/useVoiceSyncManager';

export interface CinematicAnimatorProps {
  id: ComponentId;
  children: ReactNode;
  isVisible: boolean;
  isFocused: boolean;
  onClick?: () => void;
  className?: string;
  /**
   * Animation variant: 'fade' | 'scale' | 'slide'
   */
  variant?: 'fade' | 'scale' | 'slide';
  /**
   * Delay before animation starts (in seconds)
   */
  delay?: number;
}

const animationVariants = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    dimmed: { opacity: 0.3 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    dimmed: { opacity: 0.3, scale: 0.98 },
  },
  slide: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    dimmed: { opacity: 0.3, y: 0 },
  },
};

export function CinematicAnimator({
  id,
  children,
  isVisible,
  isFocused,
  onClick,
  className = '',
  variant = 'scale',
  delay = 0,
}: CinematicAnimatorProps) {
  const variants = animationVariants[variant];

  // Determine animation state
  const animationState = !isVisible ? 'hidden' : isFocused ? 'visible' : 'dimmed';

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key={id}
          initial="hidden"
          animate={animationState}
          exit="hidden"
          variants={variants}
          transition={{
            duration: 0.5,
            delay,
            ease: 'easeOut',
          }}
          onClick={onClick}
          className={`${className} ${onClick ? 'cursor-pointer' : ''}`}
          data-component-id={id}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * FocusableCard - A card component that responds to cinematic focus
 */
export interface FocusableCardProps {
  id: ComponentId;
  children: ReactNode;
  isVisible: boolean;
  isFocused: boolean;
  onFocus: () => void;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  className?: string;
}

export function FocusableCard({
  id,
  children,
  isVisible,
  isFocused,
  onFocus,
  severity,
  className = '',
}: FocusableCardProps) {
  // Get border color based on severity
  const getBorderColor = () => {
    switch (severity) {
      case 'critical':
        return 'border-aegis-red';
      case 'high':
        return 'border-orange-500';
      case 'medium':
        return 'border-yellow-500';
      case 'low':
        return 'border-blue-500';
      default:
        return 'border-gray-700';
    }
  };

  // Get glow effect for critical items
  const getGlowEffect = () => {
    if (severity === 'critical' && isFocused) {
      return 'shadow-[0_0_20px_rgba(255,51,51,0.5)]';
    }
    return '';
  };

  return (
    <CinematicAnimator
      id={id}
      isVisible={isVisible}
      isFocused={isFocused}
      onClick={onFocus}
      variant="scale"
      className={`
        rounded-lg border-2 bg-black/80 p-6 backdrop-blur
        transition-all duration-300
        hover:scale-105 hover:border-opacity-100
        ${getBorderColor()}
        ${getGlowEffect()}
        ${className}
      `}
    >
      {children}
    </CinematicAnimator>
  );
}

/**
 * AnimatedSection - A full-width section that fades in/out
 */
export interface AnimatedSectionProps {
  id: ComponentId;
  children: ReactNode;
  isVisible: boolean;
  isFocused: boolean;
  title?: string;
  className?: string;
}

export function AnimatedSection({
  id,
  children,
  isVisible,
  isFocused,
  title,
  className = '',
}: AnimatedSectionProps) {
  return (
    <CinematicAnimator
      id={id}
      isVisible={isVisible}
      isFocused={isFocused}
      variant="fade"
      className={`w-full ${className}`}
    >
      {title && (
        <h2 className="mb-4 text-2xl font-bold text-white">{title}</h2>
      )}
      {children}
    </CinematicAnimator>
  );
}
