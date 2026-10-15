import type { ReactNode } from 'react';
import type { Rational } from '../../math/rational';
import { round } from '../../math/surd';

/**
 * Small, quiet diagrams for the geometry and data tools. Drawn with theme
 * tokens, so they follow light and dark mode. Unknowns are marked in the accent.
 */

interface Label {
  text: string;
  unknown?: boolean;
}

function Tag({ x, y, label, anchor = 'middle' }: { x: number; y: number; label: Label; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className={`fig-label ${label.unknown ? 'is-unknown' : ''}`}>
      {label.text}
    </text>
  );
}

/**
 * A right triangle with the right angle at the bottom right: the base runs
 * left to right, the height goes up the right side, the hypotenuse is the slope.
 */
export function RightTriangle({
  base,
  height,
  baseLabel,
  heightLabel,
  hypLabel,
  angleLabel,
}: {
  base: number;
  height: number;
  baseLabel: Label;
  heightLabel: Label;
  hypLabel: Label;
  /** Shown at the bottom-left corner (angle A for trig). */
  angleLabel?: Label;
}) {
  const W = 260;
  const H = 150;
  // Keep extreme triangles readable: squash the ratio into a friendly range.
  const ratio = Math.min(2.2, Math.max(0.28, height / base || 0.75));
  const bw = ratio > 0.6 ? Math.min(150, 110 / ratio) : 170;
  const bh = Math.min(110, bw * ratio);
  const x0 = (W - bw) / 2 - 10;
  const y0 = H - 22;
  const x1 = x0 + bw;
  const y1 = y0 - bh;
  const angle = Math.atan2(bh, bw);
  return (
    <svg className="fig" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Right triangle diagram">
      <polygon points={`${x0},${y0} ${x1},${y0} ${x1},${y1}`} className="fig-shape" />
      <polyline points={`${x1 - 11},${y0} ${x1 - 11},${y0 - 11} ${x1},${y0 - 11}`} className="fig-mark" />
      {angleLabel && (
        <>
          <path d={`M ${x0 + 24} ${y0} A 24 24 0 0 0 ${x0 + 24 * Math.cos(angle)} ${y0 - 24 * Math.sin(angle)}`} className={`fig-arc ${angleLabel.unknown ? 'is-unknown' : ''}`} />
          <Tag x={x0 + 36 * Math.cos(angle / 2) + 8} y={y0 - 36 * Math.sin(angle / 2) + 1} label={angleLabel} anchor="start" />
        </>
      )}
      <Tag x={(x0 + x1) / 2} y={y0 + 13} label={baseLabel} />
      <Tag x={x1 + 8} y={(y0 + y1) / 2} label={heightLabel} anchor="start" />
      <Tag x={(x0 + x1) / 2 - 10 * Math.sin(angle) - 4} y={(y0 + y1) / 2 - 10 * Math.cos(angle) - 4} label={hypLabel} anchor="end" />
    </svg>
  );
}

export type ShapeKind = 'rectangle' | 'square' | 'triangle' | 'parallelogram' | 'trapezoid' | 'circle';

