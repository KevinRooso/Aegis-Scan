/**
 * DetailPanel - Full-screen modal for detailed views
 *
 * Displays detailed information when a user clicks on a finding, report, or other element.
 * Includes a "Resume Narration" button to return to guided flow.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

export interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onResumeNarration: () => void;
  title: string;
  children: ReactNode;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export function DetailPanel({
  isOpen,
  onClose,
  onResumeNarration,
  title,
  children,
  severity,
}: DetailPanelProps) {
  const getSeverityColor = () => {
    switch (severity) {
      case 'critical':
        return 'text-aegis-red border-aegis-red';
      case 'high':
        return 'text-orange-500 border-orange-500';
      case 'medium':
        return 'text-yellow-500 border-yellow-500';
      case 'low':
        return 'text-blue-500 border-blue-500';
      default:
        return 'text-gray-400 border-gray-700';
    }
  };

  const handleResumeClick = () => {
    onClose();
    onResumeNarration();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-black/90 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-4 z-50 flex flex-col rounded-lg border-2 bg-aegis-black md:inset-10 lg:inset-20"
            style={{
              borderColor: severity === 'critical' ? '#FF3333' : undefined,
              boxShadow:
                severity === 'critical'
                  ? '0 0 40px rgba(255, 51, 51, 0.5)'
                  : undefined,
            }}
          >
            {/* Header */}
            <div
              className={`flex items-center justify-between border-b-2 p-6 ${getSeverityColor()}`}
            >
              <div className="flex items-center space-x-4">
                {severity === 'critical' && (
                  <div className="flex h-3 w-3 animate-pulse-glow rounded-full bg-aegis-red" />
                )}
                <h2 className="text-2xl font-bold">{title}</h2>
              </div>

              <button
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 text-white">
              {children}
            </div>

            {/* Footer with Resume Button */}
            <div className="flex items-center justify-between border-t-2 border-gray-800 p-6">
              <p className="text-sm text-gray-400">
                Click "Resume Narration" to continue the guided tour
              </p>

              <button
                onClick={handleResumeClick}
                className="flex items-center space-x-2 rounded-lg bg-aegis-red px-6 py-3 font-semibold text-white transition-all hover:bg-aegis-red/80 hover:shadow-[0_0_20px_rgba(255,51,51,0.5)]"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Resume Narration</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * FindingDetailContent - Specialized content for security findings
 */
export interface FindingDetailProps {
  finding: {
    title: string;
    severity: string;
    description: string;
    remediation?: string;
    references?: string[];
    source_agent: string;
    metadata?: Record<string, any>;
  };
}

export function FindingDetailContent({ finding }: FindingDetailProps) {
  return (
    <div className="space-y-6">
      {/* Severity Badge */}
      <div className="flex items-center space-x-3">
        <span className="rounded-full bg-aegis-red/20 px-4 py-2 text-sm font-bold uppercase text-aegis-red">
          {finding.severity}
        </span>
        <span className="text-sm text-gray-400">
          Detected by {finding.source_agent}
        </span>
      </div>

      {/* Description */}
      <div>
        <h3 className="mb-2 text-lg font-semibold text-white">Description</h3>
        <p className="text-gray-300">{finding.description}</p>
      </div>

      {/* Remediation */}
      {finding.remediation && (
        <div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            Remediation
          </h3>
          <p className="text-gray-300">{finding.remediation}</p>
        </div>
      )}

      {/* References */}
      {finding.references && finding.references.length > 0 && (
        <div>
          <h3 className="mb-2 text-lg font-semibold text-white">References</h3>
          <ul className="list-inside list-disc space-y-1 text-gray-300">
            {finding.references.map((ref, idx) => (
              <li key={idx}>
                <a
                  href={ref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-aegis-red hover:underline"
                >
                  {ref}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Metadata */}
      {finding.metadata && Object.keys(finding.metadata).length > 0 && (
        <div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            Additional Details
          </h3>
          <div className="rounded-lg bg-black/50 p-4">
            <pre className="overflow-x-auto text-sm text-gray-400">
              {JSON.stringify(finding.metadata, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
