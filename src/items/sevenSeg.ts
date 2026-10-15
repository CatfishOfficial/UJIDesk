import type { PixelCanvas } from '../data/pixelCanvas';

/** Which of the seven segments (a–g) light up for each digit. */
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  ' ': '',
};

/**
 * Draws one seven-segment digit. Unlit segments are drawn in `off` (if given),
 * which is what makes an old LED clock look like an old LED clock.
 */
export function drawDigit(c: PixelCanvas, ch: string, x: number, y: number, w: number, h: number, t: number, on: string, off?: string) {
  const lit = SEGMENTS[ch] ?? '';
  const mid = Math.floor((h - t) / 2);
  const seg: Record<string, [number, number, number, number]> = {
    a: [x + t, y, x + w - 1 - t, y + t - 1],
    g: [x + t, y + mid, x + w - 1 - t, y + mid + t - 1],
    d: [x + t, y + h - t, x + w - 1 - t, y + h - 1],
    f: [x, y + t, x + t - 1, y + mid - 1],
    b: [x + w - t, y + t, x + w - 1, y + mid - 1],
    e: [x, y + mid + t, x + t - 1, y + h - t - 1],
    c: [x + w - t, y + mid + t, x + w - 1, y + h - t - 1],
  };
  for (const [name, [x0, y0, x1, y1]] of Object.entries(seg)) {
    const color = lit.includes(name) ? on : off;
    if (color) c.rect(x0, y0, x1, y1, color);
  }
}
