import { useRef } from 'react';
import { RotateCw, X } from 'lucide-react';
import { useWorkspace } from '../state/store';
import { useUI } from '../state/ui';
import { currentScale } from '../state/scale';
import { STICKER_BY_KIND } from '../data/stickers';
import type { PlacedSticker } from '../state/types';

/**
 * Stickers sit on the whiteboard under every window, so they can never cover
 * the math. Drag to move; select to rotate, resize, or peel off. Drop one on a
 * window (or an item) and it sticks there, moving and stacking with it; drag
 * it back off to return it to the board.
 */
export function StickerLayer() {
  const stickers = useWorkspace((s) => s.stickers);
  const drawMode = useUI((s) => s.drawMode);
  return (
    <div className={`sticker-layer ${drawMode ? 'is-inert' : ''}`}>
      {stickers
        .filter((s) => !s.on)
        .map((s) => (
          <StickerItem key={s.id} s={s} />
        ))}
    </div>
  );
}

/** The stickers stuck to one window, drawn inside it so they move with it. */
export function AttachedStickers({ winId }: { winId: string }) {
  const stickers = useWorkspace((s) => s.stickers);
  const drawMode = useUI((s) => s.drawMode);
  const mine = stickers.filter((s) => s.on === winId);
  if (!mine.length) return null;
  return (
    <div className={`win-stickers ${drawMode ? 'is-inert' : ''}`}>
      {mine.map((s) => (
        <StickerItem key={s.id} s={s} />
      ))}
    </div>
  );
}

/** The window (or item) under a point, ignoring the sticker being dragged. */
export function windowAt(x: number, y: number, ignore?: Element | null): HTMLElement | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (ignore?.contains(el)) continue;
    if (el.closest('.win-stickers') && !el.closest('.sticker')) continue;
    return el.closest<HTMLElement>('[data-window-id]');
  }
  return null;
}

/** Where a client point sits inside a window, for sticking something there. */
export function localPoint(win: HTMLElement, x: number, y: number) {
  const r = win.getBoundingClientRect();
  const scale = currentScale();
  return { x: (x - r.left) / scale, y: (y - r.top) / scale };
}

