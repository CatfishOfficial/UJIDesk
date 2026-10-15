import type { Win } from './types';
import { currentScale } from './scale';

/** Space kept clear at the bottom edge when placing windows. */
export const DOCK_SPACE = 20;
const MARGIN = 20;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The viewport in logical pixels — real pixels divided by the Display size
 * scale (see ./scale). Pass `scale` when the caller already has it (e.g. mid
 * pointer-drag), so this doesn't re-read the --ui-scale custom property.
 */
export function viewport(scale = currentScale()): { vw: number; vh: number } {
  if (typeof window === 'undefined') return { vw: 1280, vh: 800 };
  return { vw: window.innerWidth / scale, vh: window.innerHeight / scale };
}

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Fits a size into the current viewport, leaving a margin at the bottom. */
export function fitSize(w: number, h: number): { w: number; h: number } {
  const { vw, vh } = viewport();
  return {
    w: Math.min(w, vw - MARGIN * 2),
    h: Math.min(h, vh - MARGIN - DOCK_SPACE),
  };
}

/**
 * Finds a spot for a new window. When `near` is given, tries beside it first so
 * helpers (a calculator for a lesson, a graph for a result) don't cover the work.
 * Otherwise scans for the least-covered spot, preferring the upper-left reading area.
 */
export function findPlacement(size: { w: number; h: number }, others: Win[], near?: Win, at?: { x: number; y: number }): Rect {
  const { vw, vh } = viewport();
  const maxX = Math.max(MARGIN, vw - size.w - MARGIN);
  const maxY = Math.max(MARGIN, vh - size.h - DOCK_SPACE);
  const clampR = (x: number, y: number): Rect => ({
    x: Math.round(Math.min(Math.max(MARGIN, x), maxX)),
    y: Math.round(Math.min(Math.max(MARGIN, y), maxY)),
    ...size,
  });
  const visible = others.filter((o) => !o.minimized);
  const cost = (r: Rect) => visible.reduce((sum, o) => sum + overlap(r, o), 0);

  if (at) return clampR(at.x - size.w / 2, at.y - 18);

  if (near && !near.minimized) {
    const gap = 16;
    const candidates = [
      { x: near.x + near.w + gap, y: near.y },
      { x: near.x - size.w - gap, y: near.y },
      { x: near.x, y: near.y + near.h + gap },
      { x: near.x + near.w + gap, y: near.y + near.h - size.h },
    ];
    let best: Rect | null = null;
    let bestCost = Infinity;
    for (const c of candidates) {
      const r = clampR(c.x, c.y);
      const k = cost(r) + overlap(r, near) * 4;
      if (k < bestCost) {
        bestCost = k;
        best = r;
      }
    }
    if (best && overlap(best, near) === 0) return best;
  }

  const step = 28;
  let best = clampR(MARGIN + 40, MARGIN + 40);
  let bestCost = Infinity;
  for (let y = MARGIN; y <= maxY; y += step) {
    for (let x = MARGIN; x <= maxX; x += step) {
      const r = { x, y, ...size };
      // Small bias toward the upper-left so placement feels intentional.
      const k = cost(r) + (x + y * 1.4) * 0.5;
      if (k < bestCost) {
        bestCost = k;
        best = r;
      }
    }
  }
  // Avoid landing exactly on top of another window's corner.
  if (visible.some((o) => o.x === best.x && o.y === best.y)) return clampR(best.x + 24, best.y + 24);
  return best;
}

/** Keeps at least the title bar reachable after the viewport shrinks. */
export function clampToViewport(win: Win): Pick<Win, 'x' | 'y' | 'w' | 'h'> {
  const { vw, vh } = viewport();
  const w = Math.min(win.w, Math.max(240, vw - 16));
  const h = Math.min(win.h, Math.max(160, vh - 16));
  const x = Math.min(Math.max(win.x, -w + 96), vw - 96);
  const y = Math.min(Math.max(win.y, 0), vh - DOCK_SPACE - 8);
  return { x: Math.round(x), y: Math.round(y), w, h };
}

/** Rough footprint of a placed sticker (64px art plus its edge), from its centre. */
const STICKER_RADIUS = 40;

function covers(r: Rect, x: number, y: number, pad: number): boolean {
  return x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
}

/**
 * Finds an open patch of whiteboard for a sticker: not under any window or
 * desk object (stickers sit beneath them), not on the backpack button, and
 * not crowding other stickers. Picks the open spot nearest `prefer`.
 * Returns `prefer` unchanged if the desk is completely covered.
 */
export function findStickerSpot(
  blockers: Rect[],
  stickers: { x: number; y: number }[],
  prefer: { x: number; y: number },
  vw = viewport().vw,
  vh = viewport().vh,
): { x: number; y: number } {
  const step = 16;
  const margin = STICKER_RADIUS + 8;
  let best: { x: number; y: number } | null = null;
  let bestScore = Infinity;
  for (let y = margin; y <= vh - margin; y += step) {
    for (let x = margin; x <= vw - margin; x += step) {
      if (blockers.some((r) => covers(r, x, y, STICKER_RADIUS))) continue;
      const nearest = stickers.reduce((d, s) => Math.min(d, Math.hypot(s.x - x, s.y - y)), Infinity);
      // Overlapping another sticker is allowed (people collage), but an empty patch is nicer.
      const crowd = nearest < STICKER_RADIUS * 1.6 ? 400 : 0;
      const score = Math.hypot(x - prefer.x, y - prefer.y) + crowd;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best ?? prefer;
}
