import { describe, expect, it } from 'vitest';
import { findStickerSpot } from './placement';

const inside = (r: { x: number; y: number; w: number; h: number }, p: { x: number; y: number }, pad = 40) =>
  p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;

describe('sticker placement', () => {
  it('never lands under a window, even when the preferred spot is covered', () => {
    const blockers = [
      { x: 0, y: 0, w: 900, h: 500 },
      { x: 300, y: 500, w: 400, h: 300 },
    ];
    const p = findStickerSpot(blockers, [], { x: 450, y: 250 }, 1200, 800);
    for (const b of blockers) expect(inside(b, p)).toBe(false);
  });

  it('stays near where it was aimed when that spot is open', () => {
    const p = findStickerSpot([], [], { x: 600, y: 300 }, 1200, 800);
    expect(Math.hypot(p.x - 600, p.y - 300)).toBeLessThan(16);
  });

  it('prefers not to stack exactly on another sticker', () => {
    const p = findStickerSpot([], [{ x: 600, y: 300 }], { x: 600, y: 300 }, 1200, 800);
    expect(Math.hypot(p.x - 600, p.y - 300)).toBeGreaterThan(50);
  });

  it('falls back to the aimed spot if the whole desk is covered', () => {
    expect(findStickerSpot([{ x: 0, y: 0, w: 1200, h: 800 }], [], { x: 10, y: 10 }, 1200, 800)).toEqual({ x: 10, y: 10 });
  });
});
