import { describe, expect, it } from 'vitest';
import { Rational } from './rational';
import { parseLinearEquation, toStandard } from './linear';
import { solveStandardToSlope } from './standardToSlope';
import { solveSlopeFromPoints, parsePointsInput } from './slopeFromPoints';
import { toPlain, parseMarkup } from './markup';
import { evaluate, parseExpression, parseGraphable, formatNumber } from './expression';
import { parseAnswer } from './answers';
import { buildSlopeLesson, buildStandardLesson } from './lessons';
import { ALL_TOPICS, checkChallenge, generateSet, challengeFields } from './challenge';
import { detectProblem } from './detect';

const R = (s: string) => Rational.parse(s)!;
const pts = (a: string, b: string, c: string, d: string) => parsePointsInput({ x1: a, y1: b, x2: c, y2: d });

describe('Rational', () => {
  it('parses decimals and fractions exactly', () => {
    expect(R('0.1').add(R('0.2')).toString()).toBe('3/10');
    expect(R('-4/6').toString()).toBe('-2/3');
    expect(R('4/-6').toString()).toBe('-2/3');
    expect(R('.5').toString()).toBe('1/2');
    expect(R('−3').toString()).toBe('-3');
    expect(Rational.parse('abc')).toBeNull();
    expect(Rational.parse('1/0')).toBeNull();
  });
});

describe('linear parser', () => {
  it('handles flexible spacing, signs and implicit multiplication', () => {
    const cases: [string, string, string, string][] = [
      ['3x+4y=12', '3', '4', '12'],
      ['  -x   -  y = -8', '-1', '-1', '-8'],
      ['2y = 4x + 6', '-4', '2', '6'],
      ['1/2x + y = 3', '1/2', '1', '3'],
      ['3(x - 2) + y = 0', '3', '1', '6'],
      ['y - 3 = 2(x + 1)', '-2', '1', '5'],
      ['0.5x − 1.25y = 2', '1/2', '-5/4', '2'],
      ['½x + y = 3', '1/2', '1', '3'],
    ];
    for (const [src, A, B, C] of cases) {
      const p = parseLinearEquation(src);
      expect(p.ok, src).toBe(true);
      if (!p.ok) continue;
      const s = toStandard(p.value);
      expect([s.A.toString(), s.B.toString(), s.C.toString()], src).toEqual([A, B, C]);
    }
  });
  it('gives friendly errors', () => {
    for (const bad of ['3x + 4y', 'x^2 + y = 1', 'xy = 2', '3x + 4z = 1', '3x + = 2', '(3x + y = 2', 'x/y = 1']) {
      const p = parseLinearEquation(bad);
      expect(p.ok, bad).toBe(false);
    }
  });
});

