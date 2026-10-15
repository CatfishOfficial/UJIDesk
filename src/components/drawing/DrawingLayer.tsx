import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, Eraser, Highlighter, Minus as LineIcon, PenLine, Redo2, Square, Undo2, Wand2, Check, Trash2 } from 'lucide-react';
import { useWorkspace, uid } from '../../state/store';
import { useUI, type DrawTool } from '../../state/ui';
import type { Stroke } from '../../state/types';
import { INKS, freehandPath, strokeHit } from './ink';
import { recognizeShape } from './recognize';

const SIZES: Record<string, number> = { pen: 3.4, highlighter: 18, line: 2.6, rect: 2.6, ellipse: 2.6 };

export function StrokeView({ s }: { s: Stroke }) {
  const color = INKS[s.color] ?? INKS.graphite;
  if (s.tool === 'pen') return <path d={freehandPath(s.pts, s.size)} fill={color} />;
  if (s.tool === 'highlighter') return <path d={freehandPath(s.pts, s.size, { highlighter: true, simulatePressure: false })} fill={INKS.highlight} className="ink-highlight" />;
  const [x1, y1, , x2, y2] = s.pts;
  const common = { stroke: color, strokeWidth: s.size, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (s.tool === 'line') return <line x1={x1} y1={y1} x2={x2} y2={y2} {...common} />;
  if (s.tool === 'rect') return <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} rx={3} {...common} />;
  return <ellipse cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} rx={Math.abs(x2 - x1) / 2} ry={Math.abs(y2 - y1) / 2} {...common} />;
}

/** Ink that lives on the whiteboard itself, below every window. */
export function InkLayer() {
  const strokes = useWorkspace((s) => s.strokes);
  return (
    <svg className="ink-layer" aria-hidden="true">
      {strokes.map((s) => (
        <StrokeView key={s.id} s={s} />
      ))}
    </svg>
  );
}

/**
 * The capture surface while in Draw mode. It sits above the (ghosted) windows,
 * so arranging the desk and drawing never get mixed up.
 */
