import { useState } from 'react';
import { useKiosk } from '../components/kiosk/KioskProvider';
import { StepIndicator } from '../components/kiosk/StepIndicator';

export function SaveDeviceStage() {
  const { transitionTo } = useKiosk();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manufacturer: '',
          model: '',
          deviceType: 'laptop',
          technicianNotes: notes || null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Failed to save device');
        return;
      }
      setSaved(true);
    } catch (err) {
      setError((err as Error).message || 'Network error');
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="kiosk-container">
        <StepIndicator current="save_device" />
        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          <div className="text-8xl text-green-400">✓</div>
          <h1 className="kiosk-title text-center">Device Saved</h1>
          <p className="kiosk-subtitle text-center">
            The device has been recorded successfully.
          </p>
          <button onClick={() => transitionTo('next_ready')} className="kiosk-btn-primary">
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosk-container">
      <StepIndicator current="save_device" />
      <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-md w-full">
        <div className="text-6xl text-blue-400">💾</div>
        <h1 className="kiosk-title text-center">Save Device</h1>
        <p className="kiosk-subtitle text-center">
          Add optional notes and save the device record.
        </p>

        <div className="kiosk-card w-full space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Technician Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this device..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-base resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-800/50 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="kiosk-btn-primary w-full disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Device Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
