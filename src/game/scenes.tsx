import { useMemo, type ReactNode } from 'react';
import { PixelCanvas, textWidth } from '../data/pixelCanvas';
import { pixelRects, type Palette } from '../data/pixel';
import { rng } from '../math/challenge';
import type { TimeOfDay } from './ship';

/** Scene grid. Everything is drawn in these pixels and scaled up crisply. */
export const SCENE_W = 160;
export const SCENE_H = 100;
export const HORIZON = 58;

const PAL: Palette = {
  K: '#2a2932',
  // day sky
  a: '#7cc0f0',
  b: '#93cdf3',
  c: '#acd9f6',
  d: '#c6e5f9',
  // night sky
  A: '#1b2042',
  B: '#232a52',
  C: '#2c3462',
  D: '#363f74',
  // sea
  s: '#3f8fd0',
  t: '#4d9bd8',
  u: '#2f77ba',
  S: '#1b2d55',
  T: '#213766',
  U: '#16244a',
  f: '#9fd2f3', // day wave glint
  F: '#8ea2d8', // night glint
  m: '#fff6c8', // moon / star
  y: '#ffd95a', // sun
  Y: '#f2b73a',
  w: '#ffffff',
  // shore and shop
  q: '#ead2a2',
  Q: '#d4b47d',
  p: '#b0784a',
  P: '#7d4a1c',
  e: '#f4f1ea',
  E: '#d8d2c4',
  r: '#d1483a',
  R: '#8f2a22',
  g: '#2f5fb8',
  G: '#86b8ee',
  // da Ship
  h: '#c9483a',
  H: '#7a2a22',
  n: '#8d949e',
  o: '#e07a5f',
  l: '#7d4a1c',
  j: '#2a2932',
};

function sky(c: PixelCanvas, time: TimeOfDay, seed: number) {
  const bands = time === 'day' ? 'abcd' : 'ABCD';
  for (let y = 0; y < HORIZON; y++) {
    const i = Math.min(3, Math.floor((y / HORIZON) * 4));
    // dithered band edges
    const edge = (y + 1) % Math.ceil(HORIZON / 4) === 0;
    for (let x = 0; x < SCENE_W; x++) c.px(x, y, bands[edge && (x + y) % 2 ? Math.min(3, i + 1) : i]);
  }
  if (time === 'day') {
    c.disc(132, 14, 6.5, (x, y) => (x + y < 144 ? 'y' : 'Y'));
    for (const [cx, cy, w] of [[30, 12, 16], [92, 20, 12], [60, 8, 10]]) {
      c.rect(cx, cy, cx + w, cy + 2, 'w');
      c.rect(cx + 3, cy - 2, cx + w - 4, cy - 1, 'w');
      c.hline(cx + 1, cx + w - 1, cy + 3, 'd');
    }
  } else {
    const r = rng(seed);
    for (let i = 0; i < 40; i++) c.px(Math.floor(r() * SCENE_W), Math.floor(r() * (HORIZON - 6)), r() < 0.25 ? 'm' : 'F');
    c.disc(130, 14, 6.5, 'm');
    c.disc(133, 11, 5.5, (x, y) => (c.get(x, y) === 'm' ? 'B' : null));
  }
}

function sea(c: PixelCanvas, time: TimeOfDay, from = HORIZON) {
  const [m, l, d] = time === 'day' ? ['s', 't', 'u'] : ['S', 'T', 'U'];
  for (let y = from; y < SCENE_H; y++) for (let x = 0; x < SCENE_W; x++) c.px(x, y, y < from + 3 ? l : y > SCENE_H - 14 ? d : m);
  if (time === 'night') for (let y = from + 1; y < SCENE_H; y += 2) c.hline(124 + ((y * 3) % 5), 134 - ((y * 2) % 4), y, 'F');
}

const WATER = new Set(['s', 't', 'u', 'S', 'T', 'U']);

