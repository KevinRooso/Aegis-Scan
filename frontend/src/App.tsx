/**
 * App - Main application entry point with routing
 *
 * Provides two-tab interface: Dashboard and Voice Agent
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { VoiceAgentCinematic } from './pages/VoiceAgentCinematic';
import { History } from './pages/History';
import { ScanProvider, useScan } from './contexts/ScanContext';
import { fetchLatestScan } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const { activeScanId, setActiveScanId, setHasFindings, markScanComplete } = useScan();

  // Auto-load latest scan on app startup
  useEffect(() => {
    const loadLatestScan = async () => {
      if (!activeScanId) {
        console.log('App: Attempting to auto-load latest scan...');
        try {
          const latestScan = await fetchLatestScan();
          console.log('App: Received latest scan response:', latestScan);

          if (latestScan.status === 'success' && latestScan.scan_id) {
            console.log('App: Setting active scan ID:', latestScan.scan_id);
            setActiveScanId(latestScan.scan_id);

            // Update context flags to enable Voice Agent tab
            if (latestScan.total_findings && latestScan.total_findings > 0) {
              console.log('App: Setting hasFindings = true');
              setHasFindings(true);
            }
            if (latestScan.scan_complete) {
              console.log('App: Marking scan as complete');
              markScanComplete();
            } else {
              console.warn('App: Scan is not marked as complete!', latestScan);
            }
          } else {
            console.warn('App: Invalid response from fetchLatestScan:', latestScan);
          }
        } catch (error) {
          console.error('App: Error loading latest scan:', error);
        }
      } else {
        console.log('App: Active scan already set:', activeScanId);
      }
    };
    loadLatestScan();
  }, [activeScanId, setActiveScanId, setHasFindings, markScanComplete]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="voice-agent" element={<VoiceAgentCinematic />} />
          <Route path="history" element={<History />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ScanProvider>
        <AppContent />
      </ScanProvider>
    </QueryClientProvider>
  );
}
