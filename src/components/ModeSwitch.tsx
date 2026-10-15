import { useWorkspace } from '../state/store';
import type { AssistMode } from '../state/types';

const MODES: { id: AssistMode; label: string; tip: string }[] = [
  { id: 'cheat', label: 'Cheat', tip: 'Straight to the answer, with the work if you want it. No guilt.' },
  { id: 'lesson', label: 'Lesson', tip: 'One decision at a time, with help when you need it.' },
];

/**
 * The Cheat ↔ Lesson switch. Deliberately only two options; Challenge is an
 * activity launched from the main menu, not a help style.
 */
export function ModeSwitch({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const mode = useWorkspace((s) => s.mode);
  const setMode = useWorkspace((s) => s.setMode);
  return (
    <div className={`mode-switch mode-${size}`} role="radiogroup" aria-label="Help style" data-mode={mode}>
      <span className="mode-thumb" aria-hidden="true" />
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={mode === m.id}
          className="mode-opt"
          title={m.tip}
          onClick={() => setMode(m.id)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              const next = mode === 'cheat' ? 'lesson' : 'cheat';
              setMode(next);
              (e.currentTarget.parentElement?.querySelector(`[data-id="${next}"]`) as HTMLElement | null)?.focus();
            }
          }}
          data-id={m.id}
          tabIndex={mode === m.id ? 0 : -1}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
