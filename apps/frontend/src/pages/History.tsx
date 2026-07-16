import { useState, useEffect, useCallback } from 'react';

interface LogEntry {
  id: number;
  level: string;
  category: string;
  message: string;
  details: string | null;
  createdAt: string;
}

const LEVEL_COLORS: Record<string, string> = {
  error: 'text-red-400 bg-red-900/30 border-red-800/50',
  warn: 'text-yellow-400 bg-yellow-900/30 border-yellow-800/50',
  info: 'text-blue-400 bg-blue-900/30 border-blue-800/50',
  debug: 'text-gray-400 bg-gray-800/50 border-gray-700/50',
};

const LEVEL_BADGE: Record<string, string> = {
  error: 'bg-red-600',
  warn: 'bg-yellow-600',
  info: 'bg-blue-600',
  debug: 'bg-gray-600',
};

export default function History() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (levelFilter) params.set('level', levelFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (filter) params.set('search', filter);

      const res = await fetch(`/api/v1/logs?${params}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data || []);
        setTotal(json.meta?.total || 0);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [page, levelFilter, categoryFilter, filter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-16">
      <div>
        <h1 className="text-2xl font-bold text-white">Activity Log</h1>
        <p className="text-gray-400 text-sm">Application events and diagnostic history</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search logs..."
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(0); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 w-64"
        />

        <select
          value={levelFilter}
          onChange={(e) => { setLevelFilter(e.target.value); setPage(0); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All Levels</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All Categories</option>
          <option value="device_scan">Device Scan</option>
          <option value="collector_connect">Collector</option>
          <option value="backup">Backup</option>
          <option value="restore">Restore</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="system">System</option>
        </select>

        <button
          onClick={fetchLogs}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="bg-gray-900 rounded-xl p-12 border border-gray-800 text-center text-gray-500">
          <p className="text-lg mb-1">No log entries found</p>
          <p className="text-sm">Logs will appear here as the application runs</p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            {logs.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-lg px-4 py-3 border text-sm ${LEVEL_COLORS[entry.level] || 'text-gray-400 bg-gray-800/30 border-gray-700/30'}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium text-white ${LEVEL_BADGE[entry.level] || 'bg-gray-600'} whitespace-nowrap mt-0.5`}>
                    {entry.level.toUpperCase()}
                  </span>
                  <span className="text-gray-500 text-xs whitespace-nowrap mt-1 font-mono">
                    {entry.category}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-inherit">{entry.message}</p>
                    {entry.details && (
                      <pre className="mt-1 text-xs opacity-70 overflow-x-auto max-h-20">
                        {entry.details}
                      </pre>
                    )}
                  </div>
                  <span className="text-gray-600 text-xs whitespace-nowrap mt-1 font-mono">
                    {new Date(entry.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm rounded-lg"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-gray-500 text-sm">
                Page {page + 1} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm rounded-lg"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
