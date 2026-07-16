import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDevice, deleteDevice } from '../api/devices';

const STATUS_COLORS: Record<string, string> = {
  new_intake: 'text-blue-400 border-blue-400/30',
  diagnosed: 'text-yellow-400 border-yellow-400/30',
  repairing: 'text-orange-400 border-orange-400/30',
  waiting_parts: 'text-purple-400 border-purple-400/30',
  ready_pickup: 'text-green-400 border-green-400/30',
  completed: 'text-green-500 border-green-500/30',
  sold: 'text-gray-400 border-gray-400/30',
  archived: 'text-gray-600 border-gray-600/30',
};

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</dt>
      <dd className="text-white text-sm">{value ?? '—'}</dd>
    </div>
  );
}

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['device', id],
    queryFn: () => getDevice(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDevice(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      navigate('/devices');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <div className="p-8 text-center text-gray-500">Loading device...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6 max-w-6xl">
        <div className="p-8 text-center text-red-400">Error: {(error as Error).message}</div>
      </div>
    );
  }

  const device = data!.data;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/devices')}
            className="text-gray-400 hover:text-white transition-colors text-lg"
          >
            &larr;
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{device.manufacturer} {device.model}</h1>
            <p className="text-gray-400 text-sm font-mono">{device.company_sku ?? 'No SKU'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize ${STATUS_COLORS[device.status] ?? 'text-gray-400 border-gray-700'}`}>
            {device.status.replace(/_/g, ' ')}
          </span>
          <button
            onClick={() => navigate(`/devices/${id}/edit`)}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => { if (confirm('Delete this device?')) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
            className="bg-red-900/50 hover:bg-red-800/50 text-red-400 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">System Info</h2>
          <dl className="space-y-3">
            <Field label="CPU" value={device.cpu} />
            <Field label="RAM" value={device.ram_gb ? `${device.ram_gb} GB` : null} />
            <Field label="Storage" value={device.storage_gb ? `${device.storage_gb} GB` : null} />
            <Field label="Storage Type" value={device.storage_type} />
            <Field label="GPU" value={device.gpu} />
          </dl>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Battery</h2>
          <dl className="space-y-3">
            <Field label="Health" value={device.battery_health !== null ? `${device.battery_health}%` : null} />
            <Field label="Cycle Count" value={device.battery_cycle_count} />
          </dl>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Firmware & OS</h2>
          <dl className="space-y-3">
            <Field label="BIOS Version" value={device.bios_version} />
            <Field label="TPM Status" value={device.tpm_status} />
            <Field label="Secure Boot" value={device.secure_boot} />
            <Field label="Windows Version" value={device.windows_version} />
            <Field label="OS Edition" value={device.os_edition} />
          </dl>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Identifiers</h2>
          <dl className="space-y-3">
            <Field label="Company SKU" value={device.company_sku} />
            <Field label="Serial Number" value={device.serial_number} />
            <Field label="Asset Tag" value={device.asset_tag} />
            <Field label="Device Type" value={device.device_type} />
            <Field label="Date Added" value={device.date_added ? new Date(device.date_added).toLocaleDateString() : null} />
            <Field label="Last Scan" value={device.last_scan_date ? new Date(device.last_scan_date).toLocaleDateString() : null} />
          </dl>
        </div>
      </div>

      {device.technician_notes && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-2">Technician Notes</h2>
          <p className="text-gray-300 text-sm whitespace-pre-wrap">{device.technician_notes}</p>
        </div>
      )}
    </div>
  );
}