/** Two frames of little wave glints, toggled by CSS. Glints only land on open water, never the dock or sand. */
function waves(time: TimeOfDay, frame: 0 | 1, from: number, bg: PixelCanvas): string[] {
  const c = new PixelCanvas(SCENE_W, SCENE_H);
  const col = time === 'day' ? 'f' : 'F';
  const r = rng(11 + frame);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * (SCENE_W - 4));
    const y = from + 3 + Math.floor(r() * (SCENE_H - from - 6));
    const len = 2 + Math.floor(r() * 3);
    for (let dx = 0; dx <= len; dx++) if (WATER.has(bg.get(x + dx, y))) c.px(x + dx, y, col);
  }
  return c.rows();
}

/** da Ship: red hull with the name painted on, a little cabin, mast and flag. */
export function shipRows(withRod: boolean): string[] {
  const c = new PixelCanvas(84, 36);
  // mast and flag
  c.vline(48, 2, 21, 'j');
  c.rect(49, 3, 56, 7, 'o');
  c.hline(49, 56, 7, 'R');
  // cabin
  c.rect(16, 11, 38, 21, 'e');
  c.hline(16, 38, 21, 'E');
  c.hline(15, 39, 10, 'n');
  for (const x of [19, 26, 33]) c.rect(x, 14, x + 2, 16, 'G');
  // hull, bow to the right
  for (let r = 0; r < 12; r++) {
    const y = 22 + r;
    const x0 = 2 + Math.max(0, r - 8);
    const x1 = 79 - Math.round(r * 1.6);
    c.hline(x0, x1, y, r === 0 ? 'e' : r >= 10 ? 'H' : 'h');
  }
  const name = 'da ship';
  c.text(name, 30 - Math.floor(textWidth(name) / 2) + 6, 25, 'e');
  if (withRod) c.line(60, 21, 74, 6, 'l');
  c.outline('K');
  return c.rows();
}

function shop(c: PixelCanvas) {
  // boardwalk and sand
  c.rect(0, 78, SCENE_W, SCENE_H, 'q');
  for (let x = 0; x < SCENE_W; x += 6) c.vline(x, 78, SCENE_H, 'Q');
  c.rect(0, 74, 92, 78, 'p');
  c.hline(0, 92, 78, 'P');
  for (const x of [6, 30, 54, 78]) c.rect(x, 79, x + 2, 90, 'P');
  // building
  const s = new PixelCanvas(72, 52);
  s.rect(4, 14, 66, 50, 'e');
  s.hline(4, 66, 50, 'E');
  for (let x = 2; x <= 68; x++) {
    const stripe = Math.floor((x - 2) / 5) % 2 ? 'w' : 'r';
    s.vline(x, 12, 18, stripe);
    s.px(x, 19, (x - 2) % 5 < 3 ? (stripe === 'r' ? 'R' : 'E') : '.');
  }
  // sign
  s.rect(12, 1, 58, 10, 'g');
  s.text('tickets', 35 - Math.floor(textWidth('tickets') / 2), 3, 'w');
  s.vline(18, 10, 11, 'P');
  s.vline(52, 10, 11, 'P');
  // window with counter
  s.rect(10, 24, 40, 40, 'G');
  s.hline(10, 40, 32, 'w');
  s.rect(8, 40, 42, 43, 'p');
  s.hline(8, 42, 43, 'P');
  // door
  s.rect(48, 26, 60, 50, 'p');
  s.rect(50, 28, 58, 36, 'G');
  s.px(57, 40, 'y');
  s.outline('K');
  c.stamp(s.rows(), 10, 24);
}

export function Scene({ kind, time, children, className }: { kind: 'shop' | 'sea'; time: TimeOfDay; children?: ReactNode; className?: string }) {
  const { bg, waveA, waveB } = useMemo(() => {
    const c = new PixelCanvas(SCENE_W, SCENE_H);
    const horizon = kind === 'shop' ? HORIZON + 4 : HORIZON;
    sky(c, time, kind === 'shop' ? 3 : 5);
    sea(c, time, horizon);
    if (kind === 'shop') shop(c);
    return {
      bg: pixelRects(c.rows(), PAL, 0, 0, 'bg'),
      waveA: pixelRects(waves(time, 0, horizon, c), PAL, 0, 0, 'wa'),
      waveB: pixelRects(waves(time, 1, horizon, c), PAL, 0, 0, 'wb'),
    };
  }, [kind, time]);
  return (
    <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} shapeRendering="crispEdges" className={`pixel game-scene ${className ?? ''}`} preserveAspectRatio={kind === 'shop' ? 'xMidYMax slice' : 'xMidYMid slice'} aria-hidden="true">
      {bg}
      <g className="frame-a">{waveA}</g>
      <g className="frame-b">{waveB}</g>
      {children}
    </svg>
  );
}

