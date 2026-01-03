import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface ScanListItem {
  scan_id: string;
  target: string;
  created_at: string;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
}

export function History() {
  const [scans, setScans] = useState<ScanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchScans();
  }, []);

  const fetchScans = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/scans/list');
      if (!response.ok) throw new Error('Failed to fetch scans');

      const data = await response.json();

      // Transform scans data
      const scanList: ScanListItem[] = Object.values(data).map((scan: any) => {
        const findings = scan.findings || [];
        return {
          scan_id: scan.scan_id,
          target: scan.target,
          created_at: scan.created_at,
          total_findings: findings.length,
          critical_count: findings.filter((f: any) => f.severity === 'critical').length,
          high_count: findings.filter((f: any) => f.severity === 'high').length,
          medium_count: findings.filter((f: any) => f.severity === 'medium').length,
          low_count: findings.filter((f: any) => f.severity === 'low').length,
          info_count: findings.filter((f: any) => f.severity === 'informational').length,
        };
      });

      // Sort by date (newest first)
      scanList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setScans(scanList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scans');
    } finally {
      setLoading(false);
    }
  };

  const filteredScans = scans.filter(scan =>
    scan.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
    scan.scan_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-400/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-400/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-400/30';
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-400/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-400/30';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const viewScanDetails = (scanId: string) => {
    // Navigate to dashboard with scan ID
    navigate(`/dashboard?scan_id=${scanId}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="mb-2 text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Scan History
        </h1>
        <p className="text-slate-400">View and manage all your security scans</p>
      </motion.div>

      {/* Search and Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6 flex items-center justify-between gap-4"
      >
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by target or scan ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 pl-10 text-slate-200 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
          />
          <svg
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2">
            <span className="text-sm text-slate-400">Total Scans:</span>
            <span className="ml-2 text-lg font-bold text-cyan-400">{scans.length}</span>
          </div>
          <button
            onClick={fetchScans}
            className="rounded-lg border-2 border-slate-600/60 bg-slate-900/50 px-4 py-2 text-slate-300 shadow-md transition-all hover:border-cyan-400 hover:bg-slate-800/70 hover:text-cyan-300 hover:shadow-lg"
          >
            🔄 Refresh
          </button>
        </div>
      </motion.div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-red-400"
        >
          {error}
        </motion.div>
      )}

      {/* Scans Table */}
      {!loading && !error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-700 bg-slate-900/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Findings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Severity Breakdown
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredScans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      {searchQuery ? 'No scans match your search' : 'No scans found'}
                    </td>
                  </tr>
                ) : (
                  filteredScans.map((scan, index) => (
                    <motion.tr
                      key={scan.scan_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group transition-colors hover:bg-slate-800/50"
                    >
                      {/* Target */}
                      <td className="px-6 py-4">
                        <div className="max-w-md">
                          <div className="truncate font-medium text-slate-200">{scan.target}</div>
                          <div className="truncate text-xs text-slate-500">
                            ID: {scan.scan_id.slice(0, 16)}...
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {formatDate(scan.created_at)}
                      </td>

                      {/* Total Findings */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-cyan-400">
                            {scan.total_findings}
                          </span>
                          <span className="text-xs text-slate-500">total</span>
                        </div>
                      </td>

                      {/* Severity Breakdown */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {scan.critical_count > 0 && (
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getSeverityColor('critical')}`}>
                              {scan.critical_count} Critical
                            </span>
                          )}
                          {scan.high_count > 0 && (
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getSeverityColor('high')}`}>
                              {scan.high_count} High
                            </span>
                          )}
                          {scan.medium_count > 0 && (
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getSeverityColor('medium')}`}>
                              {scan.medium_count} Medium
                            </span>
                          )}
                          {scan.low_count > 0 && (
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getSeverityColor('low')}`}>
                              {scan.low_count} Low
                            </span>
                          )}
                          {scan.total_findings === 0 && (
                            <span className="text-sm text-slate-500">No findings</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => viewScanDetails(scan.scan_id)}
                          className="rounded-lg border-2 border-cyan-400/50 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 shadow-md transition-all hover:border-cyan-400 hover:bg-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/20"
                        >
                          View Details →
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
