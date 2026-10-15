import { useRef, useState, type ReactNode } from 'react';
import type { Win } from '../../state/types';
import { useWorkspace } from '../../state/store';
import { useUI } from '../../state/ui';
import { TOOLS } from '../../data/tools';
import { AttachedStickers } from '../StickerLayer';

const DRAG_THRESHOLD = 4;

/**
 * A frameless object on the desk (the fishbowl): no title bar or border, just
 * the thing itself. Drag from anywhere on it once the pointer has moved a few
 * pixels, so plain clicks still reach what's inside. One corner handle resizes,
 * keeping proportions. Arrow keys nudge it; Shift+arrows resize.
 */
export function BareObject({ win, label, children }: { win: Win; label: string; children: ReactNode }) {
  const meta = TOOLS[win.type];
  const aspect = meta.aspect ?? win.w / win.h;
  const ref = useRef<HTMLElement>(null);
  const g = useRef<{ kind: 'move' | 'resize'; px: number; py: number; x: number; y: number; w: number; id: number; live: boolean; next?: { x: number; y: number; w: number } } | null>(null);
  const [active, setActive] = useState<null | 'move' | 'resize'>(null);
  const focusWindow = useWorkspace((s) => s.focusWindow);
  const setRect = useWorkspace((s) => s.setRect);
  const focused = useUI((s) => s.focusedId === win.id);
  const pulsing = useUI((s) => !!s.pulse[win.id]);
  const drawMode = useUI((s) => s.drawMode);

  const h = Math.round(win.w / aspect);

  const apply = (r: { x: number; y: number; w: number }) => {
    const el = ref.current;
    if (!el) return;
    el.style.left = `${r.x}px`;
    el.style.top = `${r.y}px`;
    el.style.width = `${r.w}px`;
    el.style.height = `${Math.round(r.w / aspect)}px`;
  };

  const start = (e: React.PointerEvent<HTMLElement>, kind: 'move' | 'resize') => {
    if (e.button !== 0) return;
    g.current = { kind, px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: win.w, id: e.pointerId, live: kind === 'resize' };
    if (kind === 'resize') {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setActive('resize');
    }
  };

  const move = (e: React.PointerEvent<HTMLElement>) => {
    const d = g.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.live) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      d.live = true;
      ref.current?.setPointerCapture(e.pointerId);
      setActive('move');
    }
    if (d.kind === 'move') {
      d.next = {
        x: Math.round(Math.min(Math.max(d.x + dx, -d.w + 60), window.innerWidth - 60)),
        y: Math.round(Math.min(Math.max(d.y + dy, 0), window.innerHeight - 40)),
        w: d.w,
      };
    } else {
      d.next = { x: d.x, y: d.y, w: Math.round(Math.min(900, Math.max(meta.min.w, d.w + Math.max(dx, dy * aspect)))) };
    }
    apply(d.next);
  };

  const end = () => {
    const d = g.current;
    g.current = null;
    setActive(null);
    if (d?.live && d.next) setRect(win.id, { x: d.next.x, y: d.next.y, w: d.next.w, h: Math.round(d.next.w / aspect) });
  };

  return (
    <section
      ref={ref}
      className={['bare', `bare-${win.type}`, focused && 'is-focused', active && `is-${active}`, pulsing && 'is-pulsing', drawMode && 'is-ghosted'].filter(Boolean).join(' ')}
      style={{ left: win.x, top: win.y, width: win.w, height: h, zIndex: win.z }}
      hidden={win.minimized}
      aria-label={label}
      data-window-id={win.id}
      onPointerDownCapture={() => focusWindow(win.id)}
      onPointerDown={(e) => start(e, 'move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        const step = e.altKey ? 4 : 16;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (!d) return;
        e.preventDefault();
        if (e.shiftKey) {
          const w = Math.max(meta.min.w, win.w + (d[0] || d[1]));
          setRect(win.id, { w, h: Math.round(w / aspect) });
        } else setRect(win.id, { x: win.x + d[0], y: Math.max(0, win.y + d[1]) });
      }}
    >
      {children}
      <AttachedStickers winId={win.id} />
      <span className="bare-resize" onPointerDown={(e) => start(e, 'resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-hidden="true" />
    </section>
  );
}
