import { useState, useEffect, useCallback } from 'react';

interface SettingEntry {
  value: string;
  type: string;
  description: string | null;
  updatedAt: string;
}

interface SettingsMap {
  [key: string]: SettingEntry;
}

const SETTING_LABELS: Record<string, string> = {
  company_name: 'Company Name',
  company_logo: 'Company Logo URL',
  sku_prefix: 'Default SKU Prefix',
  sku_auto_increment: 'Auto-Increment SKUs',
  health_score_good_threshold: 'Good Health Threshold',
  health_score_warning_threshold: 'Warning Health Threshold',
  attachment_directory: 'Attachment Directory',
  backup_directory: 'Backup Directory',
  scan_timeout_seconds: 'Scan Timeout (seconds)',
  theme: 'Theme',
  diagnostic_mode_default: 'Default Diagnostic Mode',
};

const SETTING_DESCRIPTIONS: Record<string, string> = {
  company_name: 'Displayed on reports and the kiosk header',
  company_logo: 'URL or base64-encoded image for PDF reports',
  sku_prefix: 'Prefix for auto-generated Company SKUs (e.g. DDS-2026-0001)',
  sku_auto_increment: 'Automatically increment SKU sequence numbers',
  health_score_good_threshold: 'Scores above this are "good"',
  health_score_warning_threshold: 'Scores above this (but below good) are "warning"',
  attachment_directory: 'Where uploaded attachments are stored on disk',
  backup_directory: 'Where database and attachment backups are saved',
  scan_timeout_seconds: 'Maximum time allowed for a diagnostic scan',
  theme: 'Visual theme for the kiosk interface',
  diagnostic_mode_default: 'Preselected scan mode on the kiosk',
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/settings');
      const json = await res.json();
      if (json.success) setSettings(json.data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSetting = async (key: string, value: string, type: string = 'string') => {
    setSaving(key);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/settings/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, type }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: `${SETTING_LABELS[key] || key} updated` });
        setSettings((prev) => ({
          ...prev,
          [key]: { ...prev[key], value, type },
        }));
      } else {
        setMessage({ type: 'error', text: json.error?.message || 'Update failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  const keys = Object.keys(settings).sort();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm">Appliance configuration</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-800' : 'bg-red-900/50 text-red-300 border border-red-800'}`}>
          {message.text}
        </div>
      )}

      {keys.map((key) => {
        const entry = settings[key];
        const label = SETTING_LABELS[key] || key;
        const desc = SETTING_DESCRIPTIONS[key] || entry.description || '';

        if (entry.type === 'boolean') {
          return (
            <div key={key} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">{label}</h3>
                  {desc && <p className="text-gray-500 text-xs mt-0.5">{desc}</p>}
                </div>
                <button
                  onClick={() => updateSetting(key, entry.value === 'true' ? 'false' : 'true', 'boolean')}
                  disabled={saving === key}
                  className={`relative w-12 h-6 rounded-full transition-colors ${entry.value === 'true' ? 'bg-blue-600' : 'bg-gray-700'} ${saving === key ? 'opacity-50' : ''}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${entry.value === 'true' ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          );
        }

        if (entry.type === 'number') {
          return (
            <div key={key} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <div className="mb-2">
                <h3 className="text-white font-medium">{label}</h3>
                {desc && <p className="text-gray-500 text-xs">{desc}</p>}
              </div>
              <div className="flex gap-3">
                <input
                  type="number"
                  defaultValue={entry.value}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateSetting(key, (e.target as HTMLInputElement).value, 'number');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.querySelector(`[data-setting="${key}"]`) as HTMLInputElement;
                    if (input) updateSetting(key, input.value, 'number');
                  }}
                  disabled={saving === key}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-sm rounded-lg transition-colors"
                >
                  {saving === key ? '...' : 'Save'}
                </button>
              </div>
            </div>
          );
        }

        if (key === 'theme') {
          return (
            <div key={key} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <div className="mb-2">
                <h3 className="text-white font-medium">{label}</h3>
                {desc && <p className="text-gray-500 text-xs">{desc}</p>}
              </div>
              <select
                defaultValue={entry.value}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 w-full"
                onChange={(e) => updateSetting(key, e.target.value, 'string')}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          );
        }

        if (key === 'diagnostic_mode_default') {
          return (
            <div key={key} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <div className="mb-2">
                <h3 className="text-white font-medium">{label}</h3>
                {desc && <p className="text-gray-500 text-xs">{desc}</p>}
              </div>
              <select
                defaultValue={entry.value}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 w-full"
                onChange={(e) => updateSetting(key, e.target.value, 'string')}
              >
                <option value="quick">Quick Scan</option>
                <option value="deep">Deep Scan</option>
              </select>
            </div>
          );
        }

        return (
          <div key={key} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="mb-2">
              <h3 className="text-white font-medium">{label}</h3>
              {desc && <p className="text-gray-500 text-xs">{desc}</p>}
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                defaultValue={entry.value}
                data-setting={key}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateSetting(key, (e.target as HTMLInputElement).value, entry.type);
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.querySelector(`[data-setting="${key}"]`) as HTMLInputElement;
                  if (input) updateSetting(key, input.value, entry.type);
                }}
                disabled={saving === key}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-sm rounded-lg transition-colors"
              >
                {saving === key ? '...' : 'Save'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
