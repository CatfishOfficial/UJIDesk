/**
 * Window snapping for the existing drag and resize gestures: a pure function
 * from "where the pointer put the window" to "where it should land", plus the
 * guide lines to draw. Window edges win over the grid when both are close,
 * since lining up with a neighbour is the more deliberate move.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A guide line: vertical ('v') at x = at, or horizontal ('h') at y = at, drawn from → to. */
export interface Guide {
  axis: 'v' | 'h';
  at: number;
  from: number;
  to: number;
}

export interface ArrangeSettings {
  grid: boolean;
  gridSize: 12 | 24 | 48;
  windows: boolean;
  guides: boolean;
}

export const DEFAULT_ARRANGE: ArrangeSettings = { grid: false, gridSize: 24, windows: false, guides: false };

/** How close (px) an edge has to come before it snaps. */
export const SNAP_DIST = 8;
/** The spacing kept between windows snapped side by side. */
export const SNAP_GAP = 12;
/** Screen edges snap to this inset. */
const EDGE = 12;

export const snapActive = (a: ArrangeSettings) => a.grid || a.windows || a.guides;

type Side = 'start' | 'end' | 'mid';
interface Target {
  pos: number;
  /** Which of my edges may land on it. */
  side: Side;
  /** The neighbour it came from (for drawing the guide), or null for a screen edge. */
  box: Box | null;
}

/** Edge targets along one axis. `along` picks x (columns) or y (rows). */
function targets(others: Box[], along: 'x' | 'y', me: Box, view: { w: number; h: number }): Target[] {
  const out: Target[] = [];
  for (const o of others) {
    const [s, len, cs, clen] = along === 'x' ? [o.x, o.w, o.y, o.h] : [o.y, o.h, o.x, o.w];
    const [ms, mlen] = along === 'x' ? [me.y, me.h] : [me.x, me.w];
    out.push({ pos: s, side: 'start', box: o }, { pos: s + len, side: 'end', box: o }, { pos: s + len / 2, side: 'mid', box: o });
    // Side by side with a consistent gap, only when the two are level enough to be neighbours.
    const level = ms < cs + clen + SNAP_GAP * 2 && cs < ms + mlen + SNAP_GAP * 2;
    if (level) out.push({ pos: s + len + SNAP_GAP, side: 'start', box: o }, { pos: s - SNAP_GAP, side: 'end', box: o });
  }
  const size = along === 'x' ? view.w : view.h;
  out.push({ pos: EDGE, side: 'start', box: null }, { pos: size - EDGE, side: 'end', box: null });
  return out;
}

interface AxisHit {
  delta: number;
  target: Target;
  edge: number;
}

/** The closest target any of my given edges can reach within `dist`. */
function nearest(edges: { side: Side; pos: number }[], ts: Target[], dist: number): AxisHit | null {
  let best: AxisHit | null = null;
  for (const e of edges) {
    for (const t of ts) {
      if (t.side !== e.side) continue;
      const d = t.pos - e.pos;
      if (Math.abs(d) <= dist && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, target: t, edge: t.pos };
    }
  }
  return best;
}

function guideFor(hit: AxisHit, along: 'x' | 'y', me: Box, view: { w: number; h: number }): Guide {
  const o = hit.target.box;
  const [ms, mlen] = along === 'x' ? [me.y, me.h] : [me.x, me.w];
  const [os, olen] = o ? (along === 'x' ? [o.y, o.h] : [o.x, o.w]) : [0, along === 'x' ? view.h : view.w];
  return { axis: along === 'x' ? 'v' : 'h', at: hit.edge, from: Math.min(ms, os) - 6, to: Math.max(ms + mlen, os + olen) + 6 };
}

const roundTo = (v: number, g: number) => Math.round(v / g) * g;

export interface SnapResult {
  box: Box;
  guides: Guide[];
}

