import { describe, expect, it } from 'vitest';
import { ELEMENTS, findElement } from './elements';
import { TRENDS, TREND_KEYS, compareTrend, fmtTrend, trendRange, trendValue } from './trends';

const els = (...s: string[]) => s.map((x) => findElement(x)!);
const syms = (es: { symbol: string }[]) => es.map((e) => e.symbol);

describe('periodic trends', () => {
  it('has a value slot for every element', () => {
    for (const t of TREND_KEYS) expect(TRENDS[t].values).toHaveLength(ELEMENTS.length);
  });
  it('looks up and formats values', () => {
    const [f, cs, he] = els('F', 'Cs', 'He');
    expect(trendValue('en', f)).toBe(3.98);
    expect(fmtTrend('en', trendValue('en', cs))).toBe('0.79');
    expect(fmtTrend('radius', trendValue('radius', cs))).toBe('298 pm');
    expect(fmtTrend('ie', trendValue('ie', he))).toBe('2372 kJ/mol');
    expect(fmtTrend('en', trendValue('en', he))).toBe('—');
    expect(trendRange('en')).toEqual([0.7, 3.98]);
  });
  it('ranks picked elements from lowest to highest', () => {
    expect(syms(compareTrend('radius', els('Na', 'K', 'Cl')).order)).toEqual(['Cl', 'Na', 'K']);
    expect(syms(compareTrend('en', els('F', 'C', 'O')).order)).toEqual(['C', 'O', 'F']);
    expect(syms(compareTrend('ie', els('Ne', 'Na', 'Mg')).order)).toEqual(['Na', 'Mg', 'Ne']);
  });
  it('explains each step by period and group', () => {
    const r = compareTrend('radius', els('Na', 'K', 'Cl'));
    expect(r.steps.map((s) => s.exception)).toEqual([false, false]);
    expect(r.steps[0].why).toMatch(/left of Cl in period 3/);
    expect(r.steps[1].why).toMatch(/below Na in group 1/);
    expect(compareTrend('en', els('O', 'S', 'Se')).shared).toBe('group 16');
    expect(compareTrend('ie', els('Li', 'Ne')).shared).toBe('period 2');
    expect(compareTrend('ie', els('Li', 'F', 'Rb')).shared).toBeNull();
  });
  it('names the well-known exceptions', () => {
    const no = compareTrend('ie', els('N', 'O'));
    expect(syms(no.order)).toEqual(['O', 'N']);
    expect(no.steps[0]).toMatchObject({ exception: true });
    expect(no.steps[0].why).toMatch(/half-filled/);
    expect(compareTrend('ie', els('Be', 'B')).steps[0].why).toMatch(/alone in a p orbital/);
    expect(compareTrend('en', els('Ag', 'Au')).steps[0].why).toMatch(/lanthanide contraction/);
  });
  it('sets aside elements with no value, and calls ties', () => {
    const r = compareTrend('en', els('He', 'F', 'Ne'));
    expect(syms(r.order)).toEqual(['F']);
    expect(syms(r.missing)).toEqual(['He', 'Ne']);
    expect(compareTrend('ie', els('Fe', 'Ge')).steps[0]).toMatchObject({ tie: true });
  });
});
