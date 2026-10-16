import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useWorkspace } from '../state/store';
import { tipText } from '../data/tips';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
/** Once per page load, even when StrictMode runs effects twice in development. */
let advanced = false;

/**
 * One tip in small text along the bottom of the screen when UJI opens, the next
 * one in data/tips.ts each visit. Skips the very first visit, which opens the
 * backpack instead; fades out on its own, and Settings can turn tips off.
 */
export function LaunchTip() {
  // Read before App's first-visit effect marks the welcome as seen.
  const [index] = useState(() => {
    const ws = useWorkspace.getState();
    return ws.seenWelcome ? ws.nextTip : null;
  });
  const enabled = useWorkspace((s) => s.settings.tips !== false);
  const [phase, setPhase] = useState<'waiting' | 'shown' | 'leaving' | 'gone'>('waiting');

  useEffect(() => {
    if (index === null || !useWorkspace.getState().settings.tips) return;
    if (!advanced) {
      advanced = true;
      useWorkspace.getState().advanceTip();
    }
    const timers = [window.setTimeout(() => setPhase('shown'), 1200), window.setTimeout(() => setPhase('leaving'), 16000)];
    return () => timers.forEach(window.clearTimeout);
  }, [index]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = window.setTimeout(() => setPhase('gone'), 400);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (index === null || !enabled || phase === 'waiting' || phase === 'gone') return null;
  return (
    <p className={`launch-tip ${phase === 'leaving' ? 'is-leaving' : ''}`}>
      <span>
        <strong>Tip:</strong> {tipText(index, IS_MAC)}
      </span>
      <button type="button" className="launch-tip-x" onClick={() => setPhase('leaving')} aria-label="Hide tip">
        <X size={12} />
      </button>
    </p>
  );
}
