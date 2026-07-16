import { NavLink } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: '⊞' },
  { label: 'Devices', path: '/devices', icon: '💻' },
  { label: 'New Scan', path: '/scan', icon: '⟳' },
  { label: 'History', path: '/history', icon: '📋' },
  { label: 'Reports', path: '/reports', icon: '📄' },
  { label: 'Settings', path: '/settings', icon: '⚙' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-5 border-b border-gray-800">
        <h1 className="text-xl font-bold text-blue-400 tracking-tight">
          DispoScan
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Diagnostic Appliance</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`
            }
          >
            <span className="text-lg w-6 text-center">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-600">v1.0.0 — Offline</p>
      </div>
    </aside>
  );
}
