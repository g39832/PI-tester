export default function Dashboard() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm">Device Diagnostic Station</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Devices" value="—" color="blue" />
        <StatCard label="Scanned Today" value="—" color="green" />
        <StatCard label="Avg Health Score" value="—" color="yellow" />
        <StatCard label="Need Attention" value="—" color="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AlertCard title="Low Battery" count={0} color="yellow" />
        <AlertCard title="SMART Warnings" count={0} color="red" />
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Scans</h2>
        <p className="text-gray-500 text-center py-8">
          No scans yet. Connect a device to begin.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const borderColor = {
    blue: 'border-l-blue-500',
    green: 'border-l-green-500',
    yellow: 'border-l-yellow-500',
    red: 'border-l-red-500',
  }[color] ?? 'border-l-gray-500';

  return (
    <div className={`bg-gray-900 rounded-xl p-5 border border-gray-800 border-l-4 ${borderColor}`}>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function AlertCard({ title, count, color }: { title: string; count: number; color: string }) {
  const dotColor = color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 flex items-center gap-4">
      <span className={`w-3 h-3 rounded-full ${dotColor} flex-shrink-0`} />
      <div>
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-lg font-semibold text-white">{count} devices</p>
      </div>
    </div>
  );
}
