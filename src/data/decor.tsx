import type { Palette } from './pixel';
import type { Rarity } from './fish';

/**
 * Fishbowl decor and fish food. Decor is either unlocked by catching a
 * particular fish (`from: 'fish'`) or found as a rare drop on da Ship.
 * Sprites are placed on the bowl's 80×60 pixel grid at (x, y).
 */
export interface DecorDef {
  id: string;
  name: string;
  description: string;
  from: 'fish' | 'drop';
  /** Drops only: how rare, and on which trips it can turn up. */
  rarity?: Rarity;
  time?: 'day' | 'night' | 'any';
  rows: string[];
  palette: Palette;
  x: number;
  y: number;
}

const K = '#2a2932';

export const DECOR: DecorDef[] = [
  {
    id: 'books',
    name: "Women's literature",
    description: 'A carefully arranged stack. The spines face outward, for visibility.',
    from: 'fish',
    rows: ['.RRRRRRRR.', '.RrrrrrrR.', '..BBBBBBBB', '..BbbbbbbB', 'YYYYYYYY..', 'YyyyyyyY..'],
    palette: { R: '#c4503a', r: '#e88b74', B: '#4b51a8', b: '#8f95e6', Y: '#c99a22', y: '#f3d27a' },
    x: 50,
    y: 41,
  },
  {
    id: 'castle',
    name: 'Tiny castle',
    description: 'Every bowl needs one. Nobody knows why. The fish do not live in it.',
    from: 'drop',
    rarity: 'rare',
    time: 'any',
    rows: [
      '.K.K.KK.K.K.',
      'KmKmKmmKmKmK',
      'KmmmmmmmmmmK',
      'KmmMmmmmMmmK',
      'KmmmmmmmmmmK',
      '.KmmmmmmmmK.',
      '.KmmmDDmmmK.',
      '.KmmDDDDmmK.',
      '.KmmDDDDmmK.',
      '.KKKKKKKKKK.',
    ],
    palette: { K, m: '#c3bfd3', M: '#8d88a0', D: '#4a4458' },
    x: 20,
    y: 37,
  },
  {
    id: 'coral',
    name: 'Pink coral',
    description: 'Grown in good faith. Mildly judgmental.',
    from: 'drop',
    rarity: 'uncommon',
    time: 'day',
    rows: ['P.P..P', 'PP.PPP', '.PPPP.', '..PP.P', '..PPP.', '..PP..'],
    palette: { P: '#ee8c95' },
    x: 32,
    y: 41,
  },
  {
    id: 'chest',
    name: 'Treasure chest',
    description: 'Contains one (1) receipt.',
    from: 'drop',
    rarity: 'legendary',
    time: 'any',
    rows: ['.KKKKKK.', 'KtttttTK', 'KYYYYYYK', 'KtttYttK', 'KtttttTK', 'KKKKKKKK'],
    palette: { K, t: '#b97a3f', T: '#7d4a1c', Y: '#e7c35a' },
    x: 39,
    y: 42,
  },
  {
    id: 'lantern',
    name: 'Sea lantern',
    description: 'Fished up after dark. Still warm, somehow.',
    from: 'drop',
    rarity: 'rare',
    time: 'night',
    rows: ['..K..', '.KKK.', 'KyuyK', 'KyuyK', 'KyyyK', '.KKK.'],
    palette: { K, y: '#f3c94c', u: '#fff3b8' },
    x: 46,
    y: 41,
  },
];

export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d]));

export interface FoodDef {
  id: string;
  name: string;
  color: string;
}

export const FOODS: FoodDef[] = [
  { id: 'flakes', name: 'Fish flakes', color: '#c98a5a' },
  { id: 'matcha', name: 'Matcha', color: '#7fae64' },
];

export const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));
