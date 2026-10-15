import { pixelRects, silhouette, stamp, type Palette } from './pixel';

/**
 * Every fish that can be caught on da Ship. Placeholder pixel art; entries
 * marked `placeholder` are stand-ins until the real roster (and jokes) exist.
 */
export type Accessory = 'tote' | 'fringe' | 'vest' | 'monocle' | 'cap';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type FishTime = 'day' | 'night' | 'any';

export interface FishDef {
  id: string;
  name: string;
  description: string;
  quip: string;
  rarity: Rarity;
  /** When this fish bites on da Ship. */
  time: FishTime;
  palette: Palette;
  accessory?: Accessory;
  /** Catching it for the first time unlocks these (ids from data/decor). */
  unlocks?: { food?: string[]; decor?: string[] };
  placeholder?: boolean;
}

const OUTLINE = '#2a2932';
const EYE = { w: '#ffffff', e: '#1c1b22', K: OUTLINE };
const PLACEHOLDER = 'Placeholder fish. A real one with a real joke goes here.';

export const FISH: FishDef[] = [
  // ── Day ──
  {
    id: 'performative',
    name: 'Performative Male Fish',
    description: 'Reads in public. Has opinions about tote bags. Drinks matcha he does not enjoy.',
    quip: 'currently reading bell hooks',
    rarity: 'common',
    time: 'day',
    palette: { ...EYE, o: '#8cc29c', b: '#cbe7d2', f: '#5b9a6f', T: '#f2e9d2', t: '#c9b98f', s: '#7c6f55' },
    accessory: 'tote',
    unlocks: { food: ['matcha'], decor: ['books'] },
  },
  {
    id: 'guppy',
    name: 'Placeholder Guppy',
    description: PLACEHOLDER,
    quip: '...',
    rarity: 'common',
    time: 'day',
    palette: { ...EYE, o: '#f2b45c', b: '#fbe0b0', f: '#d18a2e' },
    placeholder: true,
  },
  {
    id: 'financebro',
    name: 'Finance Bro Fish',
    description: 'Vest. Has a thesis on plankton futures. Will explain it.',
    quip: "let's circle back on the castle",
    rarity: 'uncommon',
    time: 'day',
    palette: { ...EYE, o: '#9db8d4', b: '#d7e3ef', f: '#6f8fb3', V: '#2d3e5c', W: '#f6f6f6' },
    accessory: 'vest',
  },
  {
    id: 'snapper',
    name: 'Placeholder Snapper',
    description: PLACEHOLDER,
    quip: '...',
    rarity: 'uncommon',
    time: 'day',
    palette: { ...EYE, o: '#e9776a', b: '#f8c6bd', f: '#b8483c' },
    placeholder: true,
  },
  {
    id: 'basspro',
    name: 'Bass Pro Shops Fish',
    description: 'Lives in a pyramid somewhere in Memphis. Camouflage is aspirational.',
    quip: 'you should see the other pyramid',
    rarity: 'rare',
    time: 'day',
    palette: { ...EYE, o: '#7fa062', b: '#d0dcb4', f: '#5a7a44', C: '#666a39', c: '#8f8b4e', D: '#45472a' },
    accessory: 'cap',
  },
  {
    id: 'koi',
    name: 'Placeholder Koi',
    description: PLACEHOLDER,
    quip: '...',
    rarity: 'legendary',
    time: 'day',
    palette: { ...EYE, o: '#fbfbf6', b: '#ffffff', f: '#e5533d' },
    placeholder: true,
  },
  // ── Night ──
  {
    id: 'sardine',
    name: 'Placeholder Sardine',
    description: PLACEHOLDER,
    quip: '...',
    rarity: 'common',
    time: 'night',
    palette: { ...EYE, o: '#a9b7c6', b: '#e3e9ef', f: '#75879a' },
    placeholder: true,
  },
  {
    id: 'shoegaze',
    name: 'Shoegaze Fish',
    description: 'Stares at the gravel. Very into reverb. Swims slightly out of focus.',
    quip: '(inaudible, but beautiful)',
    rarity: 'uncommon',
    time: 'night',
    palette: { ...EYE, o: '#b2aaee', b: '#ddd9fb', f: '#8981d2', H: '#5a5395' },
    accessory: 'fringe',
  },
  {
    id: 'eel',
    name: 'Placeholder Eel',
    description: PLACEHOLDER,
    quip: '...',
    rarity: 'uncommon',
    time: 'night',
    palette: { ...EYE, o: '#5e7d6a', b: '#a9c4b2', f: '#3f5a4a' },
    placeholder: true,
  },
  {
    id: 'philosopher',
    name: 'Philosopher Fish',
    description: 'Wonders whether the bowl is the bowl, or merely bowl-shaped.',
    quip: 'is water wet, or are we?',
    rarity: 'rare',
    time: 'night',
    palette: { ...EYE, o: '#e3c18c', b: '#f5e2c0', f: '#b98f52', G: '#d9a82a' },
    accessory: 'monocle',
  },
  {
    id: 'angler',
    name: 'Placeholder Anglerfish',
    description: PLACEHOLDER,
    quip: '...',
    rarity: 'legendary',
    time: 'night',
    palette: { ...EYE, o: '#3f4466', b: '#6b7099', f: '#2a2d48', e: '#f6e27a' },
    placeholder: true,
  },
];

