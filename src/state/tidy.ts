import type { Box } from './snap';

/**
 * "Tidy up": lays the open windows out in rows, in roughly the reading order
 * they already had, with an even gap and no overlaps. Sizes are kept when they
 * fit; if the screen is too full, resizable windows shrink together (never
 * below their minimum) until they do.
 */
export interface TidyItem extends Box {
  id: string;
  min: { w: number; h: number };
  resizable: boolean;
}

export interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Reading order: top to bottom in loose bands, then left to right. */
function readingOrder(items: TidyItem[]): TidyItem[] {
  const band = 80;
  return [...items].sort((a, b) => Math.floor(a.y / band) - Math.floor(b.y / band) || a.x - b.x);
}

function pack(items: TidyItem[], area: Area, gap: number, align: number): { boxes: Record<string, Box>; bottom: number } {
  const up = (v: number) => (align > 1 ? Math.ceil(v / align) * align : v);
  const boxes: Record<string, Box> = {};
  let x = up(area.x0);
  let y = up(area.y0);
  let rowH = 0;
  for (const it of items) {
    if (x + it.w > area.x1 && x > up(area.x0)) {
      x = up(area.x0);
      y = up(y + rowH + gap);
      rowH = 0;
    }
    boxes[it.id] = { x, y, w: it.w, h: it.h };
    x = up(x + it.w + gap);
    rowH = Math.max(rowH, it.h);
  }
  return { boxes, bottom: y + rowH };
}

export function tidyLayout(items: TidyItem[], area: Area, opts: { gap?: number; align?: number } = {}): Record<string, Box> {
  const gap = opts.gap ?? 16;
  const align = opts.align ?? 1;
  const ordered = readingOrder(items);
  let last: Record<string, Box> = {};
  for (let s = 1; s >= 0.45; s -= 0.05) {
    const sized = ordered.map((it) =>
      it.resizable
        ? { ...it, w: Math.max(it.min.w, Math.min(it.w, Math.round(it.w * s))), h: Math.max(it.min.h, Math.min(it.h, Math.round(it.h * s))) }
        : it,
    );
    // Nothing may be wider than the area itself.
    for (const it of sized) if (it.resizable) it.w = Math.max(it.min.w, Math.min(it.w, area.x1 - area.x0));
    const { boxes, bottom } = pack(sized, area, gap, align);
    last = boxes;
    if (bottom <= area.y1) return boxes;
  }
  // Still too many for one screen: keep the layout, but pull the overflow back on screen.
  for (const id of Object.keys(last)) {
    const b = last[id];
    if (b.y + b.h > area.y1) last[id] = { ...b, y: Math.max(area.y0, area.y1 - b.h) };
  }
  return last;
}

export const overlaps = (a: Box, b: Box) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
