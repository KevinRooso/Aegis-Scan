/**
 * MainLayout - Main application layout with tab navigation
 *
 * Provides the two-tab interface: Dashboard and Voice Agent
 */

import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MiniHalEye } from '../components/HalEye';
import { useScan } from '../contexts/ScanContext';

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isScanComplete } = useScan();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-aegis-black text-white">
      {/* Header with Aegis branding and tabs */}
      <header className="border-b border-gray-900 bg-black/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between py-4">
            {/* Branding */}
            <div className="flex items-center space-x-4">
              <MiniHalEye state="idle" size="md" />
              <div>
                <h1 className="text-lg font-bold text-aegis-red">
                  AEGISSCAN
                </h1>
                <p className="text-xs text-gray-500">
                  Multi-Agent Security Platform
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <nav className="flex space-x-1">
              <TabLink to="/dashboard" active={isActive('/dashboard')}>
                Dashboard
              </TabLink>
              <TabLink to="/history" active={isActive('/history')}>
                History
              </TabLink>
              <TabLink
                to="/voice-agent"
                active={isActive('/voice-agent')}
                disabled={!isScanComplete}
                onClick={(e) => {
                  if (!isScanComplete) {
                    e.preventDefault();
                    return;
                  }
                }}
              >
                Voice Agent
              </TabLink>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="min-h-[calc(100vh-80px)]">
        <Outlet />
      </main>
    </div>
  );
}

interface TabLinkProps {
  to: string;
  active: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  children: React.ReactNode;
}

function TabLink({ to, active, disabled = false, onClick, children }: TabLinkProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        relative px-6 py-3 text-sm font-semibold transition-all
        ${
          disabled
            ? 'cursor-not-allowed text-gray-600 opacity-50'
            : active
            ? 'text-aegis-red'
            : 'text-gray-400 hover:text-white'
        }
      `}
      title={disabled ? 'Complete a scan to unlock Voice Agent' : undefined}
    >
      {children}

      {/* Active indicator */}
      {active && !disabled && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-aegis-red shadow-[0_0_10px_rgba(255,51,51,0.5)]" />
      )}

      {/* Lock icon for disabled state */}
      {disabled && (
        <span className="ml-2 text-xs">🔒</span>
      )}
    </Link>
  );
}