export function Ship({ x, y, rod }: { x: number; y: number; rod?: boolean }) {
  const rects = useMemo(() => pixelRects(shipRows(!!rod), PAL, 0, 0, 'ship'), [rod]);
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="ship-bob">{rects}</g>
    </g>
  );
}

const BOBBER = ['.K.', 'KrK', 'KrK', 'KwK', 'KwK', '.K.'];

export function Bobber({ x, y, state }: { x: number; y: number; state: 'idle' | 'bite' | 'flying' | 'hidden' }) {
  if (state === 'hidden') return null;
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={state === 'bite' ? 'bobber-bite' : state === 'idle' ? 'bobber-idle' : undefined}>{pixelRects(BOBBER, PAL, 0, 0, 'bob')}</g>
      {state === 'bite' && (
        <g className="bite-mark">
          {pixelRects(['KKKKK', 'KwwwK', 'KwjwK', 'KwjwK', 'KwjwK', 'KwwwK', 'KwjwK', 'KwwwK', 'KKKKK'], PAL, -1, -12, 'ex')}
        </g>
      )}
    </g>
  );
}

/** The fishing line from the rod tip to the bobber. */
export function FishingLine({ from, to }: { from: [number, number]; to: [number, number] }) {
  const rects = useMemo(() => {
    const c = new PixelCanvas(SCENE_W, SCENE_H);
    c.line(from[0], from[1], to[0], to[1], 'w');
    return pixelRects(c.rows(), { w: 'rgba(255,255,255,0.75)' }, 0, 0, 'ln');
  }, [from, to]);
  return <g>{rects}</g>;
}

/* ── Casting ───────────────────────────────────────── */

/** Where the rod meets the boat, in scene pixels (ship drawn at 6, 34). */
export const ROD_BASE: [number, number] = [66, 55];
export type RodPose = 'back' | 'up' | 'forward' | 'rest';
export const ROD_TIPS: Record<RodPose, [number, number]> = {
  back: [50, 44],
  up: [64, 36],
  forward: [84, 46],
  rest: [80, 40],
};
/** Where the bobber floats once it lands. */
export const BOBBER_AT: [number, number] = [120, 58];

export function Rod({ pose }: { pose: RodPose }) {
  const rects = useMemo(() => {
    const c = new PixelCanvas(SCENE_W, SCENE_H);
    const [tx, ty] = ROD_TIPS[pose];
    c.line(ROD_BASE[0], ROD_BASE[1], tx, ty, 'l');
    c.outline('K');
    return pixelRects(c.rows(), PAL, 0, 0, `rod-${pose}`);
  }, [pose]);
  return <g>{rects}</g>;
}

/** The bobber's arc from the rod tip to the water, as whole-pixel frames. */
export const FLIGHT: [number, number][] = Array.from({ length: 7 }, (_, i) => {
  const t = (i + 1) / 7;
  const [x0, y0] = ROD_TIPS.forward;
  const [x1, y1] = BOBBER_AT;
  return [Math.round(x0 + (x1 - x0) * t), Math.round(y0 - 4 + (y1 - y0 + 4) * t - 26 * t * (1 - t))];
});

const SPLASH = [
  ['.w.w.', 'w...w', '.www.'],
  ['w.....w', '.w...w.', '..www..'],
];

export function Splash({ frame }: { frame: 0 | 1 }) {
  const rows = SPLASH[frame];
  return <g>{pixelRects(rows, PAL, BOBBER_AT[0] + 1 - Math.floor(rows[0].length / 2), BOBBER_AT[1] + 2, `sp${frame}`)}</g>;
}
