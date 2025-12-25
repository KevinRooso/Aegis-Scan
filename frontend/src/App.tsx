/**
 * App - Main application entry point with routing
 *
 * Provides two-tab interface: Dashboard and Voice Agent
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { VoiceAgentCinematic } from './pages/VoiceAgentCinematic';
import { History } from './pages/History';
import { ScanProvider } from './contexts/ScanContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ScanProvider>
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
      </ScanProvider>
    </QueryClientProvider>
  );
}
