import { describe, expect, it } from 'vitest';
import { nameFor, noteMatches, pageIsEmpty, samePage, type SavedNote } from './notes';

const note = (over: Partial<SavedNote>): SavedNote => ({ id: 'n1', name: 'Note', createdAt: 1, updatedAt: 1, text: '', strokes: [], size: { w: 380, h: 300 }, ...over });
const stroke = (id: string) => ({ id, color: 'graphite', pts: [0, 0, 0.5, 10, 10, 0.5] });

describe('saved notes', () => {
  it('are named after their first line, or numbered as doodles', () => {
    expect(nameFor('\n  Quadratics homework  \nx^2 - 5x + 6 = 0', [])).toBe('Quadratics homework');
    expect(nameFor('a'.repeat(60), [])).toBe(`${'a'.repeat(39)}…`);
    expect(nameFor('', [])).toBe('Doodle 1');
    expect(nameFor('   ', [note({ name: 'Doodle 1' }), note({ name: 'Doodle 3' })])).toBe('Doodle 2');
  });

  it('know when a pad still matches its note', () => {
    const saved = note({ text: 'hi', strokes: [stroke('a'), stroke('b')] });
    expect(samePage(saved, { text: 'hi', strokes: [stroke('a'), stroke('b')] })).toBe(true);
    expect(samePage(saved, { text: 'hi!', strokes: [stroke('a'), stroke('b')] })).toBe(false);
    expect(samePage(saved, { text: 'hi', strokes: [stroke('a')] })).toBe(false);
    expect(samePage(saved, { text: 'hi', strokes: [stroke('a'), stroke('c')] })).toBe(false);
  });

  it('can be found by name or by anything written on them', () => {
    const n = note({ name: 'Trig practice', text: 'SOH CAH TOA\nangle 35' });
    expect(noteMatches(n, '')).toBe(true);
    expect(noteMatches(n, 'trig')).toBe(true);
    expect(noteMatches(n, 'cah')).toBe(true);
    expect(noteMatches(n, 'quadratic')).toBe(false);
  });

  it('aren’t made from a blank page', () => {
    expect(pageIsEmpty({ text: '  \n ', strokes: [] })).toBe(true);
    expect(pageIsEmpty({ text: '', strokes: [stroke('a')] })).toBe(false);
  });
});
