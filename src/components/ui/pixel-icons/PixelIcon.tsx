import { useMemo } from 'react';
import { pixelRects } from '../../../data/pixel';

/**
 * Pixel-art icon set in the same style as the fish: 16×16 sprites, a dark
 * 1px outline, flat colors with a light and a dark shade. Each icon is drawn
 * with a tiny canvas kit below, then outlined automatically.
 * Placeholder art for development; swap any icon by replacing its draw fn.
 */

const PALETTE: Record<string, string> = {
  K: '#2a2932', // outline
  W: '#ffffff',
  w: '#f7f5ee', // paper
  s: '#cfd5de', // paper shade
  x: '#9aa6b8', // pencil line on paper
  h: '#c6d9f2', // grid line
  b: '#5b8fe0',
  B: '#2f5fb8',
  l: '#a9c8f5',
  r: '#e0553a',
  R: '#a83220',
  p: '#f6a48e',
  y: '#f6cf4a',
  Y: '#c9961a',
  u: '#fff2b0',
  g: '#5cb84a',
  G: '#2f7f25',
  e: '#bfe8a8',
  o: '#f39a3c',
  O: '#bf6015',
  m: '#c9ced6',
  M: '#8d949e',
  n: '#eef0f3',
  v: '#8f94ea',
  V: '#4f55b8',
  i: '#d4d6fb',
  t: '#c08548',
  T: '#7d4a1c',
  c: '#ead0a0',
  d: '#5a606b',
  D: '#33383f',
  L: '#c6d7b0',
  k: '#4f5d42',
  P: '#f4a3b5',
  a: '#dff2fc',
  A: '#86c1ea',
  q: '#4a8fcc',
};

type Ramp = [light: string, mid: string, dark: string];
const BLUE: Ramp = ['l', 'b', 'B'];
const RED: Ramp = ['p', 'r', 'R'];
const GREEN: Ramp = ['e', 'g', 'G'];
const YELLOW: Ramp = ['u', 'y', 'Y'];
const METAL: Ramp = ['n', 'm', 'M'];
const PURPLE: Ramp = ['i', 'v', 'V'];
const DARK: Ramp = ['M', 'd', 'D'];
const WOOD: Ramp = ['c', 't', 'T'];

class Canvas {
  g: string[][] = Array.from({ length: 16 }, () => Array(16).fill('.'));
  px(x: number, y: number, c: string) {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) this.g[y][x] = c;
  }
  get(x: number, y: number) {
    return this.g[y]?.[x] ?? '.';
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: string) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.px(x, y, c);
  }
  /** Filled box lit from the top-left. */
  box(x0: number, y0: number, x1: number, y1: number, [l, m, d]: Ramp) {
    this.rect(x0, y0, x1, y1, m);
    for (let x = x0; x <= x1; x++) {
      this.px(x, y0, l);
      this.px(x, y1, d);
    }
    for (let y = y0; y < y1; y++) {
      this.px(x0, y, l);
      this.px(x1, y, d);
    }
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
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
          const col = typeof c === 'string' ? c : c(x, y);
          if (col) this.px(x, y, col);
        }
      }
  }
  /** A shaded 3×3 ball, like the fish eye but chunkier. */
  ball(cx: number, cy: number, [l, m, d]: Ramp) {
    this.rect(cx - 1, cy - 1, cx + 1, cy + 1, m);
    this.px(cx - 1, cy - 1, 'W');
    this.px(cx, cy - 1, l);
    this.px(cx - 1, cy, l);
    this.px(cx + 1, cy + 1, d);
    this.px(cx + 1, cy, d);
    this.px(cx, cy + 1, d);
    for (const [x, y] of [[cx - 1, cy - 2], [cx, cy - 2], [cx + 1, cy - 2], [cx - 1, cy + 2], [cx, cy + 2], [cx + 1, cy + 2], [cx - 2, cy - 1], [cx - 2, cy], [cx - 2, cy + 1], [cx + 2, cy - 1], [cx + 2, cy], [cx + 2, cy + 1]])
      this.px(x, y, 'K');
  }
  stamp(rows: string[], ox: number, oy: number) {
    rows.forEach((row, y) => [...row].forEach((c, x) => c !== '.' && this.px(ox + x, oy + y, c)));
  }
  clear(...pts: [number, number][]) {
    for (const [x, y] of pts) this.px(x, y, '.');
  }
  /** Wraps the whole silhouette in the dark outline. */
  outline() {
    const filled = (x: number, y: number) => {
      const c = this.get(x, y);
      return c !== '.' && c !== '#';
    };
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) this.g[y][x] = '#';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (this.g[y][x] === '#') this.g[y][x] = 'K';
  }
  rows() {
    return this.g.map((r) => r.join(''));
  }
}

