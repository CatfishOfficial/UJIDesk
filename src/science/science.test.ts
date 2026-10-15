import { describe, expect, it } from 'vitest';
import { ELEMENTS, electronConfig, findElement } from './elements';
import { parseDecayType, parseNuclide, solveDecay } from './decay';
import { toPlain } from '../math/markup';

const el = (s: string) => findElement(s)!;

describe('periodic table', () => {
  it('has all 118 elements in the right places', () => {
    expect(ELEMENTS).toHaveLength(118);
    expect(el('Fe')).toMatchObject({ z: 26, period: 4, group: 8, row: 4, col: 8 });
    expect(el('Al')).toMatchObject({ z: 13, group: 13 });
    expect(el('La')).toMatchObject({ row: 9, col: 3, group: null });
    expect(el('Lr')).toMatchObject({ row: 10, col: 17 });
    expect(el('Hf')).toMatchObject({ row: 6, group: 4 });
    expect(el('Og')).toMatchObject({ row: 7, group: 18 });
    const cells = new Set(ELEMENTS.map((e) => `${e.row},${e.col}`));
    expect(cells.size).toBe(118);
  });
  it('finds elements by symbol, name, alias or number', () => {
    expect(el('po').name).toBe('Polonium');
    expect(el('Gold').symbol).toBe('Au');
    expect(el('sulphur').symbol).toBe('S');
    expect(el('92').symbol).toBe('U');
    expect(findElement('Xx')).toBeNull();
  });
  it('writes electron configurations, including the usual exceptions', () => {
    expect(electronConfig(1)).toBe('1s1');
    expect(electronConfig(10)).toBe('[He] 2s2 2p6');
    expect(electronConfig(26)).toBe('[Ar] 4s2 3d6');
    expect(electronConfig(35)).toBe('[Ar] 4s2 3d10 4p5');
    expect(electronConfig(82)).toBe('[Xe] 6s2 4f14 5d10 6p2');
    expect(electronConfig(24)).toBe('[Ar] 4s1 3d5');
    expect(electronConfig(29)).toBe('[Ar] 4s1 3d10');
  });
});

describe('nuclear decay', () => {
  it('solves the textbook alpha decay of polonium-210', () => {
    const r = solveDecay(el('Po'), 210, 'alpha');
    if (r.kind !== 'ok') throw new Error();
    expect(r.daughter).toMatchObject({ a: 206, z: 82 });
    expect(r.daughter.el.symbol).toBe('Pb');
    expect(toPlain(r.equation)).toBe('²¹⁰₈₄Po → ²⁰⁶₈₂Pb + ⁴₂He');
  });
  it('handles beta and positron emission', () => {
    const b = solveDecay(el('C'), 14, 'beta');
    if (b.kind !== 'ok') throw new Error();
    expect(b.daughter.el.symbol).toBe('N');
    expect(b.daughter.a).toBe(14);
    expect(toPlain(b.equation)).toContain('⁰₋₁e');
    const p = solveDecay(el('Na'), 22, 'positron');
    if (p.kind !== 'ok') throw new Error();
    expect(p.daughter.el.symbol).toBe('Ne');
    expect(toPlain(p.equation)).toContain('⁰₊₁e');
    const u = solveDecay(el('U'), 238, 'alpha');
    if (u.kind !== 'ok') throw new Error();
    expect(`${u.daughter.el.symbol}-${u.daughter.a}`).toBe('Th-234');
  });
  it('refuses impossible decays and bad mass numbers', () => {
    expect(solveDecay(el('H'), 1, 'alpha').kind).toBe('error');
    expect(solveDecay(el('H'), 1, 'positron').kind).toBe('error');
    expect(solveDecay(el('Po'), 50, 'alpha').kind).toBe('error');
  });
  it('reads nuclides and decay types typed many ways', () => {
    for (const t of ['Po-210', 'Po 210', '210Po', 'polonium-210', '84 Po 210', '210 84 Po']) {
      const n = parseNuclide(t);
      expect(n.el?.symbol, t).toBe('Po');
      expect(n.a, t).toBe(210);
    }
    expect(parseNuclide('210 84').el?.symbol).toBe('Po');
    // prose: "In" and "he" are words here, not indium and helium
    expect(parseNuclide('In alpha decay, what does Po-210 become?')).toMatchObject({ a: 210 });
    expect(parseNuclide('In alpha decay, what does Po-210 become?').el?.symbol).toBe('Po');
    expect(parseNuclide('he said carbon 14 decays').el?.symbol).toBe('C');
    expect(parseDecayType('What happens in alpha decay?')).toBe('alpha');
    expect(parseDecayType('beta decay')).toBe('beta');
    expect(parseDecayType('positron emission')).toBe('positron');
    expect(parseDecayType('β+')).toBe('positron');
  });
});
