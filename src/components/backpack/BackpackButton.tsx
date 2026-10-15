import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../state/store';
import { useUI } from '../../state/ui';
import { PixelIcon } from '../ui/pixel-icons/PixelIcon';
import { BUTTON, DEFAULT_POS, buttonXY, cornerOf, cornerPos, snapToEdge } from './geometry';

/**
 * The only piece of chrome on an empty board: a round backpack button.
 * Click to open; drag it anywhere and it snaps back to the nearest edge
 * (pulling into corners). Arrow keys hop it between corners.
 */
export function BackpackButton() {
  const pos = useWorkspace((s) => s.settings.backpackPos) ?? DEFAULT_POS;
  const setSettings = useWorkspace((s) => s.setSettings);
  const nudge = useWorkspace((s) => s.nudge);
  const minimized = useWorkspace((s) => Object.values(s.windows).filter((w) => w.minimized).length);
  const open = useUI((s) => s.backpackOpen);
  const setBackpack = useUI((s) => s.setBackpack);
  const [, setViewport] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const g = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  useEffect(() => {
    const on = () => setViewport((n) => n + 1);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const home = buttonXY(pos);
  const at = drag ?? home;

  return (
    <button
      type="button"
      className={`bp-button ${open ? 'is-open' : ''} ${drag ? 'is-dragging' : ''}`}
      style={{ left: at.x, top: at.y, width: BUTTON, height: BUTTON }}
      aria-label={nudge ? 'Backpack: something new to do' : 'Backpack'}
      aria-expanded={open}
      aria-controls="backpack"
      title="Backpack (Ctrl+B). Drag to move it to any edge."
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        g.current = { px: e.clientX, py: e.clientY, x: home.x, y: home.y, moved: false };
      }}
      onPointerMove={(e) => {
        const d = g.current;
        if (!d) return;
        const dx = e.clientX - d.px;
        const dy = e.clientY - d.py;
        if (!d.moved && Math.hypot(dx, dy) < 6) return;
        d.moved = true;
        setDrag({
          x: Math.min(Math.max(d.x + dx, 0), window.innerWidth - BUTTON),
          y: Math.min(Math.max(d.y + dy, 0), window.innerHeight - BUTTON),
        });
      }}
      onPointerUp={(e) => {
        const d = g.current;
        g.current = null;
        if (!d) return;
        if (d.moved) {
          const x = Math.min(Math.max(d.x + e.clientX - d.px, 0), window.innerWidth - BUTTON);
          const y = Math.min(Math.max(d.y + e.clientY - d.py, 0), window.innerHeight - BUTTON);
          setSettings({ backpackPos: snapToEdge(x + BUTTON / 2, y + BUTTON / 2) });
          setDrag(null);
          // Swallow the click that follows a drag (if the browser sends one).
          justDragged.current = true;
          window.setTimeout(() => (justDragged.current = false), 60);
        }
      }}
      onPointerCancel={() => {
        g.current = null;
        setDrag(null);
      }}
      onClick={() => {
        // Toggle on click (not pointerup) so a tap's follow-up click can't land on the opened sheet.
        if (justDragged.current) {
          justDragged.current = false;
          return;
        }
        setBackpack(!open);
      }}
      onKeyDown={(e) => {
        const c = cornerOf(pos);
        const next = { ArrowLeft: { ...c, left: true }, ArrowRight: { ...c, left: false }, ArrowUp: { ...c, top: true }, ArrowDown: { ...c, top: false } }[e.key];
        if (!next) return;
        e.preventDefault();
        setSettings({ backpackPos: cornerPos(next.left, next.top) });
      }}
    >
      <PixelIcon name="backpack" size={BUTTON} />
      {nudge && <span className="bp-dot" aria-hidden="true" />}
      {!nudge && minimized > 0 && (
        <span className="bp-count" aria-hidden="true">
          {minimized}
        </span>
      )}
    </button>
  );
}
