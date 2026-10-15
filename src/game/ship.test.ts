import { describe, expect, it } from 'vitest';
import { CASTS_PER_TRIP, OFF_HOURS_TICKET_PRICE, RARITY, TICKET_PRICE, fishPool, rollDecorDrop, rollFish, ticketPrice, timeOfDay } from './ship';
import { FISH } from '../data/fish';
import { DECOR } from '../data/decor';
import { rng } from '../math/challenge';

const at = (h: number) => new Date(2026, 9, 14, h, 30);

describe('da Ship rules', () => {
  it('follows the real clock for day and night', () => {
    expect(timeOfDay(at(5))).toBe('night');
    expect(timeOfDay(at(6))).toBe('day');
    expect(timeOfDay(at(18))).toBe('day');
    expect(timeOfDay(at(19))).toBe('night');
    expect(timeOfDay(at(0))).toBe('night');
  });

  it('charges normal fare for now and more for the other time of day', () => {
    expect(ticketPrice('day', at(10))).toBe(TICKET_PRICE);
    expect(ticketPrice('night', at(10))).toBe(OFF_HOURS_TICKET_PRICE);
    expect(ticketPrice('night', at(22))).toBe(TICKET_PRICE);
    expect(OFF_HOURS_TICKET_PRICE).toBeGreaterThan(TICKET_PRICE);
    expect(CASTS_PER_TRIP).toBeGreaterThan(0);
  });

  it('only catches fish that bite at that time of day, mostly common ones', () => {
    for (const time of ['day', 'night'] as const) {
      const r = rng(time === 'day' ? 1 : 2);
      const counts: Record<string, number> = {};
      for (let i = 0; i < 3000; i++) {
        const f = rollFish(time, r);
        expect(f.time === time || f.time === 'any').toBe(true);
        counts[f.rarity] = (counts[f.rarity] ?? 0) + 1;
      }
      expect(counts.common).toBeGreaterThan(counts.uncommon);
      expect(counts.uncommon).toBeGreaterThan(counts.rare);
      expect(counts.rare).toBeGreaterThan(counts.legendary ?? 0);
      expect(counts.legendary ?? 0).toBeGreaterThan(0);
      expect(fishPool(time).length).toBeGreaterThan(3);
    }
  });

  it('gives rarer fish shorter, but still generous, bite windows', () => {
    expect(RARITY.common.biteWindowMs).toBeGreaterThan(RARITY.legendary.biteWindowMs);
    expect(RARITY.legendary.biteWindowMs).toBeGreaterThanOrEqual(800);
  });

  it('drops only decor you do not have, from the right time of day', () => {
    const r = rng(9);
    const legendary = FISH.find((f) => f.rarity === 'legendary' && f.time === 'day')!;
    for (let i = 0; i < 500; i++) {
      const d = rollDecorDrop(legendary, 'day', ['castle'], r);
      if (!d) continue;
      expect(d.from).toBe('drop');
      expect(d.id).not.toBe('castle');
      expect(d.time === 'day' || d.time === 'any').toBe(true);
    }
    const all = DECOR.filter((d) => d.from === 'drop').map((d) => d.id);
    expect(rollDecorDrop(legendary, 'day', all, () => 0)).toBeNull();
  });

  it('has a sprite-ready palette and unique id for every fish', () => {
    expect(new Set(FISH.map((f) => f.id)).size).toBe(FISH.length);
    for (const f of FISH) expect(f.palette.o && f.palette.b && f.palette.f).toBeTruthy();
  });
});
