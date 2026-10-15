import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Home, Minus, Plus, X } from 'lucide-react';
import { useWindowData, uid } from '../../state/store';
import { evaluate, formatNumber, parseGraphable, type GraphFunction, type GraphVertical } from '../../math/expression';
import { GRAPH_COLORS, type GraphEquation } from './bridge';

interface GraphData extends Record<string, unknown> {
  equations: GraphEquation[];
  view: { cx: number; cy: number; scale: number };
}

const DEFAULT_VIEW = { cx: 0, cy: 0, scale: 32 };

function niceStep(scale: number): number {
  const target = 36 / scale; // aim for ~36px between grid lines
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  for (const m of [1, 2, 5, 10]) if (m * pow >= target) return m * pow;
  return 10 * pow;
}

function tryParse(text: string): GraphFunction | GraphVertical | { error: string } {
  try {
    return parseGraphable(text);
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export function GraphTool({ winId }: { winId: string }) {
  const [data, update] = useWindowData<GraphData>(winId);
  const equations = data.equations ?? [];
  const view = data.view ?? DEFAULT_VIEW;
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 400, h: 300 });
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [liveView, setLiveView] = useState<GraphData['view'] | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start: GraphData['view']; cur: GraphData['view']; dist?: number; mid?: { x: number; y: number } } | null>(null);

  const v = liveView ?? view;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toPx = (x: number, y: number) => ({ px: size.w / 2 + (x - v.cx) * v.scale, py: size.h / 2 - (y - v.cy) * v.scale });
  const toWorld = (px: number, py: number) => ({ x: v.cx + (px - size.w / 2) / v.scale, y: v.cy - (py - size.h / 2) / v.scale });

  const parsed = useMemo(() => equations.map((e) => ({ eq: e, p: tryParse(e.text) })), [equations]);

  const grid = useMemo(() => {
    const step = niceStep(v.scale);
    const left = v.cx - size.w / 2 / v.scale;
    const right = v.cx + size.w / 2 / v.scale;
    const bottom = v.cy - size.h / 2 / v.scale;
    const top = v.cy + size.h / 2 / v.scale;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let x = Math.ceil(left / step) * step; x <= right; x += step) xs.push(+x.toFixed(10));
    for (let y = Math.ceil(bottom / step) * step; y <= top; y += step) ys.push(+y.toFixed(10));
    return { step, xs, ys, left, right };
  }, [v, size]);

  const paths = useMemo(
    () =>
      parsed.map(({ eq, p }) => {
        if (!eq.visible || 'error' in p) return null;
        if (p.kind === 'vertical') {
          const { px } = toPx(p.x, 0);
          return `M${px},0 L${px},${size.h}`;
        }
        let d = '';
        let pen = false;
        let prevY = 0;
        for (let px = -2; px <= size.w + 2; px += 2) {
          const x = v.cx + (px - size.w / 2) / v.scale;
          const y = evaluate(p.node, x);
          const py = size.h / 2 - (y - v.cy) * v.scale;
          if (!Number.isFinite(py) || Math.abs(py) > size.h * 20 || (pen && Math.abs(py - prevY) > size.h * 2)) {
            pen = false;
            continue;
          }
          d += `${pen ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
          pen = true;
          prevY = py;
        }
        return d;
      }),
    [parsed, v, size],
  );

  const commitView = (next: GraphData['view']) => {
    setLiveView(null);
    update({ view: next });
  };

  const zoomAt = (factor: number, px = size.w / 2, py = size.h / 2, base = v) => zoomAtBase(base, factor, px, py, size.w, size.h);

  // Wheel needs a non-passive listener to prevent page zoom/scroll.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      update((d) => ({ view: zoomAtBase(d.view ?? DEFAULT_VIEW, factor, e.clientX - r.left, e.clientY - r.top, r.width, r.height) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const local = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    const cur = gesture.current?.cur ?? v;
    gesture.current = { start: cur, cur };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { start: cur, cur, dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = local(e);
    const w = toWorld(p.x, p.y);
    setHover(w);
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !gesture.current) return;
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (pointers.current.size >= 2 && g.dist && g.mid) {
      const [a, b] = [...pointers.current.values()];
      g.cur = zoomAt(Math.hypot(a.x - b.x, a.y - b.y) / g.dist, g.mid.x, g.mid.y, g.start);
    } else {
      g.cur = { ...g.cur, cx: g.cur.cx - (p.x - prev.x) / g.cur.scale, cy: g.cur.cy + (p.y - prev.y) / g.cur.scale };
    }
    setLiveView(g.cur);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      const g = gesture.current;
      gesture.current = null;
      if (g && g.cur !== g.start) commitView(g.cur);
      else setLiveView(null);
    }
  };

  const addEquation = () => {
    const text = draft.trim();
    if (!text) return;
    const p = tryParse(text);
    if ('error' in p) {
      setDraftError(p.error);
      return;
    }
    update({ equations: [...equations, { id: uid('eq'), text, color: GRAPH_COLORS[equations.length % GRAPH_COLORS.length], visible: true }] });
    setDraft('');
    setDraftError(null);
  };

  const axisX = Math.min(Math.max(toPx(0, 0).py, 0), size.h); // y pixel of the x-axis
  const axisY = Math.min(Math.max(toPx(0, 0).px, 0), size.w);
  const labelFmt = (n: number) => formatNumber(n);

  return (
    <div className="graph">
      <div
        ref={boxRef}
        className="graph-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Graph of ${equations.filter((e) => e.visible).map((e) => e.text).join(', ') || 'nothing yet'}`}
      >
        <svg width={size.w} height={size.h} aria-hidden="true">
          {grid.xs.map((x) => {
            const { px } = toPx(x, 0);
            const major = Math.abs(Math.round(x / grid.step) % 5) === 0;
            return <line key={`x${x}`} x1={px} x2={px} y1={0} y2={size.h} className={major ? 'g-major' : 'g-minor'} />;
          })}
          {grid.ys.map((y) => {
            const { py } = toPx(0, y);
            const major = Math.abs(Math.round(y / grid.step) % 5) === 0;
            return <line key={`y${y}`} y1={py} y2={py} x1={0} x2={size.w} className={major ? 'g-major' : 'g-minor'} />;
          })}
          <line x1={0} x2={size.w} y1={toPx(0, 0).py} y2={toPx(0, 0).py} className="g-axis" />
          <line y1={0} y2={size.h} x1={toPx(0, 0).px} x2={toPx(0, 0).px} className="g-axis" />
          {grid.xs.map((x) =>
            x === 0 || Math.abs(Math.round(x / grid.step)) % 2 ? null : (
              <text key={`lx${x}`} x={toPx(x, 0).px} y={Math.min(axisX + 13, size.h - 4)} className="g-label" textAnchor="middle">
                {labelFmt(x)}
              </text>
            ),
          )}
          {grid.ys.map((y) =>
            y === 0 || Math.abs(Math.round(y / grid.step)) % 2 ? null : (
              <text key={`ly${y}`} x={Math.max(axisY - 5, 22)} y={toPx(0, y).py + 3.5} className="g-label" textAnchor="end">
                {labelFmt(y)}
              </text>
            ),
          )}
          {paths.map((d, i) => d && <path key={parsed[i].eq.id} d={d} stroke={parsed[i].eq.color} className="g-curve" />)}
          {equations.map(
            (e) =>
              e.visible &&
              e.points?.map(([x, y], i) => {
                const { px, py } = toPx(x, y);
                return (
                  <g key={`${e.id}-p${i}`}>
                    <circle cx={px} cy={py} r={4.5} fill="var(--surface)" stroke={e.color} strokeWidth={2.2} />
                    <text x={px + 8} y={py - 8} className="g-point-label">
                      ({labelFmt(x)}, {labelFmt(y)})
                    </text>
                  </g>
                );
              }),
          )}
        </svg>
        {hover && (
          <div className="graph-readout" aria-hidden="true">
            x {formatNumber(+hover.x.toFixed(2))}, y {formatNumber(+hover.y.toFixed(2))}
          </div>
        )}
        <div className="graph-zoom">
          <button type="button" className="btn btn-sm btn-icon" onClick={() => commitView(zoomAt(1.4))} aria-label="Zoom in">
            <Plus size={14} />
          </button>
          <button type="button" className="btn btn-sm btn-icon" onClick={() => commitView(zoomAt(1 / 1.4))} aria-label="Zoom out">
            <Minus size={14} />
          </button>
          <button type="button" className="btn btn-sm btn-icon" onClick={() => commitView(DEFAULT_VIEW)} aria-label="Reset view">
            <Home size={13} />
          </button>
        </div>
      </div>

      <div className="graph-list">
        {parsed.map(({ eq, p }) => (
          <div key={eq.id} className={`graph-eq ${eq.visible ? '' : 'is-hidden'}`}>
            <button
              type="button"
              className="graph-swatch"
              style={{ '--c': eq.color } as React.CSSProperties}
              onClick={() => update({ equations: equations.map((e) => (e.id === eq.id ? { ...e, visible: !e.visible } : e)) })}
              aria-label={eq.visible ? `Hide ${eq.text}` : `Show ${eq.text}`}
              aria-pressed={eq.visible}
            >
              {eq.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <span className="graph-eq-text">{eq.text}</span>
            {'error' in p && <span className="graph-eq-err" title={p.error}>can't plot</span>}
            <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={() => update({ equations: equations.filter((e) => e.id !== eq.id) })} aria-label={`Remove ${eq.text}`}>
              <X size={13} />
            </button>
          </div>
        ))}
        <form
          className="graph-add"
          onSubmit={(e) => {
            e.preventDefault();
            addEquation();
          }}
        >
          <input
            className={`field field-math ${draftError ? 'is-invalid' : ''}`}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setDraftError(null);
            }}
            placeholder="y = 2x + 1"
            aria-label="Add an equation to graph"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn btn-sm" disabled={!draft.trim()}>
            Plot
          </button>
        </form>
        {draftError && <p className="field-error">{draftError}</p>}
      </div>
    </div>
  );
}

function zoomAtBase(base: { cx: number; cy: number; scale: number }, factor: number, px: number, py: number, w: number, h: number) {
  const scale = Math.min(800, Math.max(2, base.scale * factor));
  const wx = base.cx + (px - w / 2) / base.scale;
  const wy = base.cy - (py - h / 2) / base.scale;
  return { scale, cx: wx - (px - w / 2) / scale, cy: wy + (py - h / 2) / scale };
}