/** The area tool's shape, with its measurements written on. */
export function ShapeFigure({ shape, labels }: { shape: ShapeKind; labels: Record<string, string> }) {
  const W = 260;
  const H = 150;
  const L = (k: string): Label => ({ text: labels[k] || '?', unknown: !labels[k] });
  let body: ReactNode;
  switch (shape) {
    case 'rectangle':
      body = (
        <>
          <rect x={55} y={30} width={150} height={88} className="fig-shape" />
          <Tag x={130} y={130} label={L('l')} />
          <Tag x={213} y={74} label={L('w')} anchor="start" />
        </>
      );
      break;
    case 'square':
      body = (
        <>
          <rect x={86} y={25} width={92} height={92} className="fig-shape" />
          <Tag x={132} y={130} label={L('s')} />
          <Tag x={186} y={71} label={L('s')} anchor="start" />
        </>
      );
      break;
    case 'triangle':
      body = (
        <>
          <polygon points="50,118 210,118 150,26" className="fig-shape" />
          <line x1={150} y1={26} x2={150} y2={118} className="fig-dash" />
          <polyline points="150,108 160,108 160,118" className="fig-mark" />
          <Tag x={130} y={131} label={L('b')} />
          <Tag x={156} y={74} label={L('h')} anchor="start" />
          {labels.s1 && <Tag x={92} y={66} label={L('s1')} anchor="end" />}
          {labels.s2 && <Tag x={188} y={66} label={L('s2')} anchor="start" />}
        </>
      );
      break;
    case 'parallelogram':
      body = (
        <>
          <polygon points="45,118 185,118 220,30 80,30" className="fig-shape" />
          <line x1={80} y1={30} x2={80} y2={118} className="fig-dash" />
          <polyline points="80,108 90,108 90,118" className="fig-mark" />
          <Tag x={115} y={131} label={L('b')} />
          <Tag x={86} y={74} label={L('h')} anchor="start" />
          {labels.s1 && <Tag x={210} y={74} label={L('s1')} anchor="start" />}
        </>
      );
      break;
    case 'trapezoid':
      body = (
        <>
          <polygon points="40,118 220,118 175,32 85,32" className="fig-shape" />
          <line x1={85} y1={32} x2={85} y2={118} className="fig-dash" />
          <polyline points="85,108 95,108 95,118" className="fig-mark" />
          <Tag x={130} y={21} label={L('b1')} />
          <Tag x={130} y={131} label={L('b2')} />
          <Tag x={91} y={76} label={L('h')} anchor="start" />
        </>
      );
      break;
    case 'circle': {
      const byD = !labels.r && !!labels.d;
      body = (
        <>
          <circle cx={130} cy={72} r={55} className="fig-shape" />
          <circle cx={130} cy={72} r={2.5} className="fig-dot" />
          {byD ? <line x1={75} y1={72} x2={185} y2={72} className="fig-line" /> : <line x1={130} y1={72} x2={185} y2={72} className="fig-line" />}
          <Tag x={byD ? 130 : 157} y={62} label={byD ? L('d') : L('r')} />
        </>
      );
      break;
    }
  }
  return (
    <svg className="fig" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${shape} diagram`}>
      {body}
    </svg>
  );
}

/** Dots stacked over a number line, with the mean (▲) and median (|) marked when given. */
export function DotPlot({ values, mean, median }: { values: Rational[]; mean?: number; median?: number }) {
  const marked = mean != null && median != null;
  const W = 280;
  const nums = values.map((v) => v.toNumber());
  const many = values.length > 40;
  const r = many ? 2.6 : 4.2;
  const tallest = Math.max(...[...nums.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<number, number>()).values()]);
  const H = Math.min(150, Math.max(70, 52 + tallest * (r * 2 + 1.5)));
  let lo = Math.min(...nums);
  let hi = Math.max(...nums);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.06;
  lo -= pad;
  hi += pad;
  const X = (v: number) => 18 + ((v - lo) / (hi - lo)) * (W - 36);
  const axisY = H - (marked ? 34 : 22);
  const stacks = new Map<string, number>();
  const dots = nums.map((v) => {
    const k = round(v, 6);
    const i = stacks.get(k) ?? 0;
    stacks.set(k, i + 1);
    return { x: X(v), y: axisY - r - 2 - i * (r * 2 + 1.5) };
  });
  const tickStep = niceStep((hi - lo) / 5);
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / tickStep) * tickStep; t <= hi; t += tickStep) ticks.push(+t.toFixed(10));
  return (
    <svg className="fig fig-dotplot" viewBox={`0 0 ${W} ${marked ? H : H - 12}`} role="img" aria-label={marked ? 'Dot plot with mean and median' : 'Dot plot of the data'}>
      <line x1={10} y1={axisY} x2={W - 10} y2={axisY} className="fig-axis" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={X(t)} y1={axisY} x2={X(t)} y2={axisY + 4} className="fig-axis" />
          <text x={X(t)} y={axisY + 14} textAnchor="middle" className="fig-tick">
            {round(t, 3)}
          </text>
        </g>
      ))}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={Math.max(6, d.y)} r={r} className="fig-dot" />
      ))}
      {marked && (
        <>
          <line x1={X(median)} y1={axisY - 2} x2={X(median)} y2={axisY + 22} className="fig-median" />
          <polygon points={`${X(mean)},${axisY + 18} ${X(mean) - 5},${axisY + 27} ${X(mean) + 5},${axisY + 27}`} className="fig-mean" />
          <text x={W - 10} y={H - 4} textAnchor="end" className="fig-key">
            <tspan className="fig-key-mean">▲ mean</tspan>
            <tspan dx={10} className="fig-key-median">
              | median
            </tspan>
          </text>
        </>
      )}
    </svg>
  );
}

function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/**
 * Terms in a row with the step between each pair, then the next term ghosted
 * in. Without `op` the steps stay hidden (for practice); `skip` puts a gap
 * before the last box, for "term n = ?".
 */
export function TermStrip({ terms, op, next, skip }: { terms: string[]; op?: string; next: string; skip?: boolean }) {
  const shown = terms.length > 6 ? [...terms.slice(0, 5), '…'] : terms;
  const sep = (key: string) => (op ? <span className="term-op">{op}</span> : <span key={key} className="term-op is-comma">,</span>);
  return (
    <div className="term-strip" aria-label={`Terms ${terms.join(', ')}, then ${next}`}>
      {shown.map((t, i) => (
        <span key={i} className="term-wrap">
          {i > 0 && t !== '…' && sep(`s${i}`)}
          <span className={`term ${t === '…' ? 'is-gap' : ''}`}>{t}</span>
        </span>
      ))}
      <span className="term-wrap">
        {skip ? <span className="term-op is-skip">…</span> : sep('last')}
        <span className="term is-next">{next}</span>
      </span>
    </div>
  );
}

/** A small coordinate grid with labelled points, for slope problems. */
export function PointPlot({ points, note }: { points: [number, number][]; note?: string }) {
  const W = 240;
  const H = 170;
  const xs = [0, ...points.map((p) => p[0])];
  const ys = [0, ...points.map((p) => p[1])];
  // A square-ish window around the points (and the origin), in whole units.
  let x0 = Math.floor(Math.min(...xs)) - 1;
  let x1 = Math.ceil(Math.max(...xs)) + 1;
  let y0 = Math.floor(Math.min(...ys)) - 1;
  let y1 = Math.ceil(Math.max(...ys)) + 1;
  const span = Math.max(x1 - x0, ((y1 - y0) * (W - 24)) / (H - 24));
  const cx = (x0 + x1) / 2;
  x0 = cx - span / 2;
  x1 = cx + span / 2;
  const unit = (W - 24) / span;
  const spanY = (H - 24) / unit;
  const cy = (y0 + y1) / 2;
  y0 = cy - spanY / 2;
  y1 = cy + spanY / 2;
  const X = (x: number) => 12 + (x - x0) * unit;
  const Y = (y: number) => 12 + (y1 - y) * unit;
  const step = niceStep(span / 8) || 1;
  const grid: number[] = [];
  for (let t = Math.ceil(x0 / step) * step; t <= x1; t += step) grid.push(t);
  const gridY: number[] = [];
  for (let t = Math.ceil(y0 / step) * step; t <= y1; t += step) gridY.push(t);
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : round(v, 2)).replace('-', '−');
  return (
    <svg className="fig fig-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Points ${points.map((p) => `(${fmt(p[0])}, ${fmt(p[1])})`).join(' and ')}`}>
      {grid.map((t) => (
        <line key={`x${t}`} x1={X(t)} y1={12} x2={X(t)} y2={H - 12} className="fig-grid" />
      ))}
      {gridY.map((t) => (
        <line key={`y${t}`} x1={12} y1={Y(t)} x2={W - 12} y2={Y(t)} className="fig-grid" />
      ))}
      {x0 <= 0 && x1 >= 0 && <line x1={X(0)} y1={12} x2={X(0)} y2={H - 12} className="fig-axis" />}
      {y0 <= 0 && y1 >= 0 && <line x1={12} y1={Y(0)} x2={W - 12} y2={Y(0)} className="fig-axis" />}
      {points.map(([x, y], i) => (
        <g key={i}>
          <circle cx={X(x)} cy={Y(y)} r={4} className="fig-dot" />
          <text x={X(x) + (X(x) > W - 70 ? -7 : 7)} y={Y(y) + (Y(y) < 24 ? 14 : -7)} textAnchor={X(x) > W - 70 ? 'end' : 'start'} className="fig-label">
            ({fmt(x)}, {fmt(y)})
          </text>
        </g>
      ))}
      {note && (
        <text x={W - 14} y={H - 16} textAnchor="end" className="fig-label is-unknown">
          {note}
        </text>
      )}
    </svg>
  );
}
