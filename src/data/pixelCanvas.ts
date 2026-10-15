/**
 * A small drawing surface for pixel scenes and sprites. Colors are palette
 * keys (single characters); "." is transparent. Call `outline()` to wrap a
 * sprite's silhouette in the house dark outline, like the fish.
 */
export class PixelCanvas {
  g: string[][];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.g = Array.from({ length: h }, () => Array(w).fill('.'));
  }
  px(x: number, y: number, c: string) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.g[y][x] = c;
  }
  get(x: number, y: number) {
    return this.g[y]?.[x] ?? '.';
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: string) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.px(x, y, c);
  }
  hline(x0: number, x1: number, y: number, c: string) {
    this.rect(x0, y, x1, y, c);
  }
  vline(x: number, y0: number, y1: number, c: string) {
    this.rect(x, y0, x, y1, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  disc(cx: number, cy: number, r: number, c: string | ((x: number, y: number) => string | null)) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
          const col = typeof c === 'string' ? c : c(x, y);
          if (col) this.px(x, y, col);
        }
  }
  stamp(rows: string[], ox: number, oy: number, recolor?: string) {
    rows.forEach((row, y) => [...row].forEach((c, x) => c !== '.' && this.px(ox + x, oy + y, recolor ?? c)));
  }
  /** Writes text in the 3×5 pixel font. Returns the width used. */
  text(s: string, x: number, y: number, c: string): number {
    let cx = x;
    for (const ch of s.toUpperCase()) {
      const glyph = FONT[ch];
      if (!glyph) {
        cx += 2;
        continue;
      }
      this.stamp(glyph, cx, y, c);
      cx += glyph[0].length + 1;
    }
    return cx - x - 1;
  }
  outline(c = 'K') {
    const filled = (x: number, y: number) => {
      const v = this.get(x, y);
      return v !== '.' && v !== '#';
    };
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) this.g[y][x] = '#';
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.g[y][x] === '#') this.g[y][x] = c;
  }
  rows() {
    return this.g.map((r) => r.join(''));
  }
}

export function textWidth(s: string): number {
  let w = 0;
  for (const ch of s.toUpperCase()) w += (FONT[ch]?.[0].length ?? 1) + 1;
  return w - 1;
}

const FONT: Record<string, string[]> = {
  A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
  C: ['.XX', 'X..', 'X..', 'X..', '.XX'],
  D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
  E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
  H: ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
  I: ['XXX', '.X.', '.X.', '.X.', 'XXX'],
  K: ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'],
  N: ['X..X', 'XX.X', 'X.XX', 'X..X', 'X..X'],
  O: ['.X.', 'X.X', 'X.X', 'X.X', '.X.'],
  P: ['XX.', 'X.X', 'XX.', 'X..', 'X..'],
  R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'],
  S: ['.XX', 'X..', '.X.', '..X', 'XX.'],
  T: ['XXX', '.X.', '.X.', '.X.', '.X.'],
  '!': ['X', 'X', 'X', '.', 'X'],
  B: ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
  F: ['XXX', 'X..', 'XX.', 'X..', 'X..'],
  G: ['.XX', 'X..', 'X.X', 'X.X', '.XX'],
  J: ['..X', '..X', '..X', 'X.X', '.X.'],
  L: ['X..', 'X..', 'X..', 'X..', 'XXX'],
  M: ['X...X', 'XX.XX', 'X.X.X', 'X...X', 'X...X'],
  U: ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'],
  V: ['X.X', 'X.X', 'X.X', 'X.X', '.X.'],
  W: ['X...X', 'X...X', 'X.X.X', 'XX.XX', 'X...X'],
  Y: ['X.X', 'X.X', '.X.', '.X.', '.X.'],
  '0': ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
  '1': ['.X.', 'XX.', '.X.', '.X.', 'XXX'],
  '2': ['XX.', '..X', '.X.', 'X..', 'XXX'],
  '3': ['XX.', '..X', '.X.', '..X', 'XX.'],
  '4': ['X.X', 'X.X', 'XXX', '..X', '..X'],
  '5': ['XXX', 'X..', 'XX.', '..X', 'XX.'],
  '6': ['.XX', 'X..', 'XXX', 'X.X', 'XXX'],
  '7': ['XXX', '..X', '.X.', '.X.', '.X.'],
  '8': ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'],
  '9': ['XXX', 'X.X', 'XXX', '..X', 'XX.'],
};