/* ── Shared bases ─────────────────────────────── */

function paper(c: Canvas) {
  c.rect(3, 1, 12, 14, 'w');
  c.vline(12, 2, 14, 's');
  c.hline(3, 12, 14, 's');
  c.clear([12, 1], [11, 1], [12, 2]);
  c.px(11, 2, 's');
}

function gridPaper(c: Canvas) {
  c.rect(2, 2, 13, 13, 'w');
  for (const v of [5, 8, 11]) {
    c.vline(v, 2, 13, 'h');
    c.hline(2, 13, v, 'h');
  }
  c.vline(4, 2, 13, 'd');
  c.hline(2, 13, 11, 'd');
}

function calcBody(c: Canvas, body: Ramp, keyColor: string) {
  c.box(3, 1, 12, 14, body);
  c.rect(4, 2, 11, 5, 'L');
  c.hline(4, 11, 2, 'k');
  c.hline(8, 10, 4, 'k');
  for (const y of [7, 9, 11, 13]) {
    for (const x of [5, 7, 9]) c.px(x, y, keyColor);
    c.px(11, y, 'o');
  }
}

/** Diagonal band from bottom-left to top-right; `paint` picks a color per (along, across). */
function band(c: Canvas, halfWidth: number, paint: (along: number, across: number) => string | null) {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const across = x + y - 15;
      const along = x - y;
      if (Math.abs(across) <= halfWidth && Math.abs(along) <= 12) {
        const col = paint(along, across);
        if (col) c.px(x, y, col);
      }
    }
}

const STAR = ['...y...', '..yuy..', 'yyyuyyy', '.yyyyy.', '..yyy..', '.yy.yy.', '.Y...Y.'];

/* ── Icons ────────────────────────────────────── */