describe('standard → slope-intercept', () => {
  it('solves the textbook case with exact fractions', () => {
    const r = solveStandardToSlope('3x + 4y = 12');
    expect(r.kind).toBe('slope');
    if (r.kind !== 'slope') return;
    expect(r.m.toString()).toBe('-3/4');
    expect(r.b.toString()).toBe('3');
    expect(r.answerPlain).toBe('y = -3/4x + 3');
    expect(r.steps.map((s) => s.id)).toEqual(['isolate', 'divide', 'simplify']);
  });
  it('handles negative B (sign flip)', () => {
    const r = solveStandardToSlope('2x - 3y = 6');
    if (r.kind !== 'slope') throw new Error();
    expect(r.answerPlain).toBe('y = 2/3x - 2');
  });
  it('handles B = 1, A = 0, and C = 0', () => {
    const a = solveStandardToSlope('5x + y = 7');
    if (a.kind !== 'slope') throw new Error();
    expect(a.answerPlain).toBe('y = -5x + 7');
    const h = solveStandardToSlope('0x + 2y = 8');
    if (h.kind !== 'slope') throw new Error();
    expect(h.horizontal).toBe(true);
    expect(h.answerPlain).toBe('y = 4');
    const z = solveStandardToSlope('x - y = 0');
    if (z.kind !== 'slope') throw new Error();
    expect(z.answerPlain).toBe('y = x');
  });
  it('handles vertical lines', () => {
    const r = solveStandardToSlope('4x = 10');
    expect(r.kind).toBe('vertical');
    if (r.kind !== 'vertical') return;
    expect(r.answerPlain).toContain('x = 5/2');
    expect(r.answerPlain).toContain('undefined');
  });
  it('never says "1x" in step titles or choices', () => {
    const r = solveStandardToSlope('x - y = 3');
    if (r.kind !== 'slope') throw new Error();
    expect(r.steps[0].title).toBe('Subtract x from both sides');
    const eqp = parseLinearEquation('-x + 2y = 4');
    if (!eqp.ok) throw new Error();
    const d = buildStandardLesson(eqp.value, solveStandardToSlope('-x + 2y = 4'));
    const isolate = d.find((x) => x.id === 'isolate')!;
    expect(isolate.input.kind === 'choice' && isolate.input.options.map((o) => o.label)).toContain('Add x to both sides');
    expect(isolate.check('add').ok).toBe(true);
  });
  it('rejects degenerate equations', () => {
    expect(solveStandardToSlope('x - x = 0').kind).toBe('error');
    expect(solveStandardToSlope('2y - 2y = 5').kind).toBe('error');
  });
  it('adds a collect step for non-standard input', () => {
    const r = solveStandardToSlope('2y = 4x + 6');
    if (r.kind !== 'slope') throw new Error();
    expect(r.steps[0].id).toBe('collect');
    expect(r.answerPlain).toBe('y = 2x + 3');
  });
});

describe('slope from two points', () => {
  it('computes exact slope and line', () => {
    const p = pts('2', '3', '4', '7');
    if (!p.ok) throw new Error();
    const r = solveSlopeFromPoints(p.value);
    if (r.kind !== 'slope') throw new Error();
    expect(r.m.toString()).toBe('2');
    expect(toPlain(r.line)).toBe('y = 2x - 1');
  });
  it('handles fractions, negatives, horizontal and vertical', () => {
    const p = pts('-1', '2', '3', '-4');
    if (!p.ok) throw new Error();
    const r = solveSlopeFromPoints(p.value);
    if (r.kind !== 'slope') throw new Error();
    expect(r.m.toString()).toBe('-3/2');
    const h = pts('1', '5', '9', '5');
    if (!h.ok) throw new Error();
    const hr = solveSlopeFromPoints(h.value);
    expect(hr.kind === 'slope' && hr.horizontal).toBe(true);
    const v = pts('3', '1', '3', '8');
    if (!v.ok) throw new Error();
    expect(solveSlopeFromPoints(v.value).kind).toBe('vertical');
    const same = pts('1', '1', '1', '1');
    if (!same.ok) throw new Error();
    expect(solveSlopeFromPoints(same.value).kind).toBe('error');
    const f = pts('1/2', '0.25', '3', '1');
    if (!f.ok) throw new Error();
    const fr = solveSlopeFromPoints(f.value);
    if (fr.kind !== 'slope') throw new Error();
    expect(fr.m.toString()).toBe('3/10');
  });
  it('flags bad input per field', () => {
    const p = pts('1', '', '2', '3');
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.field).toBe('y1');
  });
});

describe('markup', () => {
  it('converts to plain text and nodes', () => {
    expect(toPlain('m = {y_2 - y_1/x_2 - x_1}')).toBe('m = (y₂ - y₁)/(x₂ - x₁)');
    expect(toPlain('y = -{3/4}x + 3')).toBe('y = -3/4x + 3');
    const nodes = parseMarkup('m = {{1/2}/3}');
    expect(nodes.some((n) => n.k === 'frac')).toBe(true);
  });
});

