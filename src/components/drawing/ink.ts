import { getStroke } from 'perfect-freehand';

export const INKS: Record<string, string> = {
  graphite: 'var(--ink-graphite)',
  periwinkle: 'var(--ink-periwinkle)',
  green: 'var(--ink-green)',
  coral: 'var(--ink-coral)',
  highlight: 'var(--ink-highlight)',
};

/** Turns flat [x, y, pressure, …] samples into a filled SVG outline path. */
export function freehandPath(flat: number[], size: number, opts: { simulatePressure?: boolean; highlighter?: boolean } = {}): string {
  const pts: [number, number, number][] = [];
  for (let i = 0; i + 2 < flat.length + 1; i += 3) pts.push([flat[i], flat[i + 1], flat[i + 2] ?? 0.5]);
  const outline = getStroke(pts, {
    size,
    thinning: opts.highlighter ? 0 : 0.55,
    smoothing: 0.55,
    streamline: 0.45,
    simulatePressure: opts.simulatePressure ?? true,
    start: { taper: opts.highlighter ? 0 : 6, cap: true },
    end: { taper: opts.highlighter ? 0 : 8, cap: true },
  });
  if (!outline.length) return '';
  const d = outline.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0.toFixed(1), y0.toFixed(1), ((x0 + x1) / 2).toFixed(1), ((y0 + y1) / 2).toFixed(1));
      return acc;
    },
    ['M', ...outline[0].map((n) => n.toFixed(1)), 'Q'] as string[],
  );
  d.push('Z');
  return d.join(' ');
}

/** Distance from point p to segment ab. */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** True if any sample of the stroke passes within r of (x, y). */
export function strokeHit(flat: number[], x: number, y: number, r: number): boolean {
  for (let i = 0; i + 5 < flat.length; i += 3) {
    if (distToSegment(x, y, flat[i], flat[i + 1], flat[i + 3], flat[i + 4]) <= r) return true;
  }
  return flat.length >= 2 && flat.length < 6 && Math.hypot(flat[0] - x, flat[1] - y) <= r;
}
