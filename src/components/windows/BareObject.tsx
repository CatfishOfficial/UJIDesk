import { useRef, useState, type ReactNode } from 'react';
import type { Win } from '../../state/types';
import { deskBoxes, useWorkspace } from '../../state/store';
import { snapActive, snapMove, snapResize, type Box } from '../../state/snap';
import { useUI } from '../../state/ui';
import { TOOLS } from '../../data/tools';
import { viewport } from '../../state/placement';
import { currentScale } from '../../state/scale';
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
  const g = useRef<{ kind: 'move' | 'resize'; px: number; py: number; x: number; y: number; w: number; id: number; live: boolean; next?: { x: number; y: number; w: number }; others: Box[] } | null>(null);
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
    g.current = { kind, px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: win.w, id: e.pointerId, live: kind === 'resize', others: deskBoxes(win.id) };
    if (kind === 'resize') {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setActive('resize');
    }
  };

  const move = (e: React.PointerEvent<HTMLElement>) => {
    const d = g.current;
    if (!d || e.pointerId !== d.id) return;
    // Threshold stays in real screen px (how far the pointer physically moved);
    // the position itself is logical, since it's rendered through the page zoom.
    const rdx = e.clientX - d.px;
    const rdy = e.clientY - d.py;
    if (!d.live) {
      if (Math.hypot(rdx, rdy) < DRAG_THRESHOLD) return;
      d.live = true;
      ref.current?.setPointerCapture(e.pointerId);
      setActive('move');
    }
    const scale = currentScale();
    const dx = rdx / scale;
    const dy = rdy / scale;
    // Snapping (if switched on in Settings). Holding Alt places it freely.
    const arrange = useWorkspace.getState().settings.arrange;
    const snapping = !!arrange && snapActive(arrange) && !e.altKey;
    const { vw, vh } = viewport();
    const view = { w: vw, h: vh };
    if (d.kind === 'move') {
      let x = d.x + dx;
      let y = d.y + dy;
      if (snapping) {
        const r = snapMove({ x, y, w: d.w, h: Math.round(d.w / aspect) }, d.others, arrange, view);
        ({ x, y } = r.box);
        useUI.getState().setGuides(r.guides);
      } else useUI.getState().setGuides([]);
      d.next = {
        x: Math.round(Math.min(Math.max(x, -d.w + 60), vw - 60)),
        y: Math.round(Math.min(Math.max(y, 0), vh - 40)),
        w: d.w,
      };
    } else {
      let w = Math.round(Math.min(900, Math.max(meta.min.w, d.w + Math.max(dx, dy * aspect))));
      // Items keep their proportions, so only the right edge snaps.
      if (snapping) {
        const r = snapResize({ x: d.x, y: d.y, w, h: Math.round(w / aspect) }, 'e', d.others, arrange, view, { w: meta.min.w, h: 0 });
        w = r.box.w;
        useUI.getState().setGuides(r.guides);
      } else useUI.getState().setGuides([]);
      d.next = { x: d.x, y: d.y, w };
    }
    apply(d.next);
  };

  const end = () => {
    const d = g.current;
    g.current = null;
    setActive(null);
    useUI.getState().setGuides([]);
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
