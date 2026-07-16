import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listDevices } from '../api/devices';
import type { DeviceRow } from '../api/devices';
import type { DeviceSearchQuery } from '@dds/shared';

const STATUS_COLORS: Record<string, string> = {
  new_intake: 'text-blue-400',
  diagnosed: 'text-yellow-400',
  repairing: 'text-orange-400',
  waiting_parts: 'text-purple-400',
  ready_pickup: 'text-green-400',
  completed: 'text-green-500',
  sold: 'text-gray-400',
  archived: 'text-gray-600',
};

export default function DeviceList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['devices', search, page],
    queryFn: () => listDevices({ q: search, page, limit } as DeviceSearchQuery),
  });

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1);
    },
    [],
  );

  const devices = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Devices</h1>
          <p className="text-gray-400 text-sm">Search and manage device records</p>
        </div>
        <button
          onClick={() => navigate('/devices/new')}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-lg text-sm font-medium transition-colors touch-manipulation"
        >
          + Add Device
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search by SKU, serial, manufacturer, model..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading devices...</div>
        ) : isError ? (
          <div className="p-8 text-center text-red-400">Error: {(error as Error).message}</div>
        ) : devices.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No devices found. Scan a device or add one manually.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">SKU</th>
                  <th className="text-left px-4 py-3 font-medium">Manufacturer</th>
                  <th className="text-left px-4 py-3 font-medium">Model</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Serial</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device: DeviceRow) => (
                  <tr
                    key={device.id}
                    onClick={() => navigate(`/devices/${device.id}`)}
                    className="border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-mono text-xs">{device.company_sku ?? '—'}</td>
                    <td className="px-4 py-3 text-white">{device.manufacturer}</td>
                    <td className="px-4 py-3 text-gray-300">{device.model}</td>
                    <td className="px-4 py-3 text-gray-400 capitalize">{device.device_type}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{device.serial_number ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`capitalize ${STATUS_COLORS[device.status] ?? 'text-gray-400'}`}>
                        {device.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                <span className="text-sm text-gray-500">
                  Page {meta?.page ?? 1} of {totalPages} ({meta?.total ?? 0} total)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded text-sm bg-gray-800 text-white disabled:opacity-30 hover:bg-gray-700 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded text-sm bg-gray-800 text-white disabled:opacity-30 hover:bg-gray-700 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
