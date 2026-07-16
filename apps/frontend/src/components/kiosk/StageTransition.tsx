import { useEffect, useState, type ReactNode } from 'react';
import { useKiosk } from './KioskProvider';

export function StageTransition({ children }: { children: ReactNode }) {
  const { transitioning } = useKiosk();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (transitioning) {
      setVisible(false);
      const t = setTimeout(() => setVisible(true), 250);
      return () => clearTimeout(t);
    }
    setVisible(true);
  }, [transitioning]);

  return (
    <div
      className={`transition-all duration-300 ease-out flex-1 flex flex-col ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {children}
    </div>
  );
}
