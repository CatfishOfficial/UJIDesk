import { FISH, type FishDef, type Rarity } from '../data/fish';
import { DECOR, type DecorDef } from '../data/decor';

/**
 * Trip on da Ship rules, kept separate from drawing so they can be tested
 * and tuned. Tokens come from Challenge practice; tickets cost tokens so
 * fishing stays a reward rather than a way to avoid work.
 */

export type TimeOfDay = 'day' | 'night';

/** Day runs 6:00–18:59 on the player's own clock, like Animal Crossing. */
export function timeOfDay(now: Date = new Date()): TimeOfDay {
  const h = now.getHours();
  return h >= 6 && h < 19 ? 'day' : 'night';
}

/** A first-try Challenge answer is worth 10 tokens. */
export const TOKENS_PER_QUESTION = 10;
/** The ticket for the current time of day: about six questions. */
export const TICKET_PRICE = 60;
/** The other time of day costs extra: about ten questions. */
export const OFF_HOURS_TICKET_PRICE = 100;
/** Casts per ticket. Keeps a trip short. */
export const CASTS_PER_TRIP = 3;

export function ticketPrice(kind: TimeOfDay, now: Date = new Date()): number {
  return kind === timeOfDay(now) ? TICKET_PRICE : OFF_HOURS_TICKET_PRICE;
}

export const RARITY: Record<Rarity, { label: string; weight: number; biteWindowMs: number; decorChance: number; color: string }> = {
  common: { label: 'Common', weight: 60, biteWindowMs: 1500, decorChance: 0.03, color: '#8d949e' },
  uncommon: { label: 'Uncommon', weight: 27, biteWindowMs: 1300, decorChance: 0.07, color: '#4f8f6c' },
  rare: { label: 'Rare', weight: 10, biteWindowMs: 1100, decorChance: 0.2, color: '#4f55b8' },
  legendary: { label: 'Legendary', weight: 3, biteWindowMs: 900, decorChance: 0.45, color: '#c9961a' },
};

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

export function fishPool(time: TimeOfDay): FishDef[] {
  return FISH.filter((f) => f.time === time || f.time === 'any');
}

/** Picks a rarity by weight (among rarities present), then a fish of that rarity. */
export function rollFish(time: TimeOfDay, rand: () => number = Math.random): FishDef {
  const pool = fishPool(time);
  const rarities = RARITY_ORDER.filter((r) => pool.some((f) => f.rarity === r));
  const total = rarities.reduce((a, r) => a + RARITY[r].weight, 0);
  let roll = rand() * total;
  let rarity = rarities[0];
  for (const r of rarities) {
    roll -= RARITY[r].weight;
    if (roll < 0) {
      rarity = r;
      break;
    }
  }
  const options = pool.filter((f) => f.rarity === rarity);
  return options[Math.min(options.length - 1, Math.floor(rand() * options.length))];
}

/** Seconds of calm before something bites. */
export function waitMs(rand: () => number = Math.random): number {
  return 1800 + rand() * 4200;
}

/** Sometimes a catch brings up a piece of decor you don't have yet. Rarer fish, better odds. */
export function rollDecorDrop(fish: FishDef, time: TimeOfDay, owned: string[], rand: () => number = Math.random): DecorDef | null {
  if (rand() >= RARITY[fish.rarity].decorChance) return null;
  const options = DECOR.filter((d) => d.from === 'drop' && !owned.includes(d.id) && (d.time === 'any' || d.time === time));
  if (!options.length) return null;
  // Rarer decor is less likely, even when a drop happens.
  const weighted = options.flatMap((d) => Array(5 - RARITY_ORDER.indexOf(d.rarity ?? 'common')).fill(d) as DecorDef[]);
  return weighted[Math.floor(rand() * weighted.length)];
}