function StickerItem({ s }: { s: PlacedSticker }) {
  const update = useWorkspace((st) => st.updateSticker);
  const remove = useWorkspace((st) => st.removeSticker);
  const selected = useUI((st) => st.selectedSticker === s.id);
  const select = useUI((st) => st.selectSticker);
  const ref = useRef<HTMLDivElement>(null);
  const g = useRef<{
    kind: 'move' | 'rotate' | 'scale';
    px: number;
    py: number;
    s: PlacedSticker;
    /** The sticker's centre on screen when the gesture started. */
    cx: number;
    cy: number;
    next?: Partial<PlacedSticker>;
    target?: HTMLElement | null;
  } | null>(null);
  const def = STICKER_BY_KIND[s.kind];
  if (!def) return null;

  const apply = (p: Partial<PlacedSticker>) => {
    const el = ref.current;
    if (!el) return;
    const v = { ...s, ...p };
    el.style.left = `${v.x}px`;
    el.style.top = `${v.y}px`;
    el.style.transform = `translate(-50%, -50%) rotate(${v.rot}deg) scale(${v.scale})`;
  };

  const markTarget = (t: HTMLElement | null) => {
    const cur = g.current;
    if (!cur || cur.target === t) return;
    cur.target?.classList.remove('is-sticker-target');
    if (t && t.dataset.windowId !== s.on) t.classList.add('is-sticker-target');
    cur.target = t;
  };

  const begin = (e: React.PointerEvent, kind: 'move' | 'rotate' | 'scale') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = ref.current!.getBoundingClientRect();
    g.current = { kind, px: e.clientX, py: e.clientY, s, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    // Lift a board sticker above the windows while it moves, so it can be seen over one.
    if (kind === 'move') ref.current!.closest('.sticker-layer')?.classList.add('is-lifted');
    select(s.id);
  };

  const move = (e: React.PointerEvent) => {
    const cur = g.current;
    if (!cur) return;
    if (cur.kind === 'move') {
      const scale = currentScale();
      cur.next = { x: Math.round(cur.s.x + (e.clientX - cur.px) / scale), y: Math.round(cur.s.y + (e.clientY - cur.py) / scale) };
      markTarget(windowAt(e.clientX, e.clientY, ref.current));
    } else {
      const a0 = Math.atan2(cur.py - cur.cy, cur.px - cur.cx);
      const a1 = Math.atan2(e.clientY - cur.cy, e.clientX - cur.cx);
      if (cur.kind === 'rotate') cur.next = { rot: Math.round(cur.s.rot + ((a1 - a0) * 180) / Math.PI) };
      else {
        const d0 = Math.hypot(cur.px - cur.cx, cur.py - cur.cy);
        const d1 = Math.hypot(e.clientX - cur.cx, e.clientY - cur.cy);
        cur.next = { scale: Math.min(3, Math.max(0.4, +(cur.s.scale * (d1 / d0)).toFixed(2))) };
      }
    }
    apply(cur.next);
  };

  const end = (e: React.PointerEvent) => {
    const cur = g.current;
    markTarget(null);
    ref.current?.closest('.sticker-layer')?.classList.remove('is-lifted');
    g.current = null;
    if (!cur?.next) return;
    if (cur.kind !== 'move') return update(s.id, cur.next);
    // Where did it land? Its centre decides: a window, or the board.
    const r = ref.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const target = windowAt(e.clientX, e.clientY, ref.current);
    const targetId = target?.dataset.windowId;
    if (targetId === s.on) return update(s.id, cur.next);
    if (target && targetId) {
      const p = localPoint(target, cx, cy);
      update(s.id, { on: targetId, x: Math.round(p.x), y: Math.round(p.y) });
    } else {
      const layer = document.querySelector('.sticker-layer')?.getBoundingClientRect();
      const scale = currentScale();
      update(s.id, { on: undefined, x: Math.round((cx - (layer?.left ?? 0)) / scale), y: Math.round((cy - (layer?.top ?? 0)) / scale) });
    }
  };

  return (
    <div
      ref={ref}
      className={`sticker ${selected ? 'is-selected' : ''} ${s.on ? 'is-stuck' : ''}`}
      style={{ left: s.x, top: s.y, transform: `translate(-50%, -50%) rotate(${s.rot}deg) scale(${s.scale})` }}
      onPointerDown={(e) => begin(e, 'move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      tabIndex={0}
      role="img"
      aria-label={`Sticker: ${def.name}${s.on ? ', stuck to a window' : ''}. Arrow keys move, R rotates, plus and minus resize, Delete peels it off.`}
      title={def.description}
      onFocus={() => select(s.id)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 20 : 5;
        const k = e.key;
        if (k === 'Delete' || k === 'Backspace') remove(s.id);
        else if (k === 'ArrowLeft') update(s.id, { x: s.x - step });
        else if (k === 'ArrowRight') update(s.id, { x: s.x + step });
        else if (k === 'ArrowUp') update(s.id, { y: s.y - step });
        else if (k === 'ArrowDown') update(s.id, { y: s.y + step });
        else if (k === 'r' || k === 'R') update(s.id, { rot: s.rot + (e.shiftKey ? -15 : 15) });
        else if (k === '+' || k === '=') update(s.id, { scale: Math.min(3, +(s.scale + 0.1).toFixed(2)) });
        else if (k === '-') update(s.id, { scale: Math.max(0.4, +(s.scale - 0.1).toFixed(2)) });
        else if (k === 'Escape') {
          select(null);
          (e.currentTarget as HTMLElement).blur();
        } else return;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {def.render(64)}
      {selected && (
        <>
          <button type="button" className="sticker-handle sticker-remove" onPointerDown={(e) => e.stopPropagation()} onClick={() => remove(s.id)} aria-label="Peel off sticker" tabIndex={-1}>
            <X size={11} />
          </button>
          <span className="sticker-handle sticker-rotate" onPointerDown={(e) => begin(e, 'rotate')} onPointerMove={move} onPointerUp={end} aria-hidden="true">
            <RotateCw size={11} />
          </span>
          <span className="sticker-handle sticker-scale" onPointerDown={(e) => begin(e, 'scale')} onPointerMove={move} onPointerUp={end} aria-hidden="true" />
        </>
      )}
    </div>
  );
}
