import { useEffect, useState } from 'react';
import { useKiosk } from '../components/kiosk/KioskProvider';

export function NextReadyStage() {
  const { transitionTo } = useKiosk();
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    if (countdown <= 0) {
      transitionTo('ready');
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, transitionTo]);

  return (
    <div className="kiosk-container">
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="text-8xl text-green-400">✓</div>
        <h1 className="kiosk-title text-center">Ready for Next Device</h1>
        <p className="kiosk-subtitle text-center">
          Device diagnostics complete. Returning to ready state in {countdown}s.
        </p>
        <button onClick={() => transitionTo('ready')} className="kiosk-btn-primary">
          Start Next Device Now
        </button>
      </div>
    </div>
  );
}