export const FISH_BY_ID = Object.fromEntries(FISH.map((f) => [f.id, f]));

/* 20×15 canvas, facing right. Tail occupies columns 0–4 of rows 4–10. */
const BASE = [
  '....................',
  '....................',
  '........KKKK........',
  '......KKffffK.......',
  '.....KKooooooKK.....',
  '.....KooooooooooK...',
  '....KoooooooooweoK..',
  '....KoooooooooooooK.',
  '....KbbbbbbbbbbbKK..',
  '.....KbbbbbbbbbbK...',
  '.....KKbbbbbbbKK....',
  '......KKffKKKKK.....',
  '........KK..........',
  '....................',
  '....................',
].map((r) => r.slice(0, 20).padEnd(20, '.'));

/* Forked tail, two frames for a gentle flick. */
const TAIL_A = ['KK...', 'KfK..', 'KffKK', '.KffK', 'KffKK', 'KfK..', 'KK...'];
const TAIL_B = ['.....', '.KK..', '.KfKK', '..KfK', '.KfKK', '.KK..', '.....'];
const TAIL_Y = 4;
const EYE_AT: [number, number] = [14, 6];

const ACCESSORIES: Record<Accessory, { patch: string[]; x: number; y: number; hidesEye?: boolean }> = {
  tote: { patch: ['..t..', '.t.t.', 'KTTTK', 'KTsTK', 'KKKKK'], x: 9, y: 10 },
  fringe: { patch: ['HHHH..', '.HHHHH', '..HHHH'], x: 11, y: 4, hidesEye: true },
  vest: { patch: ['VWWV', 'VVWV', 'VVVV', 'VVVV', 'VVVV'], x: 7, y: 5 },
  monocle: { patch: ['.GG.', 'G..G', '.GG.', '...G', '...G'], x: 13, y: 5 },
  cap: { patch: ['..KKK....', '.KcCcK...', '.KCcCcK..', '..DDDDDDD'], x: 11, y: 2 },
};

function grid(accessory?: Accessory): string[] {
  let rows = BASE;
  if (accessory) {
    const a = ACCESSORIES[accessory];
    rows = stamp(rows, a.patch, a.x, a.y);
  }
  return rows;
}

/** Fish sprite as rects, for embedding in a larger pixel scene. */
export function fishLayers(fish: { palette: Palette; accessory?: Accessory }, opts: { silhouette?: boolean; ox?: number; oy?: number } = {}) {
  const pal = opts.silhouette ? silhouette(fish.palette) : fish.palette;
  const ox = opts.ox ?? 0;
  const oy = opts.oy ?? 0;
  const g = grid(fish.accessory);
  // Clear the tail area from the body; tails are drawn as separate frames.
  const body = g.map((r, y) => (y >= TAIL_Y && y < TAIL_Y + 7 ? '.....' + r.slice(5) : r));
  const hidesEye = !!fish.accessory && ACCESSORIES[fish.accessory].hidesEye;
  return {
    body: pixelRects(body, pal, ox, oy, 'b'),
    tailA: pixelRects(TAIL_A, pal, ox, oy + TAIL_Y, 'ta'),
    tailB: pixelRects(TAIL_B, pal, ox, oy + TAIL_Y, 'tb'),
    blink: hidesEye || opts.silhouette ? [] : pixelRects(['KK'], pal, ox + EYE_AT[0], oy + EYE_AT[1], 'bl'),
  };
}

/** A standalone fish. Animated sprites flick their tail and blink now and then. */
export function FishSprite({ fish, scale = 3, animated, silhouette: sil }: { fish: FishDef; scale?: number; animated?: boolean; silhouette?: boolean }) {
  const l = fishLayers(fish, { silhouette: sil });
  return (
    <svg width={20 * scale} height={15 * scale} viewBox="0 0 20 15" shapeRendering="crispEdges" aria-hidden="true" className={`pixel fish-sprite ${animated ? 'is-animated' : ''}`}>
      <g>{l.body}</g>
      <g className="fish-tail-a">{l.tailA}</g>
      {animated && <g className="fish-tail-b">{l.tailB}</g>}
      {animated && <g className="fish-blink">{l.blink}</g>}
    </svg>
  );
}

/** Plain orange fish used by the sticker sheet. */
export const STICKER_FISH = { palette: { ...EYE, o: '#f0975a', b: '#fbd0a8', f: '#cc6b34' } };
export const FISH_ROWS = grid();
export const FISH_TAIL_A = TAIL_A;
export const FISH_TAIL_Y = TAIL_Y;
