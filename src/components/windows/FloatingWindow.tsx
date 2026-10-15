import { useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { Maximize2, Minimize2, Minus, X } from 'lucide-react';
import type { Win } from '../../state/types';
import { deskBoxes, useWorkspace } from '../../state/store';
import { gridStep, snapActive, snapMove, snapResize, type Box } from '../../state/snap';
import { useUI } from '../../state/ui';
import { TOOLS } from '../../data/tools';
import { TOOL_ICONS } from '../ui/icons';
import { DOCK_SPACE, viewport } from '../../state/placement';
import { currentScale } from '../../state/scale';
import { AttachedStickers } from '../StickerLayer';

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const DIRS: Dir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

interface Props {
  win: Win;
  title?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  compact: boolean;
  /** In compact mode only the front-most window is shown. */
  compactHidden?: boolean;
  headerStyle?: React.CSSProperties;
}

export function FloatingWindow({ win, title, headerExtra, children, bodyClassName = '', compact, compactHidden, headerStyle }: Props) {
  const meta = TOOLS[win.type];
  const ref = useRef<HTMLElement>(null);
  const gesture = useRef<{ kind: 'move' | Dir; px: number; py: number; x: number; y: number; w: number; h: number; next?: { x: number; y: number; w: number; h: number }; others: Box[] } | null>(null);
  const [active, setActive] = useState<null | 'move' | 'resize'>(null);

  const focusWindow = useWorkspace((s) => s.focusWindow);
  const setRect = useWorkspace((s) => s.setRect);
  const minimize = useWorkspace((s) => s.minimize);
  const closeWindow = useWorkspace((s) => s.closeWindow);
  const toggleMaximize = useWorkspace((s) => s.toggleMaximize);
  const focused = useUI((s) => s.focusedId === win.id);
  const pulsing = useUI((s) => !!s.pulse[win.id]);
  const drawMode = useUI((s) => s.drawMode);

  const free = !compact && !win.maximized;
  const name = title ?? meta.title;
  const Icon = TOOL_ICONS[win.type];

  const apply = (r: { x: number; y: number; w: number; h: number }) => {
    const el = ref.current;
    if (!el) return;
    el.style.left = `${r.x}px`;
    el.style.top = `${r.y}px`;
    el.style.width = `${r.w}px`;
    el.style.height = `${r.h}px`;
  };

  const begin = (e: RPointerEvent<HTMLElement>, kind: 'move' | Dir) => {
    if (e.button !== 0 || !free) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { kind, px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: win.w, h: win.h, others: deskBoxes(win.id) };
    setActive(kind === 'move' ? 'move' : 'resize');
    e.preventDefault();
  };

  const moveGesture = (e: RPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g) return;
    const scale = currentScale();
    const dx = (e.clientX - g.px) / scale;
    const dy = (e.clientY - g.py) / scale;
    const { vw, vh } = viewport();
    let { x, y, w, h } = g;
    // Snapping (if switched on in Settings). Holding Alt places the window freely.
    const arrange = useWorkspace.getState().settings.arrange;
    const snapping = !!arrange && snapActive(arrange) && !e.altKey;
    if (g.kind === 'move') {
      x = g.x + dx;
      y = g.y + dy;
      if (snapping) {
        const r = snapMove({ x, y, w, h }, g.others, arrange, { w: vw, h: vh });
        ({ x, y } = r.box);
        useUI.getState().setGuides(r.guides);
      } else useUI.getState().setGuides([]);
      x = Math.min(Math.max(x, -g.w + 96), vw - 96);
      y = Math.min(Math.max(y, 0), vh - DOCK_SPACE + 16);
    } else {
      const k = g.kind;
      if (k.includes('e')) w = Math.max(meta.min.w, g.w + dx);
      if (k.includes('s')) h = Math.max(meta.min.h, g.h + dy);
      if (k.includes('w')) {
        w = Math.max(meta.min.w, g.w - dx);
        x = g.x + g.w - w;
      }
      if (k.includes('n')) {
        h = Math.max(meta.min.h, g.h - dy);
        y = Math.max(0, g.y + g.h - h);
        h = g.y + g.h - y;
      }
      if (snapping) {
        const r = snapResize({ x, y, w, h }, k, g.others, arrange, { w: vw, h: vh }, meta.min);
        ({ x, y, w, h } = r.box);
        useUI.getState().setGuides(r.guides);
      } else useUI.getState().setGuides([]);
    }
    g.next = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    apply(g.next);
  };

  const end = () => {
    const g = gesture.current;
    gesture.current = null;
    setActive(null);
    useUI.getState().setGuides([]);
    if (g?.next) setRect(win.id, g.next);
  };

  const onTitleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!free) return;
    const step = e.altKey ? 4 : 16;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    // With grid snapping on, arrow keys move a whole grid step and land on the grid (Alt still nudges freely).
    const arrange = useWorkspace.getState().settings.arrange;
    if (arrange?.grid && !e.altKey) {
      const gs = arrange.gridSize;
      const sx = Math.sign(d[0]) as -1 | 0 | 1;
      const sy = Math.sign(d[1]) as -1 | 0 | 1;
      if (e.shiftKey) setRect(win.id, { w: Math.max(meta.min.w, sx ? gridStep(win.x + win.w, sx as 1 | -1, gs) - win.x : win.w), h: Math.max(meta.min.h, sy ? gridStep(win.y + win.h, sy as 1 | -1, gs) - win.y : win.h) });
      else setRect(win.id, { x: sx ? gridStep(win.x, sx as 1 | -1, gs) : win.x, y: Math.max(0, sy ? gridStep(win.y, sy as 1 | -1, gs) : win.y) });
      return;
    }
    if (e.shiftKey) {
      setRect(win.id, { w: Math.max(meta.min.w, win.w + d[0]), h: Math.max(meta.min.h, win.h + d[1]) });
    } else {
      setRect(win.id, { x: win.x + d[0], y: Math.max(0, win.y + d[1]) });
    }
  };

  const style: React.CSSProperties = compact
    ? { zIndex: win.z }
    : win.maximized
      ? { zIndex: win.z }
      : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };

  const chrome = meta.chrome ?? 'default';
  const classes = [
    'win',
    `win-${win.type}`,
    `chrome-${chrome}`,
    focused && 'is-focused',
    active === 'move' && 'is-moving',
    active === 'resize' && 'is-resizing',
    win.maximized && 'is-maximized',
    compact && 'is-compact',
    pulsing && 'is-pulsing',
    drawMode && 'is-ghosted',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      ref={ref}
      className={classes}
      style={style}
      hidden={win.minimized || compactHidden}
      aria-label={name}
      data-window-id={win.id}
      onPointerDownCapture={() => focusWindow(win.id)}
      onFocusCapture={() => !focused && focusWindow(win.id)}
    >
      <div
        className="win-titlebar"
        style={headerStyle}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button, input, select, a, [data-no-drag]')) return;
          begin(e, 'move');
        }}
        onPointerMove={moveGesture}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('button, input, select, a, [data-no-drag]')) return;
          if (meta.resizable && !compact) toggleMaximize(win.id);
        }}
      >
        <div
          className="win-handle"
          tabIndex={free ? 0 : -1}
          role="group"
          aria-label={`${name}. Arrow keys move the window, Shift plus arrows resize it.`}
          onKeyDown={onTitleKey}
        >
          {chrome !== 'sticky' && (
            <span className="win-icon">
              <Icon size={16} />
            </span>
          )}
          <h2 className="win-title">{name}</h2>
        </div>
        <div className="win-header-extra" data-no-drag>
          {headerExtra}
        </div>
        <div className="win-controls">
          <button type="button" className="win-btn" onClick={() => minimize(win.id)} aria-label={`Minimize ${name}`} title="Minimize">
            <Minus size={14} />
          </button>
          {meta.resizable && !compact && (
            <button
              type="button"
              className="win-btn"
              onClick={() => toggleMaximize(win.id)}
              aria-label={win.maximized ? `Restore ${name} size` : `Maximize ${name}`}
              title={win.maximized ? 'Restore size' : 'Maximize'}
            >
              {win.maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
          <button type="button" className="win-btn win-btn-close" onClick={() => closeWindow(win.id)} aria-label={`Close ${name}`} title="Close">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className={`win-body ${bodyClassName}`}>{children}</div>
      <AttachedStickers winId={win.id} />
      {free &&
        meta.resizable &&
        DIRS.map((d) => (
          <div
            key={d}
            className={`win-resize win-resize-${d}`}
            onPointerDown={(e) => begin(e, d)}
            onPointerMove={moveGesture}
            onPointerUp={end}
            onPointerCancel={end}
            aria-hidden="true"
          />
        ))}
    </section>
  );
}
