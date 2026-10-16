import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../state/store';
import { useUI } from '../../state/ui';
import { currentScale } from '../../state/scale';
import { PixelIcon } from '../ui/pixel-icons/PixelIcon';
import { BUTTON, DEFAULT_POS, buttonXY, cornerOf, cornerPos, snapToEdge } from './geometry';

/**
 * The only piece of chrome on an empty board: a round backpack button.
 * Click to open; drag it anywhere and it snaps back to the nearest edge
 * (pulling into corners). Arrow keys hop it between corners.
 */
export function BackpackButton() {
  const pos = useWorkspace((s) => s.settings.backpackPos) ?? DEFAULT_POS;
  // Subscribed (not just read via currentScale()) so the button re-renders at its
  // new position the moment Text size changes, not on some later, unrelated
  // re-render.
  const uiScale = useWorkspace((s) => s.settings.uiScale) ?? 1;
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

  const home = buttonXY(pos, window.innerWidth / uiScale, window.innerHeight / uiScale);
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
        // Threshold stays in real screen px (how far the pointer physically moved);
        // the position itself is logical, since it's rendered through the page zoom.
        const rdx = e.clientX - d.px;
        const rdy = e.clientY - d.py;
        if (!d.moved && Math.hypot(rdx, rdy) < 6) return;
        d.moved = true;
        const scale = currentScale();
        setDrag({
          x: Math.min(Math.max(d.x + rdx / scale, 0), window.innerWidth / scale - BUTTON),
          y: Math.min(Math.max(d.y + rdy / scale, 0), window.innerHeight / scale - BUTTON),
        });
      }}
      onPointerUp={(e) => {
        const d = g.current;
        g.current = null;
        if (!d) return;
        if (d.moved) {
          const scale = currentScale();
          const x = Math.min(Math.max(d.x + (e.clientX - d.px) / scale, 0), window.innerWidth / scale - BUTTON);
          const y = Math.min(Math.max(d.y + (e.clientY - d.py) / scale, 0), window.innerHeight / scale - BUTTON);
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
