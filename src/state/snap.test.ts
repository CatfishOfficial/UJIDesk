import { describe, expect, it } from 'vitest';
import { DEFAULT_ARRANGE, SNAP_GAP, gridStep, snapMove, snapResize, type ArrangeSettings } from './snap';
import { overlaps, tidyLayout, type TidyItem } from './tidy';

const view = { w: 1400, h: 900 };
const on = (p: Partial<ArrangeSettings>): ArrangeSettings => ({ ...DEFAULT_ARRANGE, ...p });
const other = { x: 400, y: 200, w: 300, h: 400 };

describe('snapping', () => {
  it('does nothing when every option is off (the default)', () => {
    const raw = { x: 103, y: 207, w: 200, h: 150 };
    expect(snapMove(raw, [other], DEFAULT_ARRANGE, view)).toEqual({ box: raw, guides: [] });
  });

  it('snaps to the grid', () => {
    expect(snapMove({ x: 103, y: 217, w: 200, h: 150 }, [], on({ grid: true, gridSize: 24 }), view).box).toMatchObject({ x: 96, y: 216 });
    expect(snapMove({ x: 103, y: 217, w: 200, h: 150 }, [], on({ grid: true, gridSize: 48 }), view).box).toMatchObject({ x: 96, y: 240 });
  });

  it('lines up with a neighbour: same top, and side by side with a steady gap', () => {
    // Dropped just right of the other window, a little lower than its top.
    const r = snapMove({ x: 700 + SNAP_GAP + 5, y: 205, w: 200, h: 150 }, [other], on({ windows: true, guides: true }), view);
    expect(r.box).toMatchObject({ x: 700 + SNAP_GAP, y: 200 });
    expect(r.guides.map((g) => g.axis).sort()).toEqual(['h', 'v']);
    // Too far away: stays where it was put.
    expect(snapMove({ x: 760, y: 260, w: 200, h: 150 }, [other], on({ windows: true }), view).box).toMatchObject({ x: 760, y: 260 });
  });

  it('prefers a neighbour over the grid when both are close', () => {
    const r = snapMove({ x: 404, y: 30, w: 200, h: 150 }, [other], on({ windows: true, grid: true, gridSize: 24 }), view);
    expect(r.box.x).toBe(400);
  });

  it('guides alone never move anything, but show exact alignments', () => {
    const r = snapMove({ x: 400, y: 640, w: 200, h: 150 }, [other], on({ guides: true }), view);
    expect(r.box).toMatchObject({ x: 400, y: 640 });
    expect(r.guides).toHaveLength(1);
    expect(r.guides[0]).toMatchObject({ axis: 'v', at: 400 });
  });

  it('resizing snaps only the dragged edge, never below the minimum', () => {
    const r = snapResize({ x: 100, y: 200, w: 296, h: 300 }, 'e', [other], on({ windows: true }), view, { w: 240, h: 200 });
    expect(r.box).toMatchObject({ x: 100, w: 400 - SNAP_GAP - 100 });
    const g = snapResize({ x: 100, y: 200, w: 250, h: 300 }, 'se', [], on({ grid: true, gridSize: 48 }), view, { w: 240, h: 200 });
    // 350 rounds to 336, which would be under the 240 minimum width, so the width stays put.
    expect(g.box).toMatchObject({ w: 250, h: 280 });
  });

  it('keyboard nudges move a whole grid step and land on the grid', () => {
    expect(gridStep(100, 1, 24)).toBe(120);
    expect(gridStep(96, 1, 24)).toBe(120);
    expect(gridStep(96, -1, 24)).toBe(72);
  });
});

describe('tidy up', () => {
  const mk = (id: string, x: number, y: number, w: number, h: number, resizable = true): TidyItem => ({ id, x, y, w, h, min: { w: 240, h: 200 }, resizable });
  const area = { x0: 16, y0: 16, x1: 1384, y1: 860 };

  it('lays windows out with no overlaps, in reading order, inside the screen', () => {
    const items = [mk('a', 500, 300, 440, 560), mk('b', 30, 40, 300, 460), mk('c', 520, 60, 480, 440), mk('d', 600, 500, 380, 360)];
    const out = tidyLayout(items, area);
    const boxes = Object.values(out);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j])).toBe(false);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(area.x0);
      expect(b.x + b.w).toBeLessThanOrEqual(area.x1);
      expect(b.y + b.h).toBeLessThanOrEqual(area.y1);
    }
    expect(out.b.x).toBeLessThan(out.c.x); // b was top-left, so it stays first
  });

  it('shrinks windows together when they would not fit, and lines them up on the grid', () => {
    const many = Array.from({ length: 8 }, (_, i) => mk(String(i), i * 50, i * 40, 460, 600));
    const out = tidyLayout(many, area, { gap: 24, align: 24 });
    const boxes = Object.values(out);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j])).toBe(false);
    expect(boxes.every((b) => b.x % 24 === 0 && b.y % 24 === 0)).toBe(true);
    expect(boxes.every((b) => b.h < 600 && b.h >= 200)).toBe(true);
  });
});