describe('expression evaluator', () => {
  it('evaluates safely with precedence and implicit multiplication', () => {
    const ev = (s: string, x = 0) => evaluate(parseExpression(s, { allowX: true }), x);
    expect(ev('2 + 3 × 4')).toBe(14);
    expect(ev('-2^2')).toBe(-4);
    expect(ev('2(3 + 4)')).toBe(14);
    expect(ev('√(16) + 50%')).toBe(4.5);
    expect(ev('2x + 1', 3)).toBe(7);
    expect(ev('(1 + 2')).toBe(3);
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(() => parseExpression('alert(1)')).toThrow();
    // scientific
    const sci = (s: string, angle: 'rad' | 'deg' = 'deg') => evaluate(parseExpression(s), 0, angle);
    expect(sci('sin(30)')).toBeCloseTo(0.5);
    expect(sci('sin(180)')).toBe(0);
    expect(sci('asin(1)')).toBeCloseTo(90);
    expect(sci('cos(pi)', 'rad')).toBeCloseTo(-1);
    expect(sci('5!')).toBe(120);
    expect(sci('3!!')).toBe(720);
    expect(Number.isNaN(sci('2.5!'))).toBe(true);
    expect(sci('2×10^(3)')).toBe(2000);
    expect(sci('ln(e^2)')).toBeCloseTo(2);
    expect(sci('log(1000)')).toBeCloseTo(3);
  });
  it('graphs y=, x= and standard-form input', () => {
    const v = parseGraphable('x = 3');
    expect(v.kind).toBe('vertical');
    const s = parseGraphable('3x + 4y = 12');
    expect(s.kind).toBe('function');
    if (s.kind === 'function') expect(evaluate(s.node, 4)).toBeCloseTo(0);
  });
});

describe('answers and lessons', () => {
  it('parses answers', () => {
    expect(parseAnswer('m = -3/4')).toMatchObject({ kind: 'value' });
    expect(parseAnswer('undefined')).toEqual({ kind: 'undefined' });
    expect(parseAnswer('6/2')).toMatchObject({ unreduced: true });
    expect(parseAnswer('2/3')).toMatchObject({ unreduced: false });
  });
  it('slope lesson accepts reversed but consistent subtraction', () => {
    const p = pts('2', '3', '4', '7');
    if (!p.ok) throw new Error();
    const res = solveSlopeFromPoints(p.value);
    const first = buildSlopeLesson(p.value, res, {});
    const rise = first[0].check('-4');
    expect(rise.ok).toBe(true);
    const after = buildSlopeLesson(p.value, res, { rise: 'reverse' });
    expect(after[1].check('-2').ok).toBe(true);
    const wrongDir = after[1].check('2');
    expect(wrongDir.ok).toBe(false);
    expect(after[2].check('2').ok).toBe(true);
    expect(after[2].check('1/2')).toMatchObject({ ok: false, feedback: expect.stringContaining('run over rise') });
  });
  it('standard lesson gives specific feedback', () => {
    const eqp = parseLinearEquation('3x + 4y = 12');
    if (!eqp.ok) throw new Error();
    const res = solveStandardToSlope('3x + 4y = 12');
    const d = buildStandardLesson(eqp.value, res);
    expect(d.map((x) => x.id)).toEqual(['isolate', 'divide', 'slope', 'intercept']);
    expect(d[0].check('sub').ok).toBe(true);
    expect(d[2].check('3/4').ok).toBe(false);
    expect(d[3].check('12')).toMatchObject({ ok: false, feedback: expect.stringContaining('divided') });
  });
});

describe('challenge', () => {
  it('generates valid problems that its own checker can verify', () => {
    const set = ALL_TOPICS.flatMap((t) => generateSet(t, 'regular', 4, 1234));
    expect(set).toHaveLength(ALL_TOPICS.length * 4);
    for (const p of set) {
      const fields = challengeFields(p);
      expect(fields.length).toBeGreaterThan(0);
      if (p.topic === 'standard') {
        const r = solveStandardToSlope(p.equation);
        expect(r.kind).not.toBe('error');
        if (r.kind === 'slope') expect(checkChallenge(p, { m: r.m.toString(), b: r.b.toString() }).correct).toBe(true);
      } else if (p.topic === 'slope') {
        const pp = pts(p.x1, p.y1, p.x2, p.y2);
        if (!pp.ok) throw new Error();
        const r = solveSlopeFromPoints(pp.value);
        expect(r.kind).not.toBe('error');
        const ans = r.kind === 'slope' ? r.m.toString() : 'undefined';
        expect(checkChallenge(p, { m: ans }).correct).toBe(true);
      }
    }
  });
  it('is deterministic per seed', () => {
    expect(generateSet('slope', 'gentle', 5, 7)).toEqual(generateSet('slope', 'gentle', 5, 7));
  });
});

