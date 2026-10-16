import { useEffect, useState, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';

/** A button that asks twice: the first click arms it for three seconds, the second does it. */
export function ArmedButton({ label, onConfirm, danger, icon = <RotateCcw size={13} /> }: { label: string; onConfirm: () => void; danger?: boolean; icon?: ReactNode }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`btn btn-sm ${danger ? 'btn-danger' : ''} ${armed ? 'is-armed btn-danger' : ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? (
        'Click again to confirm'
      ) : (
        <>
          {icon} {label}
        </>
      )}
    </button>
  );
}
