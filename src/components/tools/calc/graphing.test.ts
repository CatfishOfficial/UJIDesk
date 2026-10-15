import { describe, expect, it } from 'vitest';
import { fmtNum, initialG, plotG, pressG, screenRows, toFrac, traceText, type GState } from './graphingEngine';
import { guideKeys } from './guide';
import { answerText, entryMarkup, initialE, pressE, type EState } from './examEngine';

const run = (keys: string, s: GState = initialG()) => keys.split(' ').filter(Boolean).reduce(pressG, s);
const lastOut = (s: GState) => s.hist[s.hist.length - 1]?.out;
const text = (s: GState) => screenRows(s).map((r) => r.map((c) => c.ch).join(''));

describe('graphing calculator', () => {
  it('does arithmetic and keeps Ans', () => {
    let s = run('2 add 3 enter');
    expect(lastOut(s)).toBe('5');
    s = run('mul 4 enter', s); // a leading operator means Ans ×
    expect(s.hist[1].in).toEqual(['Ans', '*', '4']);
    expect(lastOut(s)).toBe('20');
    expect(lastOut(run('neg 3 mul 4 enter'))).toBe('⁻12');
  });
  it('tells (−) from − the way the real one does', () => {
    const s = run('2 mul sub 3 enter');
    expect(s.screen).toBe('err');
    expect(text(s)[0]).toContain('ERR:SYNTAX');
    expect(run('1', s).screen).toBe('home');
    expect(lastOut(run('2 mul neg 3 enter'))).toBe('⁻6');
  });
  it('uses 2nd functions, radians by default, degrees from MODE', () => {
    expect(lastOut(run('2nd sq 1 6 rparen enter'))).toBe('4');
    expect(lastOut(run('sin 9 0 rparen enter'))).toBe('.8939966636');
    const deg = run('mode down down right enter quit sin 9 0 rparen enter');
    expect(deg.angle).toBe('deg');
    expect(lastOut(deg)).toBe('1');
  });
  it('converts to fractions from the MATH menu', () => {
    expect(lastOut(run('1 div 3 math enter enter'))).toBe('1/3');
    expect(toFrac(0.75)).toEqual([3, 4]);
  });
  it('formats like the screen', () => {
    expect(fmtNum(123456789012, { fix: null, sci: false })).toBe('1.23456789ᴇ11');
    expect(fmtNum(0.0001, { fix: null, sci: false })).toBe('1ᴇ⁻4');
    expect(fmtNum(2 / 3, { fix: 2, sci: false })).toBe('.67');
  });
  it('graphs, traces and tabulates Y=', () => {
    let s = run('yeq 2 xt add 1 graph');
    expect(s.ys[0]).toEqual(['2', 'X', '+', '1']);
    const { px } = plotG(s);
    expect(px.reduce((a, b) => a + b, 0)).toBeGreaterThan(150);
    s = run('zoom 4', s); // ZDecimal: one pixel is 0.1
    expect(s.win.xmax).toBe(4.7);
    s = run('trace right right', s);
    expect(traceText(s).bottom).toMatch(/^X=\.2\s+Y=1\.4/);
    expect(run('right', s)).toBeTruthy();
    s = run('2nd graph', s);
    expect(s.screen).toBe('table');
    expect(text(s)[1]).toContain('│    1');
  });
  it('maps lesson guides onto its keys', () => {
    const g = guideKeys('(−5)² − 4 × 1 × 6', 'graphing');
    expect(g.ok && g.keys.map((k) => k.id)).toEqual(['lparen', 'neg', '5', 'rparen', 'sq', 'sub', '4', 'mul', '1', 'mul', '6', 'enter']);
    const t = guideKeys('tan⁻¹(3 ÷ 4)', 'graphing');
    expect(t.ok && t.keys.slice(0, 2).map((k) => k.id)).toEqual(['2nd', 'tan']);
    expect(guideKeys('10 × sin(35)', 'basic').ok).toBe(false);
  });
});

describe('exam calculator', () => {
  const runE = (keys: string, s: EState = initialE()) => keys.split(' ').filter(Boolean).reduce(pressE, s);
  it('keeps fractions exact until you toggle', () => {
    let s = runE('1 frac 2 add 1 frac 3 enter');
    expect(answerText(s).markup).toBe('{5/6}');
    s = runE('fd', s);
    expect(answerText(s).plain).toBe('0.8333333333');
    expect(entryMarkup(['6', '÷', '1', '⁄', '2'])).toBe('6÷{1/2}');
    expect(runE('6 div 1 frac 2 enter').shown?.v).toBe(12);
  });
  it('degrees by default, (−) vs −, and Ans', () => {
    expect(runE('sin 3 0 rparen enter').shown?.v).toBeCloseTo(0.5);
    expect(runE('2 mul sub 3 enter').err).toBe('SYNTAX');
    expect(runE('2 mul neg 3 enter').shown?.v).toBe(-6);
    expect(runE('5 enter add 1 enter').shown?.v).toBe(6);
    expect(runE('2nd sq 4 9 rparen enter').shown?.v).toBe(7);
  });
});