export function DrawingSurface() {
  const drawMode = useUI((s) => s.drawMode);
  const tool = useUI((s) => s.drawTool);
  const color = useUI((s) => s.drawColor);
  const assist = useUI((s) => s.shapeAssist);
  const strokes = useWorkspace((s) => s.strokes);
  const setStrokes = useWorkspace((s) => s.setStrokes);
  const [live, setLive] = useState<Stroke | null>(null);
  const liveRef = useRef<Stroke | null>(null);
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  const erasing = useRef<{ before: Stroke[]; removed: boolean } | null>(null);
  const undo = useRef<Stroke[][]>([]);
  const redo = useRef<Stroke[][]>([]);
  const [, bump] = useState(0);

  const commit = useCallback(
    (next: Stroke[]) => {
      undo.current = [...undo.current.slice(-49), useWorkspace.getState().strokes];
      redo.current = [];
      setStrokes(next);
      bump((n) => n + 1);
    },
    [setStrokes],
  );

  const doUndo = useCallback(() => {
    const prev = undo.current.pop();
    if (!prev) return;
    redo.current.push(useWorkspace.getState().strokes);
    setStrokes(prev);
    bump((n) => n + 1);
  }, [setStrokes]);

  const doRedo = useCallback(() => {
    const next = redo.current.pop();
    if (!next) return;
    undo.current.push(useWorkspace.getState().strokes);
    setStrokes(next);
    bump((n) => n + 1);
  }, [setStrokes]);

  useEffect(() => {
    if (!drawMode) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        doRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawMode, doUndo, doRedo]);

  if (!drawMode) return null;

  const clearHold = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const x = e.clientX;
    const y = e.clientY;
    if (tool === 'eraser') {
      erasing.current = { before: strokes, removed: false };
      eraseAt(x, y);
      return;
    }
    const s: Stroke = { id: uid('ink'), tool: tool as Stroke['tool'], color: tool === 'highlighter' ? 'highlight' : color, size: SIZES[tool], pts: [x, y, e.pressure || 0.5] };
    if (tool === 'line' || tool === 'rect' || tool === 'ellipse') s.pts = [x, y, 0.5, x, y, 0.5];
    liveRef.current = s;
    setLive(s);
  };

  const eraseAt = (x: number, y: number) => {
    const cur = useWorkspace.getState().strokes;
    const keep = cur.filter((s) => !strokeHit(s.tool === 'pen' || s.tool === 'highlighter' ? s.pts : outline(s), x, y, s.tool === 'highlighter' ? 10 : 7));
    if (keep.length !== cur.length) {
      setStrokes(keep);
      if (erasing.current) erasing.current.removed = true;
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (tool === 'eraser') {
      if (erasing.current) eraseAt(e.clientX, e.clientY);
      return;
    }
    const s = liveRef.current;
    if (!s) return;
    const x = e.clientX;
    const y = e.clientY;
    let next: Stroke;
    if (s.tool === 'pen' || s.tool === 'highlighter') {
      next = { ...s, pts: [...s.pts, x, y, e.pressure || 0.5] };
      // Hold-to-straighten: pause mid-stroke and it becomes a clean line.
      if (s.tool === 'pen') {
        if (!hold.current || Math.hypot(x - hold.current.x, y - hold.current.y) > 4) {
          clearHold();
          const travelled = Math.hypot(x - s.pts[0], y - s.pts[1]);
          if (travelled > 24) {
            hold.current = {
              x,
              y,
              timer: window.setTimeout(() => {
                const cur = liveRef.current;
                if (!cur || cur.tool !== 'pen') return;
                const straight: Stroke = { ...cur, tool: 'line', size: SIZES.line, pts: [cur.pts[0], cur.pts[1], 0.5, x, y, 0.5] };
                liveRef.current = straight;
                setLive(straight);
              }, 480),
            };
          }
        }
      }
    } else {
      next = { ...s, pts: [s.pts[0], s.pts[1], 0.5, x, y, 0.5] };
      if (e.shiftKey && s.tool !== 'line') {
        const side = Math.max(Math.abs(x - s.pts[0]), Math.abs(y - s.pts[1]));
        next.pts[3] = s.pts[0] + Math.sign(x - s.pts[0]) * side;
        next.pts[4] = s.pts[1] + Math.sign(y - s.pts[1]) * side;
      }
    }
    liveRef.current = next;
    setLive(next);
  };

  const onUp = () => {
    clearHold();
    if (tool === 'eraser') {
      const er = erasing.current;
      erasing.current = null;
      if (er?.removed) {
        undo.current = [...undo.current.slice(-49), er.before];
        redo.current = [];
        bump((n) => n + 1);
      }
      return;
    }
    let s = liveRef.current;
    liveRef.current = null;
    setLive(null);
    if (!s) return;
    if (s.tool === 'pen' && assist) {
      const r = recognizeShape(s.pts);
      if (r) s = { ...s, tool: r.tool, size: SIZES[r.tool], pts: r.pts };
    }
    if (s.tool !== 'pen' && s.tool !== 'highlighter' && Math.hypot(s.pts[3] - s.pts[0], s.pts[4] - s.pts[1]) < 3) return;
    commit([...useWorkspace.getState().strokes, { ...s, pts: s.pts.map((n) => Math.round(n * 10) / 10) }]);
  };

  return (
    <>
      <div className={`draw-surface tool-${tool}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden="true">
        <svg className="ink-live">{live && <StrokeView s={live} />}</svg>
      </div>
      <DrawToolbar canUndo={undo.current.length > 0} canRedo={redo.current.length > 0} onUndo={doUndo} onRedo={doRedo} onClear={() => commit([])} hasInk={strokes.length > 0} />
    </>
  );
}

/** Approximates shape strokes as polylines for hit-testing. */
function outline(s: Stroke): number[] {
  const [x1, y1, , x2, y2] = s.pts;
  if (s.tool === 'line') return [x1, y1, 0, x2, y2, 0];
  if (s.tool === 'rect') return [x1, y1, 0, x2, y1, 0, x2, y2, 0, x1, y2, 0, x1, y1, 0];
  const out: number[] = [];
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 16) out.push(cx + (Math.cos(a) * (x2 - x1)) / 2, cy + (Math.sin(a) * (y2 - y1)) / 2, 0);
  return out;
}

const TOOLS: { id: DrawTool; label: string; icon: JSX.Element }[] = [
  { id: 'pen', label: 'Pen (pause mid-stroke to straighten)', icon: <PenLine size={17} /> },
  { id: 'highlighter', label: 'Highlighter', icon: <Highlighter size={17} /> },
  { id: 'line', label: 'Line', icon: <LineIcon size={17} style={{ transform: 'rotate(-45deg)' }} /> },
  { id: 'rect', label: 'Rectangle (Shift for square)', icon: <Square size={16} /> },
  { id: 'ellipse', label: 'Ellipse (Shift for circle)', icon: <Circle size={16} /> },
  { id: 'eraser', label: 'Eraser', icon: <Eraser size={17} /> },
];
const COLORS = ['graphite', 'periwinkle', 'green', 'coral'];

function DrawToolbar({ canUndo, canRedo, onUndo, onRedo, onClear, hasInk }: { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; onClear: () => void; hasInk: boolean }) {
  const tool = useUI((s) => s.drawTool);
  const setTool = useUI((s) => s.setDrawTool);
  const color = useUI((s) => s.drawColor);
  const setColor = useUI((s) => s.setDrawColor);
  const assist = useUI((s) => s.shapeAssist);
  const setAssist = useUI((s) => s.setShapeAssist);
  const setDrawMode = useUI((s) => s.setDrawMode);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2500);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <div className="draw-toolbar" role="toolbar" aria-label="Drawing tools">
      <div className="draw-group">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" className="draw-btn" aria-pressed={tool === t.id} onClick={() => setTool(t.id)} title={t.label} aria-label={t.label}>
            {t.icon}
          </button>
        ))}
      </div>
      <div className="draw-group" role="radiogroup" aria-label="Ink color">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            className="ink-swatch"
            style={{ '--c': INKS[c] } as React.CSSProperties}
            onClick={() => {
              setColor(c);
              if (tool === 'eraser' || tool === 'highlighter') setTool('pen');
            }}
          />
        ))}
      </div>
      <div className="draw-group">
        <button type="button" className="draw-btn" aria-pressed={assist} onClick={() => setAssist(!assist)} title="Shape assist: tidy clear lines, circles and boxes" aria-label="Shape assist">
          <Wand2 size={16} />
        </button>
        <button type="button" className="draw-btn" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
          <Undo2 size={16} />
        </button>
        <button type="button" className="draw-btn" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={16} />
        </button>
        <button
          type="button"
          className={`draw-btn ${armed ? 'is-armed' : ''}`}
          disabled={!hasInk}
          onClick={() => {
            if (armed) {
              onClear();
              setArmed(false);
            } else setArmed(true);
          }}
          aria-label={armed ? 'Click again to clear the board' : 'Clear board drawing'}
          title={armed ? 'Click again to clear (undo still works)' : 'Clear board drawing'}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <button type="button" className="btn btn-primary btn-sm draw-done" onClick={() => setDrawMode(false)}>
        <Check size={14} /> Done
      </button>
    </div>
  );
}
