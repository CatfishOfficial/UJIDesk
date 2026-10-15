import { describe, expect, it } from 'vitest';
import { Rational } from './rational';
import { parseMarkup, toPlain } from './markup';
import { parsePoly, polyEquals } from './poly';
import { checkNumber, fmtSurd, parseNumberList, sqrtRational, squareFree } from './surd';
import { buildPointSlopeLesson, solvePointSlope } from './pointSlope';
import { buildSystemLesson, solveSystem } from './systems';
import { buildQuadLesson, readQuadratic, solveQuadratic } from './quadratic';
import { buildFactorLesson, checkFactoredAnswer, expandFactors, solveFactoring } from './factoring';
import { buildAreaLesson, buildPythagLesson, solveArea, solvePythag } from './geometry';
import { buildTrigLesson, solveTrig } from './trig';
import { buildStatsLesson, solveStats } from './stats';
import { buildSeqLesson, solveSequence } from './sequences';
import type { LessonDecision } from './lessons';
import { detectProblem } from './detect';
import { NEW_TOPICS, TOPICS } from './challengeTopics';
import { rng } from './challenge';

const R = (s: string) => Rational.parse(s)!;
const poly = (s: string) => {
  const p = parsePoly(s);
  if (!p.ok) throw new Error(p.error);
  return p.value.poly;
};
/** Every lesson step must accept its own canonical answer ("Show me this step" relies on it). */
const selfConsistent = (ds: LessonDecision[]) => {
  expect(ds.length).toBeGreaterThan(0);
  for (const d of ds) {
    expect(d.check(d.answer).ok, `${d.id} rejects its own answer ${d.answer}`).toBe(true);
    // Every step teaches before it asks, and explains after.
    expect(d.teach?.trim(), `${d.id} has no teaching text`).toBeTruthy();
    expect(d.why?.trim(), `${d.id} has no why text`).toBeTruthy();
    // "undefined" is a real answer for slopes; anywhere else it means a value went missing.
    expect(`${d.teach} ${d.why}`).not.toMatch(/(?<!slope is |an |\*\*)undefined|NaN|\[object|\$\{/);
  }
};

describe('markup extensions', () => {
  it('superscripts, roots and upright text', () => {
    expect(toPlain('x^2 + y^3')).toBe('x² + y³');
    expect(toPlain('r^{n-1}')).toBe('rⁿ⁻¹');
    expect(toPlain('x^{10}')).toBe('x¹⁰');
    expect(toPlain('√{50}')).toBe('√50');
    expect(toPlain('{3√{2}/2}')).toBe('3√2/2');
    expect(toPlain('25 "cm²"')).toBe('25 cm²');
    const nodes = parseMarkup('2x^2 + √{3}');
    expect(nodes.some((n) => n.k === 'sup')).toBe(true);
    expect(nodes.some((n) => n.k === 'sqrt')).toBe(true);
  });
});

describe('polynomials and roots', () => {
  it('parses expressions and equations', () => {
    expect(polyEquals(poly('x^2 - 5x + 6'), [R('6'), R('-5'), R('1')])).toBe(true);
    expect(polyEquals(poly('(x - 2)(x + 3)'), [R('-6'), R('1'), R('1')])).toBe(true);
    expect(polyEquals(poly('x² = 5x − 6'), [R('6'), R('-5'), R('1')])).toBe(true);
    expect(polyEquals(poly('½x^2 + 3'), [R('3'), R('0'), R('1/2')])).toBe(true);
    expect(parsePoly('x + y').ok).toBe(false);
    expect(parsePoly('x^13').ok).toBe(false);
  });
  it('simplifies square roots exactly', () => {
    expect(squareFree(50n)).toEqual({ k: 5n, r: 2n });
    expect(fmtSurd(sqrtRational(R('50')))).toBe('5√{2}');
    expect(fmtSurd(sqrtRational(R('9/4')))).toBe('{3/2}');
    expect(fmtSurd(sqrtRational(R('1/2')))).toBe('{√{2}/2}');
  });
  it('reads typed numbers forgivingly', () => {
    const v = Math.sqrt(50);
    expect(checkNumber('5√2', v)).toBe('exact');
    expect(checkNumber('√50', v)).toBe('exact');
    expect(checkNumber('7.07', v)).toBe('rounded');
    expect(checkNumber('7.1', v)).toBe('rounded');
    expect(checkNumber('7', v)).toBe('roundMore');
    expect(checkNumber('8', v)).toBe('wrong');
    expect(checkNumber('25π', 25 * Math.PI)).toBe('exact');
    expect(checkNumber('banana', 3)).toBe('invalid');
    const list = parseNumberList('3, −1.5; 2/3 4 …');
    expect(list.ok && list.values.map(String)).toEqual(['3', '-3/2', '2/3', '4']);
  });
});

describe('point-slope form', () => {
  it('writes y − y₁ = m(x − x₁) with tidy signs', () => {
    const r = solvePointSlope({ x1: R('2'), y1: R('3'), m: R('4') });
    expect(r.kind === 'line' && r.pointSlope).toBe('y - 3 = 4(x - 2)');
    expect(r.kind === 'line' && r.b.toString()).toBe('-5');
    const n = solvePointSlope({ x1: R('-1'), y1: R('-4'), m: R('-2/3') });
    expect(n.kind === 'line' && n.pointSlope).toBe('y + 4 = -{2/3}(x + 1)');
    expect(n.kind === 'line' && n.standard).toBe('2x + 3y = -14');
  });
  it('handles two points and vertical lines', () => {
    const r = solvePointSlope({ x1: R('1'), y1: R('2'), m: null, second: { x2: R('3'), y2: R('8') } });
    expect(r.kind === 'line' && r.m.toString()).toBe('3');
    const v = solvePointSlope({ x1: R('4'), y1: R('1'), m: null, second: { x2: R('4'), y2: R('9') } });
    expect(v.kind).toBe('vertical');
    const input = { x1: R('-2'), y1: R('5'), m: R('1/2') };
    selfConsistent(buildPointSlopeLesson(input, solvePointSlope(input)));
  });
});

describe('systems of equations', () => {
  it('elimination', () => {
    const r = solveSystem('2x + 3y = 12', 'x - y = 1');
    expect(r.kind).toBe('one');
    if (r.kind !== 'one') return;
    expect([r.x!.toString(), r.y!.toString()]).toEqual(['3', '2']);
    expect(r.method).toBe('elimination');
    selfConsistent(buildSystemLesson(r, {}));
    selfConsistent(buildSystemLesson(r, { eliminate: 'x' }));
  });
  it('substitution, special cases', () => {
    const s = solveSystem('y = 2x + 1', '3x + y = 11');
    expect(s.kind === 'one' && s.method).toBe('substitution');
    expect(s.kind === 'one' && `${s.x},${s.y}`).toBe('2,5');
    if (s.kind === 'one') selfConsistent(buildSystemLesson(s, {}));
    const v = solveSystem('x = 3', '2x + y = 7');
    expect(v.kind === 'one' && `${v.x},${v.y}`).toBe('3,1');
    const none = solveSystem('y = 2x + 1', '4x - 2y = 6');
    expect(none.kind).toBe('none');
    if (none.kind === 'none') selfConsistent(buildSystemLesson(none, {}));
    expect(solveSystem('x + y = 2', '2x + 2y = 4').kind).toBe('infinite');
    expect(solveSystem('x + y = 2', 'x + y = 5').kind).toBe('none');
    expect(solveSystem('x^2 + y = 2', 'x + y = 5').kind).toBe('error');
    const f = solveSystem('x/2 + y/3 = 1', 'x - y = 7');
    expect(f.kind === 'one' && `${f.x},${f.y}`).toBe('4,-3');
  });
});

describe('quadratic formula', () => {
  const solve = (s: string) => {
    const q = readQuadratic(s);
    if (!q.ok) throw new Error(q.error);
    return solveQuadratic(q.value);
  };
  it('rational, irrational, double and complex roots', () => {
    const a = solve('x^2 - 5x + 6 = 0');
    expect(a.kind === 'ok' && a.answer).toBe('x = 2  or  x = 3');
    const b = solve('x² − 2x − 1 = 0');
    expect(b.kind === 'ok' && b.answer).toBe('x = 1 ± √{2}');
    const c = solve('4x^2 - 4x + 1');
    expect(c.kind === 'ok' && c.answer).toBe('x = {1/2}');
    const d = solve('x^2 + 1 = 0');
    expect(d.kind === 'ok' && d.answer).toBe('No real solutions');
    expect(d.kind === 'ok' && d.answerPlain).toContain('±i');
    const e = solve('x^2 - 8 = 0');
    expect(e.kind === 'ok' && e.answer).toBe('x = ±2√{2}');
    const f = solve('2x^2 + 3x - 4 = 0');
    expect(f.kind === 'ok' && f.answer).toBe('x = {-3 ± √{41}/4}');
    const g = solve('x^2/2 + x - 4 = 0');
    expect(g.kind === 'ok' && g.answer).toBe('x = -4  or  x = 2');
    const h = solve('x² = 3x + 10');
    expect(h.kind === 'ok' && h.answer).toBe('x = -2  or  x = 5');
    const i = solve('a = 1, b = -6, c = 13');
    expect(i.kind === 'ok' && i.answerPlain).toContain('3 ± 2i');
    expect(solve('3x - 6 = 0').kind).toBe('error');
    expect(solve('x^3 = 1').kind).toBe('error');
    for (const r of [a, b, c, d, e, f, g, h]) if (r.kind === 'ok') selfConsistent(buildQuadLesson(r));
  });
});

describe('factoring', () => {
  const cases: [string, string][] = [
    ['x^2 + 5x + 6', '(x + 3)(x + 2)'],
    ['2x^2 + 7x + 3', '(2x + 1)(x + 3)'],
    ['6x^2 - x - 2', '(3x - 2)(2x + 1)'],
    ['x^2 - 9', '(x + 3)(x - 3)'],
    ['x^2 + 6x + 9', '(x + 3)^2'],
    ['3x^2 + 6x', '3x(x + 2)'],
    ['-x^2 + 5x - 6', '-(x - 2)(x - 3)'],
    ['4x^2 - 16', '4(x + 2)(x - 2)'],
    ['2x^3 - 8x^2 + 6x', '2x(x - 1)(x - 3)'],
  ];
  it.each(cases)('%s → %s', (src, want) => {
    const r = solveFactoring(src);
    expect(['factored', 'gcfOnly']).toContain(r.kind);
    if (r.kind !== 'factored' && r.kind !== 'gcfOnly') return;
    expect(r.answer).toBe(want);
    expect(polyEquals(expandFactors(r.content, r.xPow, r.factors), poly(src))).toBe(true);
    selfConsistent(buildFactorLesson(r));
  });
  it('prime, GCF only, and checking typed answers', () => {
    const p = solveFactoring('x^2 + x + 1');
    expect(p.kind).toBe('prime');
    if (p.kind === 'prime') selfConsistent(buildFactorLesson(p));
    const g = solveFactoring('6x + 9');
    expect(g.kind === 'gcfOnly' && g.answer).toBe('3(2x + 3)');
    const target = poly('x^2 + 5x + 6');
    expect(checkFactoredAnswer('(x+2)(x+3)', target)).toBe('right');
    expect(checkFactoredAnswer('x^2 + 5x + 6', target)).toBe('notFactored');
    expect(checkFactoredAnswer('(x+1)(x+6)', target)).toBe('wrong');
    const eq = solveFactoring('x^2 - x - 12 = 0');
    expect(eq.kind === 'factored' && eq.roots!.map(String)).toEqual(['-3', '4']);
  });
});

describe('geometry', () => {
  it('pythagorean theorem', () => {
    const c = solvePythag({ a: '3', b: '4', c: '' });
    expect(c.kind === 'side' && c.answer).toBe('c = 5');
    const leg = solvePythag({ a: '5', b: '', c: '13' });
    expect(leg.kind === 'side' && leg.answer).toBe('b = 12');
    const irr = solvePythag({ a: '1', b: '1', c: '' });
    expect(irr.kind === 'side' && irr.answer).toBe('c = √{2} ≈ 1.41');
    expect(solvePythag({ a: '3', b: '4', c: '5' }).kind === 'check').toBe(true);
    const chk = solvePythag({ a: '4', b: '5', c: '6' });
    expect(chk.kind === 'check' && chk.right).toBe(false);
    expect(solvePythag({ a: '13', b: '', c: '5' }).kind).toBe('error');
    for (const r of [c, leg, irr]) if (r.kind === 'side') selfConsistent(buildPythagLesson(r));
  });
  it('area and perimeter', () => {
    const rect = solveArea({ shape: 'rectangle', l: '6', w: '4', unit: 'cm' });
    expect(rect.kind === 'ok' && rect.answer).toBe('A = 24 "cm²",  P = 20 "cm"');
    const tri = solveArea({ shape: 'triangle', b: '10', h: '4' });
    expect(tri.kind === 'ok' && tri.area.c.toString()).toBe('20');
    expect(tri.kind === 'ok' && tri.perimeter).toBe(null);
    const circ = solveArea({ shape: 'circle', d: '10' });
    expect(circ.kind === 'ok' && circ.answerPlain).toBe('Area 25π ≈ 78.54, circumference 10π ≈ 31.42');
    const trap = solveArea({ shape: 'trapezoid', b1: '3', b2: '5', h: '4', s1: '4', s2: '4' });
    expect(trap.kind === 'ok' && `${trap.area.c},${trap.perimeter?.c}`).toBe('16,16');
    expect(solveArea({ shape: 'rectangle', l: '6' }).kind).toBe('error');
    for (const r of [rect, tri, circ, trap]) if (r.kind === 'ok') selfConsistent(buildAreaLesson(r));
  });
  it('right-triangle trig', () => {
    const a = solveTrig({ angle: '30', hyp: '10' });
    expect(a.kind === 'ok' && a.answer).toBe('opp ≈ 5,  adj ≈ 8.66');
    const b = solveTrig({ opp: '3', adj: '4' });
    expect(b.kind === 'ok' && b.answer).toBe('A ≈ 36.9°,  hyp ≈ 5');
    const c = solveTrig({ angle: '40', adj: '12' });
    expect(c.kind === 'ok' && Math.round(c.sides.opp * 100) / 100).toBe(10.07);
    expect(solveTrig({ angle: '95', opp: '3' }).kind).toBe('error');
    expect(solveTrig({ opp: '12', hyp: '5' }).kind).toBe('error');
    expect(solveTrig({ angle: '30', opp: '1', adj: '2' }).kind).toBe('error');
    for (const r of [a, b, c]) if (r.kind === 'ok') selfConsistent(buildTrigLesson(r));
  });
});

describe('statistics', () => {
  it('mean, median, mode, range', () => {
    const r = solveStats('3, 7, 7, 2, 9');
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect([r.mean, r.median, r.range].map(String)).toEqual(['28/5', '7', '7']);
    expect(r.modes.map(String)).toEqual(['7']);
    selfConsistent(buildStatsLesson(r));
    const even = solveStats('4 1 3 2');
    expect(even.kind === 'ok' && even.median.toString()).toBe('5/2');
    expect(even.kind === 'ok' && even.modes.length).toBe(0);
    const bi = solveStats('1, 1, 2, 2, 3');
    expect(bi.kind === 'ok' && bi.modes.map(String)).toEqual(['1', '2']);
    if (bi.kind === 'ok') selfConsistent(buildStatsLesson(bi));
    expect(solveStats('5').kind).toBe('error');
  });
});

describe('sequences', () => {
  it('arithmetic and geometric', () => {
    const a = solveSequence('3, 7, 11, 15', '10');
    expect(a.kind).toBe('arithmetic');
    if (a.kind !== 'arithmetic') return;
    expect([a.step, a.next, a.an, a.sum].map(String)).toEqual(['4', '19', '39', '210']);
    expect(a.formula).toBe('a_n = 4n - 1');
    selfConsistent(buildSeqLesson(a, true));
    const g = solveSequence('2, 6, 18', '5');
    expect(g.kind === 'geometric' && [g.step, g.next, g.an].map(String)).toEqual(['3', '54', '162']);
    if (g.kind === 'geometric') selfConsistent(buildSeqLesson(g, true));
    const half = solveSequence('8, 4, 2, 1', '');
    expect(half.kind === 'geometric' && half.infinite?.toString()).toBe('16');
    expect(half.kind === 'geometric' && half.formula).toBe('a_n = 8 · ({1/2})^{n-1}');
    expect(solveSequence('1, 4, 9, 16', '').kind).toBe('error');
    expect(solveSequence('1, 2', '').kind).toBe('error');
  });
});

describe('detecting the new problem types', () => {
  it.each([
    ['x^2 - 5x + 6 = 0', 'quadratic'],
    ['factor x^2 + 5x + 6', 'factoring'],
    ['x^2 + 5x + 6', 'factoring'],
    ['2x + 3y = 12, x - y = 1', 'systems'],
    ['y = 2x + 1 and 3x + y = 11', 'systems'],
    ['mean of 3, 7, 7, 2, 9', 'stats'],
    ['3, 7, 11, 15, ...', 'sequences'],
    ['2, 6, 18, 54, ... 8th term', 'sequences'],
    ['find the 10th term of 5, 9, 13', 'sequences'],
    ['point (2, 3) slope 4', 'pointSlope'],
    ['legs 3 and 4', 'pythag'],
    ['area of a circle with radius 5', 'area'],
    ['3x + 4y = 12', 'standardToSlope'],
    ['(2, 3) and (4, 7)', 'slopeFromPoints'],
    ['Po-210 alpha decay', 'nuclearDecay'],
  ])('%s → %s', (text, type) => {
    expect(detectProblem(text)?.type).toBe(type);
  });
});

describe('practice topics for the new tools', () => {
  it.each(NEW_TOPICS)('%s: every generated problem is solvable and checks its own answer', (topic) => {
    const t = TOPICS[topic];
    for (const d of ['gentle', 'regular', 'spicy'] as const) {
      const r = rng(topic.length * 1000 + d.length);
      for (let i = 0; i < 40; i++) {
        const spec = t.generate(r, d);
        const fields = t.fields(spec);
        expect(fields.length, JSON.stringify(spec)).toBeGreaterThan(0);
        expect(t.prompt(spec).text.length).toBeGreaterThan(0);
        expect(t.hints(spec).length, JSON.stringify(spec)).toBeGreaterThan(0);
        const answers = t.answers(spec) as Record<string, string>;
        const res = t.check(spec, answers);
        for (const f of fields) expect(res[f.key]?.ok, `${topic}/${d} ${JSON.stringify(spec)} → ${JSON.stringify(answers)}: ${res[f.key]?.note}`).toBe(true);
        // A blank answer is never right.
        expect(fields.every((f) => t.check(spec, {})[f.key]?.ok)).toBe(false);
      }
    }
  });
});

import { similarProblem } from './similar';
import { solveStandardToSlope } from './standardToSlope';
import { parsePointsInput, solveSlopeFromPoints } from './slopeFromPoints';
import { buildSlopeLesson, buildStandardLesson } from './lessons';
import { parseLinearEquation } from './linear';
import { guideArea, guideFactoring, guidePythag, guideQuadratic, guideSequence, guideSlope, guideStats, guideSystem, guideTrig } from './teaching';
import { solveDecay } from '../science/decay';
import { buildDecayLesson } from '../science/decayLesson';
import { findElement } from '../science/elements';

describe('teaching', () => {
  it('slope, standard form and decay lessons teach every step', () => {
    const pts = parsePointsInput({ x1: '2', y1: '3', x2: '-4', y2: '7' });
    if (!pts.ok) throw new Error();
    const sr = solveSlopeFromPoints(pts.value);
    selfConsistent(buildSlopeLesson(pts.value, sr, {}));
    selfConsistent(buildSlopeLesson(pts.value, sr, { rise: 'reverse' }));
    const vpts = parsePointsInput({ x1: '3', y1: '1', x2: '3', y2: '8' });
    if (vpts.ok) selfConsistent(buildSlopeLesson(vpts.value, solveSlopeFromPoints(vpts.value), {}));
    for (const eq of ['3x + 4y = 12', '2y = 4x + 6', '4x = 10', 'y = 5', '-2x + y = 3']) {
      const p = parseLinearEquation(eq);
      if (!p.ok) throw new Error(eq);
      selfConsistent(buildStandardLesson(p.value, solveStandardToSlope(eq)));
    }
    for (const [sym, a, t] of [['Po', 210, 'alpha'], ['C', 14, 'beta'], ['Na', 22, 'positron']] as const) {
      const r = solveDecay(findElement(sym)!, a, t);
      if (r.kind === 'ok') selfConsistent(buildDecayLesson(r));
    }
  });

  it('every guide has a goal, an idea, a plan, a check and Khan Academy links', () => {
    const guides = [];
    const pts = parsePointsInput({ x1: '1', y1: '2', x2: '3', y2: '8' });
    if (pts.ok) {
      const r = solveSlopeFromPoints(pts.value);
      if (r.kind !== 'error') guides.push(guideSlope(pts.value, r));
    }
    const sys = solveSystem('2x + 3y = 12', 'x - y = 1');
    if (sys.kind !== 'error') guides.push(guideSystem(sys));
    const q = readQuadratic('x^2 - 5x + 6 = 0');
    if (q.ok) {
      const r = solveQuadratic(q.value);
      if (r.kind === 'ok') guides.push(guideQuadratic('x² − 5x + 6 = 0', r));
    }
    const f = solveFactoring('x^2 + 5x + 6');
    if (f.kind !== 'error') guides.push(guideFactoring('x² + 5x + 6', f));
    const py = solvePythag({ a: '3', b: '4', c: '' });
    if (py.kind === 'side') guides.push(guidePythag(py));
    for (const shape of ['rectangle', 'square', 'triangle', 'parallelogram', 'trapezoid', 'circle']) {
      const a = solveArea({ shape, l: '4', w: '3', s: '5', b: '6', h: '4', b1: '3', b2: '5', r: '2' });
      if (a.kind === 'ok') guides.push(guideArea(a));
    }
    const tr = solveTrig({ angle: '30', hyp: '10' });
    if (tr.kind === 'ok') guides.push(guideTrig(tr));
    const st = solveStats('3, 7, 7, 2, 9');
    if (st.kind === 'ok') guides.push(guideStats(st));
    const sq = solveSequence('2, 6, 18', '5');
    if (sq.kind !== 'error') guides.push(guideSequence(sq, true));
    expect(guides.length).toBe(14);
    for (const g of guides) {
      expect(g.goal && g.idea && g.check).toBeTruthy();
      expect(g.plan.length).toBeGreaterThan(1);
      expect(g.khan.length).toBeGreaterThan(0);
      for (const k of g.khan) expect(k.url).toMatch(/^https:\/\/(www|en)\.khanacademy\.org\//);
      expect(JSON.stringify(g)).not.toMatch(/undefined|NaN/);
    }
  });

  it('"another like this" always gives a fresh, solvable problem of the same kind', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s1 = similarProblem('slopeFromPoints', { x1: '0', y1: '0', x2: '1', y2: '1' }, seed)!;
      const pp = parsePointsInput(s1 as never);
      expect(pp.ok && solveSlopeFromPoints(pp.value).kind).not.toBe('error');
      expect(solveStandardToSlope(similarProblem('standardToSlope', { eq: '' }, seed)!.eq).kind).not.toBe('error');
      const ps = similarProblem('pointSlope', { mode: 'points' }, seed)!;
      expect(ps.mode).toBe('points');
      expect(solveSystem(...(Object.values(similarProblem('systems', {}, seed)!) as [string, string])).kind).toBe('one');
      const qq = readQuadratic(similarProblem('quadratic', {}, seed)!.eq);
      expect(qq.ok && solveQuadratic(qq.value).kind).toBe('ok');
      expect(solveFactoring(similarProblem('factoring', {}, seed)!.expr).kind).not.toBe('error');
      expect(solvePythag(similarProblem('pythag', {}, seed) as never).kind).toBe('side');
      for (const shape of ['rectangle', 'triangle', 'trapezoid', 'circle']) {
        const a = similarProblem('area', { shape, unit: 'cm' }, seed)!;
        expect(a.shape).toBe(shape);
        expect(solveArea(a).kind).toBe('ok');
      }
      const byAngle = similarProblem('trig', { angle: '30', hyp: '10' }, seed)!;
      expect(byAngle.angle).not.toBe('');
      expect(solveTrig(byAngle).kind).toBe('ok');
      const bySides = similarProblem('trig', { opp: '3', adj: '4' }, seed)!;
      expect(bySides.angle).toBe('');
      expect(solveTrig(bySides).kind).toBe('ok');
      expect(solveStats(similarProblem('stats', {}, seed)!.list).kind).toBe('ok');
      const sqn = similarProblem('sequences', { terms: '1, 2, 3', n: '10' }, seed)!;
      expect(sqn.n).not.toBe('');
      expect(solveSequence(sqn.terms, sqn.n).kind).not.toBe('error');
      const d = similarProblem('nuclearDecay', { type: 'beta' }, seed)!;
      expect(d.type).toBe('beta');
      expect(solveDecay(findElement(d.el)!, Number(d.a), 'beta').kind).toBe('ok');
    }
  });
});