describe('problem detection', () => {
  it('routes typed problems to the right tool', () => {
    expect(detectProblem('3x + 4y = 12')?.type).toBe('standardToSlope');
    expect(detectProblem('y = 2x - 1')?.type).toBe('standardToSlope');
    expect(detectProblem('(2, 3) and (4, 7)')).toEqual({ type: 'slopeFromPoints', inputs: { x1: '2', y1: '3', x2: '4', y2: '7' } });
    expect(detectProblem('slope through (-1, 1/2) (3, -4)')?.type).toBe('slopeFromPoints');
    expect(detectProblem('x1 = 2, y1 = 3, x2 = 4, y2 = 7')?.type).toBe('slopeFromPoints');
    expect(detectProblem('what is love')).toBeNull();
    expect(detectProblem('Po-210 alpha decay')).toEqual({ type: 'nuclearDecay', inputs: { el: 'Po', a: '210', type: 'alpha' } });
    expect(detectProblem('beta decay of carbon-14')?.type).toBe('nuclearDecay');
    expect(detectProblem('Na 22 positron emission')?.inputs).toMatchObject({ el: 'Na', a: '22', type: 'positron' });
    expect(detectProblem('x^2 + y = 3')).toBeNull();
  });

  it('reads right triangles named by their corners', () => {
    // Angle E with the right angle at F: EF joins them (adjacent), DF is opposite, DE the hypotenuse.
    expect(detectProblem('In triangle EFD, right angle at F, EF = 12, ∠E = 42°.')).toEqual({ type: 'trig', inputs: { angle: '42', opp: '', adj: '12', hyp: '' } });
    expect(detectProblem('In triangle EFD, right angle at F, EF = 12, ∠E = 42°. Find DF.')?.inputs).toMatchObject({ angle: '42', adj: '12' });
    expect(detectProblem('In △PQR, ∠Q is a right angle, ∠PRQ = 30° and PR = 10. Find PQ.')).toEqual({ type: 'trig', inputs: { angle: '30', opp: '', adj: '', hyp: '10' } });
    // Asked for an angle: sides are named from that angle, and the angle box stays empty.
    expect(detectProblem('∠B = 90°, AB = 7, BC = 24. Find m∠A.')).toEqual({ type: 'trig', inputs: { angle: '', opp: '24', adj: '7', hyp: '' } });
    // Sides only: legs touch the right angle, the hypotenuse doesn't.
    expect(detectProblem('Right triangle ABC has a right angle at C. AB = 13 and AC = 5. Find BC.')).toEqual({ type: 'pythag', inputs: { a: '5', b: '', c: '13' } });
    expect(detectProblem('Triangle XYZ: angle Y = 90, XY = 6, YZ = 8')).toEqual({ type: 'pythag', inputs: { a: '6', b: '8', c: '' } });
    // An area question about a right triangle is still an area question; a cylinder isn't a circle.
    expect(detectProblem('Find the area of right triangle ABC with right angle at B, AB = 6, BC = 8')?.type).not.toMatch(/trig|pythag/);
    expect(detectProblem('Find the volume of a cylinder with radius 3 cm and height 5 cm.')).toBeNull();
    expect(detectProblem('Find the surface area of a sphere with radius 4')).toBeNull();
  });

  it('tells a line’s slope from its equation', () => {
    expect(detectProblem('Find the slope of the line through (1, 2) and (3, 8).')?.type).toBe('slopeFromPoints');
    expect(detectProblem('Write the equation of the line through (1, 2) and (3, 8).')).toEqual({ type: 'pointSlope', inputs: { mode: 'points', x1: '1', y1: '2', m: '', x2: '3', y2: '8' } });
  });
});