/** Moving: the whole box shifts so its nearest edge lands on a neighbour, a screen edge, or the grid. */
export function snapMove(raw: Box, others: Box[], a: ArrangeSettings, view: { w: number; h: number }): SnapResult {
  const box = { ...raw };
  const guides: Guide[] = [];
  for (const along of ['x', 'y'] as const) {
    const [p, len] = along === 'x' ? [box.x, box.w] : [box.y, box.h];
    const edges = [
      { side: 'start' as const, pos: p },
      { side: 'end' as const, pos: p + len },
      { side: 'mid' as const, pos: p + len / 2 },
    ];
    const ts = targets(others, along, box, view);
    const hit = a.windows ? nearest(edges, ts, SNAP_DIST) : null;
    if (hit) {
      if (along === 'x') box.x += hit.delta;
      else box.y += hit.delta;
    } else if (a.grid) {
      if (along === 'x') box.x = roundTo(box.x, a.gridSize);
      else box.y = roundTo(box.y, a.gridSize);
    }
    if (a.guides) {
      // Draw what it lines up with now: the snap, or an exact alignment found on its own.
      const p2 = along === 'x' ? box.x : box.y;
      const exact = hit ?? nearest(
        [
          { side: 'start', pos: p2 },
          { side: 'end', pos: p2 + len },
          { side: 'mid', pos: p2 + len / 2 },
        ],
        ts.filter((t) => t.box),
        0.5,
      );
      if (exact && exact.target.box) guides.push(guideFor(exact, along, box, view));
    }
  }
  return { box, guides };
}

/**
 * Resizing: only the edges being dragged move ('n', 'e', 'sw', …). They snap to
 * a neighbour's matching edge, the gap beside it, a screen edge, or the grid,
 * never below the window's minimum size.
 */
export function snapResize(raw: Box, dir: string, others: Box[], a: ArrangeSettings, view: { w: number; h: number }, min: { w: number; h: number }): SnapResult {
  const box = { ...raw };
  const guides: Guide[] = [];
  const axes: { along: 'x' | 'y'; side: 'start' | 'end' }[] = [];
  if (dir.includes('w')) axes.push({ along: 'x', side: 'start' });
  if (dir.includes('e')) axes.push({ along: 'x', side: 'end' });
  if (dir.includes('n')) axes.push({ along: 'y', side: 'start' });
  if (dir.includes('s')) axes.push({ along: 'y', side: 'end' });
  for (const { along, side } of axes) {
    const [p, len] = along === 'x' ? [box.x, box.w] : [box.y, box.h];
    const pos = side === 'start' ? p : p + len;
    const ts = targets(others, along, box, view);
    const hit = a.windows ? nearest([{ side, pos }], ts, SNAP_DIST) : null;
    let next = pos;
    if (hit) next = hit.edge;
    else if (a.grid) next = roundTo(pos, a.gridSize);
    const minLen = along === 'x' ? min.w : min.h;
    if (side === 'start') {
      const end = p + len;
      if (end - next >= minLen) {
        if (along === 'x') {
          box.x = next;
          box.w = end - next;
        } else {
          box.y = next;
          box.h = end - next;
        }
      }
    } else if (next - p >= minLen) {
      if (along === 'x') box.w = next - p;
      else box.h = next - p;
    }
    if (a.guides) {
      const exact = hit ?? nearest([{ side, pos: side === 'start' ? (along === 'x' ? box.x : box.y) : along === 'x' ? box.x + box.w : box.y + box.h }], ts.filter((t) => t.box), 0.5);
      if (exact && exact.target.box) guides.push(guideFor(exact, along, box, view));
    }
  }
  return { box, guides };
}

/** Keyboard nudges with the grid on: move a whole grid step and land on the grid. */
export function gridStep(pos: number, dir: -1 | 1, g: number): number {
  const snapped = roundTo(pos, g);
  return snapped !== pos && Math.sign(snapped - pos) === dir ? snapped : snapped + dir * g;
}