const DRAW = {
  menu: (c: Canvas) => {
    c.box(1, 1, 14, 14, PURPLE);
    c.clear([1, 1], [14, 1], [1, 14], [14, 14]);
    c.vline(4, 5, 9, 'W');
    c.vline(7, 5, 9, 'W');
    c.hline(5, 6, 10, 'W');
    c.px(11, 4, 'W');
    c.vline(11, 6, 11, 'W');
    c.px(10, 12, 'W');
    c.px(9, 11, 'W');
  },
  standardToSlope: (c: Canvas) => {
    paper(c);
    c.hline(5, 9, 3, 'x');
    c.hline(5, 7, 5, 'x');
    for (const [x, y] of [[5, 7], [7, 7], [5, 8], [7, 8], [6, 9], [6, 10], [5, 11]]) c.px(x, y, 'B');
    c.hline(8, 9, 8, 'B');
    c.hline(8, 9, 10, 'B');
    c.line(8, 13, 11, 9, 'r');
    c.line(9, 13, 11, 10, 'R');
  },
  slopeFromPoints: (c: Canvas) => {
    c.hline(4, 12, 12, 'o');
    c.vline(12, 4, 12, 'o');
    c.line(4, 11, 11, 4, 'b');
    c.line(5, 11, 11, 5, 'B');
    c.ball(3, 12, RED);
    c.ball(12, 3, GREEN);
  },
  calculator: (c: Canvas) => calcBody(c, METAL, 'b'),
  graph: (c: Canvas) => {
    gridPaper(c);
    for (const [x, y] of [[5, 10], [6, 10], [7, 9], [8, 8], [9, 7], [9, 6], [10, 5], [11, 4], [12, 3]]) c.px(x, y, 'r');
  },
  scratchpad: (c: Canvas) => {
    c.rect(3, 2, 12, 14, 'w');
    c.vline(12, 2, 14, 's');
    c.hline(3, 12, 14, 's');
    for (const y of [5, 7, 9, 11, 13]) c.hline(4, 11, y, 'h');
    c.vline(5, 3, 13, 'p');
    for (const x of [4, 6, 8, 10]) {
      c.px(x, 1, 'M');
      c.px(x, 2, 'm');
    }
  },
  sticky: (c: Canvas) => {
    c.rect(2, 2, 13, 13, 'y');
    c.hline(2, 13, 2, 'u');
    c.clear([13, 13], [12, 13], [13, 12]);
    c.px(12, 12, 'Y');
    c.hline(4, 10, 6, 'Y');
    c.hline(4, 11, 8, 'Y');
    c.hline(4, 8, 10, 'Y');
  },
  reference: (c: Canvas) => {
    c.box(5, 1, 13, 13, BLUE);
    c.rect(2, 1, 4, 13, 'B');
    c.vline(3, 2, 12, 'b');
    c.hline(5, 12, 14, 'w');
    c.rect(7, 4, 11, 6, 'y');
    c.hline(7, 11, 6, 'Y');
  },
  timer: (c: Canvas) => {
    c.rect(6, 0, 9, 1, 'm');
    c.px(13, 3, 'M');
    c.disc(7.5, 8.5, 6.3, (x, y) => (x + y < 13 ? 'p' : x + y > 19 ? 'R' : 'r'));
    c.disc(7.5, 8.5, 4.3, 'w');
    c.vline(8, 5, 8, 'D');
    c.hline(9, 10, 9, 'r');
    c.px(8, 9, 'D');
  },
  ruler: (c: Canvas) => {
    c.box(1, 5, 14, 10, YELLOW);
    for (let x = 2; x <= 13; x++) {
      const len = x % 4 === 2 ? 3 : x % 2 === 0 ? 2 : 0;
      if (len) c.vline(x, 6, 5 + len, 'Y');
    }
  },
  fishbowl: (c: Canvas) => {
    c.disc(7.5, 9, 6.4, (_x, y) => (y < 7 ? 'a' : y < 11 ? 'A' : 'q'));
    c.rect(4, 2, 11, 3, 'a');
    c.hline(4, 11, 2, 'W');
    c.hline(5, 8, 9, 'o');
    c.px(9, 9, 'o');
    c.px(4, 8, 'O');
    c.px(4, 10, 'O');
    c.px(8, 9, 'K');
    c.vline(3, 7, 10, 'W');
  },
  challenge: (c: Canvas) => {
    c.box(4, 1, 11, 7, YELLOW);
    c.hline(5, 10, 8, 'y');
    c.hline(6, 9, 9, 'Y');
    c.rect(7, 10, 8, 11, 'Y');
    c.box(4, 12, 11, 14, WOOD);
    c.vline(2, 2, 4, 'Y');
    c.px(3, 5, 'Y');
    c.vline(13, 2, 4, 'Y');
    c.px(12, 5, 'Y');
    c.vline(5, 2, 4, 'W');
  },
  pen: (c: Canvas) => {
    band(c, 1, (along, across) => {
      if (along <= -10) return across === 0 ? 'D' : null;
      if (along <= -7) return across === -1 ? 'c' : across === 1 ? 'T' : 't';
      if (along <= 6) return across === -1 ? 'u' : across === 1 ? 'Y' : 'y';
      if (along <= 8) return across === -1 ? 'n' : across === 1 ? 'M' : 'm';
      if (along <= 11) return 'P';
      return null;
    });
  },
  stickers: (c: Canvas) => {
    c.rect(2, 2, 13, 13, 'w');
    c.hline(2, 13, 13, 's');
    c.vline(13, 2, 13, 's');
    c.stamp(STAR, 4, 4);
    c.clear([13, 13], [12, 13], [13, 12]);
    c.px(12, 12, 's');
    c.px(11, 12, 'm');
  },
  backpack: (c: Canvas) => {
    c.hline(6, 9, 1, 'D');
    c.vline(5, 2, 3, 'D');
    c.vline(10, 2, 3, 'D');
    c.box(3, 4, 12, 14, BLUE);
    c.rect(4, 5, 11, 7, 'B');
    c.hline(4, 11, 5, 'b');
    c.clear([3, 4], [12, 4], [3, 14], [12, 14]);
    c.rect(7, 6, 8, 7, 'y');
    c.box(5, 9, 10, 13, ['o', 'o', 'O']);
    c.hline(6, 9, 10, 'u');
    c.vline(4, 8, 12, 'l');
  },

  clock: (c: Canvas) => {
    c.box(1, 4, 14, 12, ['d', 'D', 'D']);
    c.rect(1, 4, 14, 5, 't');
    c.hline(2, 13, 4, 'c');
    c.rect(3, 7, 12, 10, 'D');
    // tiny red "12:00"
    for (const [x, y] of [[4, 7], [4, 8], [4, 9], [4, 10], [6, 7], [7, 7], [7, 8], [6, 9], [6, 10], [7, 10], [9, 7], [10, 7], [9, 10], [10, 10], [9, 8], [9, 9], [11, 7], [11, 8], [11, 9], [11, 10]]) c.px(x, y, 'r');
    c.px(8, 8, 'r');
    c.px(8, 10, 'r');
    c.hline(3, 4, 13, 'D');
    c.hline(11, 12, 13, 'D');
  },

  periodic: (c: Canvas) => {
    // the table's silhouette: tall s-block, d-block in the middle, p-block on the right, f-block below
    c.rect(1, 1, 3, 3, 'r');
    c.rect(12, 1, 14, 3, 'v');
    c.rect(1, 4, 3, 10, 'o');
    c.rect(9, 4, 14, 10, 'b');
    c.rect(4, 6, 8, 10, 'y');
    c.rect(3, 12, 12, 14, 'P');
    for (const y of [3, 6, 8]) c.hline(1, 14, y, c.get(1, y) === '.' ? '.' : 'K');
    for (const x of [3, 8, 11]) c.vline(x, 1, 10, 'K');
    c.clear([3, 1], [3, 2], [11, 1], [11, 2], [11, 3], [8, 4], [8, 5], [3, 11]);
    c.hline(3, 12, 13, 'K');
    c.vline(6, 12, 14, 'K');
    c.vline(9, 12, 14, 'K');
  },
  atom: (c: Canvas) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const h = ((x - 7.5) / 6.6) ** 2 + ((y - 7.5) / 2.6) ** 2;
        const v = ((x - 7.5) / 2.6) ** 2 + ((y - 7.5) / 6.6) ** 2;
        if (Math.abs(h - 1) < 0.28 || Math.abs(v - 1) < 0.28) c.px(x, y, 'b');
      }
    c.rect(6, 6, 9, 9, 'r');
    c.px(7, 6, 'b');
    c.px(6, 8, 'b');
    c.px(9, 7, 'b');
    c.px(8, 9, 'b');
    c.px(6, 6, 'p');
    c.px(14, 7, 'y');
    c.px(14, 8, 'y');
  },

  /* Trip on da Ship */
  boat: (c: Canvas) => {
    c.vline(8, 1, 6, 'D');
    c.rect(9, 1, 11, 3, 'r');
    c.px(9, 1, 'p');
    c.box(4, 5, 7, 8, METAL);
    c.px(5, 6, 'l');
    for (let y = 9; y <= 12; y++) c.hline(1 + (y - 9), 14 - (y - 9), y, y === 9 ? 'w' : y === 12 ? 'R' : 'r');
    c.hline(2, 4, 10, 'w');
    c.hline(1, 14, 13, 'b');
    c.hline(1, 14, 14, 'l');
    c.px(3, 13, 'l');
    c.px(10, 13, 'l');
  },
  token: (c: Canvas) => {
    c.disc(7.5, 7.5, 6.6, (x, y) => (x + y < 11 ? 'u' : x + y > 19 ? 'Y' : 'y'));
    c.disc(7.5, 7.5, 4.6, (x, y) => ((x - 7.5) ** 2 + (y - 7.5) ** 2 > 3.4 ** 2 ? 'Y' : null));
    c.vline(6, 5, 9, 'Y');
    c.vline(9, 5, 9, 'Y');
    c.hline(7, 8, 10, 'Y');
    c.px(4, 4, 'W');
    c.px(3, 5, 'W');
  },
  ticket: (c: Canvas) => {
    c.box(1, 4, 14, 11, YELLOW);
    c.clear([1, 7], [1, 8], [14, 7], [14, 8]);
    for (let y = 5; y <= 10; y += 2) c.px(10, y, 'Y');
    c.hline(3, 8, 6, 'Y');
    c.hline(3, 6, 8, 'Y');
  },
  sun: (c: Canvas) => {
    c.disc(7.5, 7.5, 3.6, (x, y) => (x + y < 13 ? 'u' : 'y'));
    for (const [x, y] of [[7, 1], [8, 1], [7, 14], [8, 14], [1, 7], [1, 8], [14, 7], [14, 8], [3, 3], [12, 3], [3, 12], [12, 12]]) c.px(x, y, 'o');
  },
  moon: (c: Canvas) => {
    c.disc(7.5, 7.5, 5.6, (x, y) => (x + y < 12 ? 'n' : 'm'));
    c.disc(10.5, 5.5, 4.6, (x, y) => (c.get(x, y) !== '.' ? '.' : null));
    c.px(4, 6, 'M');
    c.px(5, 10, 'M');
  },

  /* planned tools */
  pointSlope: (c: Canvas) => {
    gridPaper(c);
    c.line(3, 13, 13, 3, 'b');
    c.ball(8, 8, RED);
  },
  systems: (c: Canvas) => {
    gridPaper(c);
    c.line(3, 12, 13, 3, 'b');
    c.line(3, 3, 13, 12, 'o');
    c.ball(8, 8, GREEN);
  },
  quadratic: (c: Canvas) => {
    gridPaper(c);
    const f = (x: number) => Math.round(12 - 0.42 * (x - 7.5) ** 2);
    for (let x = 3; x < 12; x++) c.line(x, f(x), x + 1, f(x + 1), 'V');
    for (let x = 3; x < 12; x++) c.line(x, f(x) - 1, x + 1, f(x + 1) - 1, 'v');
  },
  factoring: (c: Canvas) => {
    paper(c);
    for (const ox of [3, 8]) {
      c.px(ox + 1, 5, 'B');
      c.vline(ox, 6, 9, 'B');
      c.px(ox + 1, 10, 'B');
      c.px(ox + 2, 5, 'B');
      c.vline(ox + 3, 6, 9, 'B');
      c.px(ox + 2, 10, 'B');
    }
    c.hline(5, 9, 12, 'x');
  },
  pythag: (c: Canvas) => {
    for (let y = 2; y <= 13; y++) for (let x = 2; x <= 13; x++) if (x + y >= 15) c.px(x, y, x + y === 15 ? 'e' : y === 13 || x === 13 ? 'G' : 'g');
    c.hline(11, 12, 11, 'W');
    c.vline(11, 11, 12, 'W');
  },
  area: (c: Canvas) => {
    c.box(1, 6, 8, 13, ['o', 'o', 'O']);
    c.hline(1, 8, 6, 'u');
    c.disc(10, 6, 4.4, (x, y) => (x + y < 14 ? 'l' : x + y > 18 ? 'B' : 'b'));
  },
  trig: (c: Canvas) => {
    for (let y = 2; y <= 13; y++) for (let x = 2; x <= 13; x++) if (x + y >= 15) c.px(x, y, x + y === 15 ? 'u' : y === 13 ? 'Y' : 'y');
    c.px(5, 12, 'R');
    c.px(5, 11, 'R');
    c.px(4, 10, 'R');
  },
  stats: (c: Canvas) => {
    c.box(2, 8, 4, 13, GREEN);
    c.box(6, 3, 8, 13, BLUE);
    c.box(10, 6, 12, 13, ['o', 'o', 'O']);
    c.hline(1, 14, 14, 'D');
  },
  sums: (c: Canvas) => {
    c.stamp(['VVVVVVVVV', 'VvvvvvvvV', '.Vv......', '..Vv.....', '...Vv....', '..Vv.....', '.Vv......', 'VvvvvvvvV', 'VVVVVVVVV'], 4, 3);
  },

  /* menu tiles */
  mathTools: (c: Canvas) => {
    c.hline(6, 9, 2, 'D');
    c.vline(5, 3, 4, 'D');
    c.vline(10, 3, 4, 'D');
    c.box(1, 5, 14, 13, RED);
    c.hline(2, 13, 8, 'R');
    c.rect(7, 7, 8, 9, 'm');
  },
  arcade: (c: Canvas) => {
    c.box(1, 6, 14, 11, METAL);
    c.clear([1, 6], [14, 6]);
    c.rect(2, 12, 4, 12, 'M');
    c.rect(11, 12, 13, 12, 'M');
    c.hline(3, 5, 9, 'D');
    c.vline(4, 8, 10, 'D');
    c.px(10, 8, 'g');
    c.px(12, 9, 'r');
    c.px(10, 10, 'b');
  },
  desks: (c: Canvas) => {
    // A little desk with a sheet of paper and a mug on it.
    c.rect(3, 3, 8, 6, 'w');
    c.hline(4, 7, 4, 'x');
    c.hline(4, 6, 5, 'x');
    c.box(10, 3, 12, 6, RED);
    c.vline(13, 4, 5, 'R');
    c.box(1, 7, 14, 9, WOOD);
    c.rect(2, 10, 3, 14, 't');
    c.vline(3, 10, 14, 'T');
    c.box(9, 10, 13, 13, WOOD);
    c.px(11, 11, 'T');
  },
  myStuff: (c: Canvas) => {
    c.box(2, 6, 13, 14, WOOD);
    c.rect(1, 4, 6, 5, 'c');
    c.rect(9, 4, 14, 5, 'c');
    c.vline(7, 6, 14, 'T');
    c.hline(2, 13, 6, 'T');
  },
  settings: (c: Canvas) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const dx = x - 7.5;
        const dy = y - 7.5;
        const r = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        const tooth = Math.cos(a * 8) > 0.2;
        if (r <= 4.6 || (r <= 6.6 && tooth)) c.px(x, y, dx + dy < -2 ? 'n' : dx + dy > 3 ? 'M' : 'm');
      }
    c.disc(7.5, 7.5, 1.6, 'b');
  },

  /* calculator models */
  calcScientific: (c: Canvas) => {
    calcBody(c, DARK, 'm');
    for (const x of [4, 6, 8, 10]) c.px(x, 6, 'n');
  },
  calcGraphing: (c: Canvas) => {
    c.box(4, 0, 11, 15, DARK);
    c.rect(5, 1, 10, 6, 'L');
    for (const [x, y] of [[5, 5], [6, 4], [7, 3], [8, 3], [9, 4], [10, 2]]) c.px(x, y, 'k');
    for (const y of [8, 10, 12, 14]) for (const x of [5, 7, 9]) c.px(x, y, 'm');
    for (const y of [8, 10, 12]) c.px(10, y, 'o');
  },
  calcExam: (c: Canvas) => {
    calcBody(c, METAL, 'b');
    c.disc(12, 12, 3.2, 'g');
    c.px(11, 12, 'W');
    c.px(12, 13, 'W');
    c.px(13, 12, 'W');
    c.px(14, 11, 'W');
  },

  /* import sources */
  camera: (c: Canvas) => {
    c.rect(5, 3, 9, 4, 'd');
    c.box(1, 5, 14, 13, DARK);
    c.disc(7.5, 9, 3.3, 'm');
    c.disc(7.5, 9, 1.8, 'b');
    c.px(7, 8, 'W');
    c.hline(11, 12, 6, 'u');
  },
  picture: (c: Canvas) => {
    c.rect(1, 2, 14, 13, 'w');
    c.rect(2, 3, 13, 9, 'l');
    c.disc(11, 5, 1.6, 'y');
    c.rect(2, 10, 13, 12, 'g');
    c.hline(3, 6, 9, 'g');
    c.hline(4, 5, 8, 'g');
    c.hline(8, 12, 9, 'G');
    c.hline(2, 13, 12, 'G');
  },
  clipboard: (c: Canvas) => {
    c.box(3, 2, 12, 14, WOOD);
    c.rect(4, 4, 11, 13, 'w');
    for (const y of [6, 8, 10]) c.hline(5, 10, y, 'x');
    c.rect(6, 1, 9, 3, 'm');
    c.hline(6, 9, 1, 'n');
  },
  keyboard: (c: Canvas) => {
    c.box(1, 5, 14, 11, METAL);
    for (const y of [6, 8]) for (let x = 2; x <= 13; x += 2) c.px(x, y, 'W');
    c.hline(4, 11, 10, 'W');
  },
};

export type PixelIconName = keyof typeof DRAW;

const CACHE = new Map<string, string[]>();
function iconRows(name: PixelIconName): string[] {
  let rows = CACHE.get(name);
  if (!rows) {
    const c = new Canvas();
    DRAW[name](c);
    c.outline();
    rows = c.rows();
    CACHE.set(name, rows);
  }
  return rows;
}

/** Sizes snap to whole multiples of 16 so pixels stay crisp. */
export function PixelIcon({ name, size = 32, className = '' }: { name: PixelIconName; size?: number; className?: string }) {
  const px = Math.max(16, Math.round(size / 16) * 16);
  const rects = useMemo(() => pixelRects(iconRows(name), PALETTE), [name]);
  return (
    <svg width={px} height={px} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true" className={`pixel pixel-icon ${className}`}>
      {rects}
    </svg>
  );
}

export const PIXEL_ICON_NAMES = Object.keys(DRAW) as PixelIconName[];
