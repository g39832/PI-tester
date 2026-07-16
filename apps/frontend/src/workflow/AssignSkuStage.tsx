import { useState, useCallback } from 'react';
import { useKiosk } from '../components/kiosk/KioskProvider';
import { StepIndicator } from '../components/kiosk/StepIndicator';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

const DEVICE_TYPES = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'laptop', label: 'Laptop' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'server', label: 'Server' },
  { value: 'other', label: 'Other' },
];

export function AssignSkuStage() {
  const { transitionTo } = useKiosk();
  const [deviceType, setDeviceType] = useState('laptop');
  const [sku, setSku] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    found: boolean;
    device?: { id: string; manufacturer: string; model: string; companySku: string; status: string };
    message: string;
  } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const handleScan = useCallback(async (code: string) => {
    setSku(code);
    setManualInput(code);
    setLookupResult(null);
    setLookingUp(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        const device = json.data[0];
        setLookupResult({
          found: true,
          device: {
            id: device.id,
            manufacturer: device.manufacturer || '',
            model: device.model || '',
            companySku: device.company_sku || code,
            status: device.status || 'unknown',
          },
          message: `Found: ${device.manufacturer || 'Unknown'} ${device.model || 'Unknown'}`,
        });
      } else {
        setLookupResult({
          found: false,
          message: `No record found for SKU "${code}". A new device will be created.`,
        });
      }
    } catch {
      setLookupResult({
        found: false,
        message: 'Error looking up SKU. Check server connection.',
      });
    } finally {
      setLookingUp(false);
    }
  }, []);

  useBarcodeScanner(handleScan, true);

  function handleGenerate() {
    const prefix = deviceType.slice(0, 3).toUpperCase();
    const year = new Date().getFullYear().toString().slice(-2);
    const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    const generated = `${prefix}-${year}-${rand}`;
    setSku(generated);
    setManualInput(generated);
    setLookupResult(null);
  }

  async function handleManualLookup() {
    if (!manualInput.trim()) return;
    await handleScan(manualInput.trim());
  }

  async function handleConfirm() {
    setConfirming(true);
    transitionTo('save_device');
  }

  return (
    <div className="kiosk-container">
      <StepIndicator current="assign_sku" />
      <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-md w-full">
        <div className="text-6xl text-blue-400">🏷</div>
        <h1 className="kiosk-title text-center">Company SKU</h1>
        <p className="kiosk-subtitle text-center">
          Scan a barcode or enter a SKU to locate an existing device,
          <br />
          or generate a new SKU for this device.
        </p>

        {/* Manual Entry */}
        <div className="kiosk-card w-full space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Scan or Type SKU</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleManualLookup();
                  }
                }}
                placeholder="e.g., LAP-26-0001"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleManualLookup}
                disabled={!manualInput.trim() || lookingUp}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-xl text-sm transition-colors"
              >
                {lookingUp ? '...' : 'Look Up'}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Scan a barcode with the USB scanner, or type a SKU and press Enter.
            </p>
          </div>

          {lookingUp && (
            <div className="text-center text-sm text-gray-400 py-2">
              Looking up SKU...
            </div>
          )}

          {lookupResult && (
            <div className={`rounded-xl p-4 border ${
              lookupResult.found
                ? 'bg-green-900/30 border-green-800/50 text-green-300'
                : 'bg-yellow-900/30 border-yellow-800/50 text-yellow-300'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span>{lookupResult.found ? '✓' : '!'}</span>
                <p className="text-sm font-medium">{lookupResult.message}</p>
              </div>
              {lookupResult.found && lookupResult.device && (
                <div className="mt-2 text-xs text-gray-400 space-y-1">
                  <p>Manufacturer: {lookupResult.device.manufacturer || '—'}</p>
                  <p>Model: {lookupResult.device.model || '—'}</p>
                  <p>Status: {lookupResult.device.status}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 w-full">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-sm text-gray-600">or</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* Generate New SKU */}
        <div className="kiosk-card w-full space-y-5">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Device Type</label>
            <div className="grid grid-cols-3 gap-2">
              {DEVICE_TYPES.map((dt) => (
                <button
                  key={dt.value}
                  onClick={() => { setDeviceType(dt.value); setSku(''); }}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    deviceType === dt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {dt.label}
                </button>
              ))}
            </div>
          </div>

          {!sku ? (
            <button onClick={handleGenerate} className="kiosk-btn-primary w-full">
              Generate New SKU
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-xl px-6 py-4 text-center border border-gray-700">
                <p className="text-xs text-gray-500 mb-1">Company SKU</p>
                <p className="text-2xl font-mono font-bold text-blue-400 tracking-wider">{sku}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleGenerate} className="kiosk-btn-secondary flex-1">
                  Regenerate
                </button>
                <button onClick={handleConfirm} disabled={confirming} className="kiosk-btn-primary flex-1 disabled:opacity-50">
                  {confirming ? 'Confirming...' : 'Confirm SKU'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
