import { Pixel, stamp, withOutline, type Palette } from './pixel';
import { FISH_BY_ID, FISH_ROWS, FISH_TAIL_A, FISH_TAIL_Y, STICKER_FISH } from './fish';
import { iconRows, PALETTE as ICON_PALETTE, type PixelIconName } from '../components/ui/pixel-icons/PixelIcon';

export interface StickerDef {
  kind: string;
  name: string;
  description: string;
  /** How it's earned; undefined means it's in the starter sheet. */
  earn?: string;
  /** A practice-topic sticker. */
  subject?: boolean;
  render: (size: number) => JSX.Element;
}

/** The die-cut edge: white by day, dark at night (see --sticker-edge). */
const EDGE = { '@': 'var(--sticker-edge)' };

/** A die-cut pixel sticker: the sprite plus a white 1px border. */
const sticker = (rows: string[], palette: Palette) => (size: number) => <Pixel rows={withOutline(rows)} palette={{ ...EDGE, ...palette }} size={size} />;

const NICE = [
  '....p..........',
  '...............',
  'pp..p..pp..p...',
  'p.p.p.p...ppp..',
  'p.p.p.p...p....',
  'p.p.p..pp..pp.p',
  '...............',
  '.cccccccccccc..',
];

const STAR = [
  '.....k.....',
  '....kyk....',
  '....kyk....',
  'kkkkkyykkkk',
  'kyyyyyyyyyk',
  '.kyyyYyyyk.',
  '..kyyyyyk..',
  '..kyykyyk..',
  '.kyyk.kyyk.',
  '.kkk...kkk.',
];

const PI = [
  '...LLLLL...',
  '..LLLLLLL..',
  '.LLLLLLLLL.',
  'LLPPPPPPPLL',
  'LLLPLLLPLLL',
  'LLLPLLLPLLL',
  'LLLPLLLPLLL',
  'LLLPLLLPLLL',
  '.LPLLLLLPL.',
  '..LLLLLLL..',
  '...LLLLL...',
];

const QED = [
  '.cccccccccccccc.',
  'c..............c',
  'c..pp..ppp.pp..c',
  'c.p..p.p...p.p.c',
  'c.p..p.pp..p.p.c',
  'c.p.pp.p...p.p.c',
  'c..ppp.ppp.pp..c',
  'c..............c',
  '.cccccccccccccc.',
];

const MUG = [
  '..s...s...',
  '...s...s..',
  '.KKKKKKKK.',
  '.KwbbbbwKK',
  '.KwbbbbwK.K',
  '.KwwwwwwK.K',
  '.KwwwwwwKKK',
  '.KwwwwwwK..',
  '..KKKKKK...',
];

const MATCHA = [
  '...ffff....',
  '..ffffff...',
  '.KKKKKKKK..',
  '.KgGGGGgK..',
  '.KwwwwwwKKK',
  '.KwwwwwwK.K',
  '..KwwwwwKKK',
  '..KwwwwK...',
  '...KKKK....',
];

const GOLDSTAR = STAR;

/** The collection fish, tail included, ready to be cut out as a sticker. */
const FULL_FISH = stamp(FISH_ROWS, FISH_TAIL_A, 0, FISH_TAIL_Y).slice(2, 13);

const PLAQUE = Array.from({ length: 14 }, (_, y) => {
  if (y === 0 || y === 13) return '..' + 'W'.repeat(20) + '..';
  return '.W' + (y === 11 ? 'w'.repeat(7) + 'g'.repeat(6) + 'w'.repeat(7) : 'w'.repeat(20)) + 'W.';
});
const BASS_ROWS = stamp(PLAQUE, FULL_FISH.slice(0, 10), 2, 1);

