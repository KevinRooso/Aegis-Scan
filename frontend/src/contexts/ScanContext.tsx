/**
 * ScanContext - Global scan state management
 *
 * Provides scan status and completion state across the application
 * to enable features like tab state management.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ScanContextValue {
  activeScanId: string | null;
  isScanComplete: boolean;
  hasFindings: boolean;
  setActiveScanId: (scanId: string | null) => void;
  markScanComplete: () => void;
  setHasFindings: (hasFindings: boolean) => void;
  resetScan: () => void;
}

const ScanContext = createContext<ScanContextValue | undefined>(undefined);

interface ScanProviderProps {
  children: ReactNode;
}

export function ScanProvider({ children }: ScanProviderProps) {
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [isScanComplete, setIsScanComplete] = useState(false);
  const [hasFindings, setHasFindings] = useState(false);

  const markScanComplete = useCallback(() => {
    setIsScanComplete(true);
  }, []);

  const resetScan = useCallback(() => {
    setActiveScanId(null);
    setIsScanComplete(false);
    setHasFindings(false);
  }, []);

  return (
    <ScanContext.Provider
      value={{
        activeScanId,
        isScanComplete,
        hasFindings,
        setActiveScanId,
        markScanComplete,
        setHasFindings,
        resetScan,
      }}
    >
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const context = useContext(ScanContext);
  if (!context) {
    throw new Error("useScan must be used within a ScanProvider");
  }
  return context;
}