export const STICKERS: StickerDef[] = [
  {
    kind: 'nice',
    name: 'nice.',
    description: 'For work that deserves acknowledgement and nothing more.',
    render: sticker(NICE, { p: '#5c62c4', c: '#e07a5f' }),
  },
  {
    kind: 'star',
    name: 'Doodle star',
    description: 'Drawn in the margin during a very long explanation.',
    render: sticker(STAR, { k: '#c4503a', y: '#f4a48d', Y: '#fbd6ca' }),
  },
  {
    kind: 'pi',
    name: 'π',
    description: 'Irrational, but in a charming way.',
    render: sticker(PI, { L: '#dedcfa', P: '#4b51a8' }),
  },
  {
    kind: 'qed',
    name: 'Q.E.D. stamp',
    description: 'Quod erat demonstrandum. Latin for "I am done talking."',
    render: sticker(QED, { c: '#d2593d', p: '#d2593d' }),
  },
  {
    kind: 'fish',
    name: 'Pixel fish',
    description: 'A fish of few words. Mostly bubbles.',
    render: sticker(FULL_FISH, STICKER_FISH.palette),
  },
  {
    kind: 'coffee',
    name: 'Desk coffee',
    description: 'Cold since third period.',
    render: sticker(MUG, { K: '#3a3640', s: '#c9c5bb', w: '#f4f1ea', b: '#7b5a44' }),
  },
  {
    kind: 'matcha',
    name: 'Matcha',
    description: 'Fish food, apparently. Certain fish insist.',
    earn: 'Solve your first challenge problem.',
    render: sticker(MATCHA, { K: '#3a3640', f: '#e8f1d8', g: '#7fae64', G: '#a6c98a', w: '#f4f1ea' }),
  },
  {
    kind: 'goldstar',
    name: 'Gold star',
    description: 'Awarded for finishing a whole practice set. Laminated.',
    earn: 'Finish a challenge set.',
    render: sticker(GOLDSTAR, { k: '#a77b0c', y: '#f2c94c', Y: '#fbe9a6' }),
  },
  {
    kind: 'bass',
    name: 'Trophy bass',
    description: 'Mounted. Sings when you walk by (it does not, this is a sticker).',
    earn: 'Reach 50 practice points.',
    render: sticker(BASS_ROWS, { ...FISH_BY_ID.basspro.palette, W: '#5b3a1a', w: '#a86f3c', g: '#e7c35a' }),
  },
];

/** Drops empty rows and columns so the die-cut edge hugs the art. */
function trim(rows: string[]): string[] {
  const filled = (c: string) => c !== '.';
  const ys = rows.map((r, y) => ([...r].some(filled) ? y : -1)).filter((y) => y >= 0);
  const xs = rows.flatMap((r) => [...r].map((c, x) => (filled(c) ? x : -1)).filter((x) => x >= 0));
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  return rows.slice(ys[0], ys[ys.length - 1] + 1).map((r) => r.slice(x0, x1 + 1));
}

/**
 * One sticker per practice topic, made from that tool's icon. Earned the first
 * time a practice set with that topic is finished (see `subjectStickersFor`).
 */
export const SUBJECT_STICKERS: { topic: string; icon: PixelIconName; name: string; description: string }[] = [
  { topic: 'slope', icon: 'slopeFromPoints', name: 'Slope', description: 'Rise over run, framed. Steep in all the right ways.' },
  { topic: 'standard', icon: 'standardToSlope', name: 'Standard form', description: 'Ax + By = C, rearranged into something readable.' },
  { topic: 'pointSlope', icon: 'pointSlope', name: 'Point-slope', description: 'One point, one slope, one very specific line.' },
  { topic: 'systems', icon: 'systems', name: 'Systems', description: 'Two lines met here. It was meant to be.' },
  { topic: 'quadratic', icon: 'quadratic', name: 'Quadratics', description: 'Negative b, plus or minus, sung to the usual tune.' },
  { topic: 'factoring', icon: 'factoring', name: 'Factoring', description: 'Un-multiplied, carefully, with receipts.' },
  { topic: 'pythag', icon: 'pythag', name: 'Pythagorean', description: 'a² + b² = c², and a little triangle pride.' },
  { topic: 'area', icon: 'area', name: 'Area', description: 'Measured the inside. Respected the edges.' },
  { topic: 'trig', icon: 'trig', name: 'Trig', description: 'SOH CAH TOA, officially certified.' },
  { topic: 'stats', icon: 'stats', name: 'Statistics', description: 'Mean, median, mode, and a very calm range.' },
  { topic: 'sequences', icon: 'sums', name: 'Sequences', description: 'Saw the pattern coming from a mile off.' },
];

export const subjectStickerKind = (topic: string) => `subject-${topic}`;

STICKERS.push(
  ...SUBJECT_STICKERS.map((s) => ({
    kind: subjectStickerKind(s.topic),
    name: s.name,
    description: s.description,
    earn: `Finish a practice set with ${s.name.toLowerCase()} problems in it.`,
    subject: true,
    render: sticker(trim(iconRows(s.icon)), ICON_PALETTE),
  })),
);

export const STICKER_BY_KIND = Object.fromEntries(STICKERS.map((s) => [s.kind, s]));
