import { Rational } from './rational';
import { fmtR, fmtRParen, fmtSlopeIntercept, fmtTerms, type Markup } from './markup';
import type { Step } from './steps';
import type { LessonDecision } from './lessons';
import { parseAnswer } from './answers';
import { plainR } from './surd';
import { calcNum } from './calcExpr';

/**
 * Point-slope form, y − y₁ = m(x − x₁), from a point and a slope or from
 * two points. Also gives slope-intercept and standard form.
 */
export interface PointSlopeInput {
  x1: Rational;
  y1: Rational;
  /** null means the slope is undefined (a vertical line). */
  m: Rational | null;
  /** Present when the slope came from a second point. */
  second?: { x2: Rational; y2: Rational };
}

export type PointSlopeResult =
  | {
      kind: 'line';
      m: Rational;
      b: Rational;
      pointSlope: Markup;
      slopeIntercept: Markup;
      standard: Markup;
      steps: Step[];
    }
  | { kind: 'vertical'; x: Rational; steps: Step[] }
  | { kind: 'error'; message: string };

/** "y − 3", "y + 3", or just "y". */
export function shifted(v: string, k: Rational): Markup {
  if (k.isZero()) return v;
  return k.isNegative() ? `${v} + ${fmtR(k.neg())}` : `${v} - ${fmtR(k)}`;
}

/** m(x − 2) with 1, −1 and x₁ = 0 tidied away. */
export function timesShift(m: Rational, x1: Rational): Markup {
  if (x1.isZero()) return fmtTerms([{ coef: m, v: 'x' }]);
  const inner = `(${shifted('x', x1)})`;
  if (m.isOne()) return inner;
  if (m.equals(Rational.of(-1))) return `-${inner}`;
  return `${fmtR(m)}${inner}`;
}

export const pointSlopeForm = (m: Rational, x1: Rational, y1: Rational): Markup => `${shifted('y', y1)} = ${timesShift(m, x1)}`;

/** Ax + By = C with whole numbers and A ≥ 0. */
export function standardFrom(m: Rational, b: Rational): Markup {
  const lcd = (m.d * b.d) / gcdBig(m.d, b.d);
  const L = Rational.of(lcd);
  let A = m.neg().mul(L);
  let B = L;
  let C = b.mul(L);
  if (A.isNegative()) [A, B, C] = [A.neg(), B.neg(), C.neg()];
  return `${fmtTerms([{ coef: A, v: 'x' }, { coef: B, v: 'y' }])} = ${fmtR(C)}`;
}

function gcdBig(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
}

export function solvePointSlope(input: PointSlopeInput): PointSlopeResult {
  const { x1, y1, second } = input;
  let m = input.m;
  const steps: Step[] = [];

  if (second) {
    const rise = second.y2.sub(y1);
    const run = second.x2.sub(x1);
    if (rise.isZero() && run.isZero()) return { kind: 'error', message: 'Those are the same point twice. A line needs two different points.' };
    steps.push({
      id: 'slope',
      title: 'Find the slope from the two points',
      eq: run.isZero()
        ? `m = {${fmtRParen(second.y2)} - ${fmtRParen(y1)}/${fmtRParen(second.x2)} - ${fmtRParen(x1)}} = {${fmtR(rise)}/0}`
        : `m = {${fmtRParen(second.y2)} - ${fmtRParen(y1)}/${fmtRParen(second.x2)} - ${fmtRParen(x1)}} = ${fmtR(rise.div(run))}`,
      note: run.isZero() ? 'The run is 0, so the slope is undefined.' : undefined,
      lesson: 'slope',
    });
    m = run.isZero() ? null : rise.div(run);
  }

  if (m === null) {
    steps.push({
      id: 'vertical',
      title: 'An undefined slope means a vertical line',
      eq: `x = ${fmtR(x1)}`,
      note: "Point-slope form needs a number for m, so a vertical line is written as x = a number instead.",
      lesson: 'vertical',
    });
    return { kind: 'vertical', x: x1, steps };
  }

  const b = y1.sub(m.mul(x1));
  const ps = pointSlopeForm(m, x1, y1);
  const raw = `y - ${fmtRParen(y1)} = ${fmtRParen(m)}(x - ${fmtRParen(x1)})`;
  steps.push({ id: 'formula', title: 'Start from point-slope form', eq: 'y - y_1 = m(x - x_1)', lesson: 'x1' });
  steps.push({
    id: 'substitute',
    title: `Substitute m = ${plainR(m)} and the point (${plainR(x1)}, ${plainR(y1)})`,
    eq: raw,
    lesson: 'x1',
  });
  if (x1.isNegative() || y1.isNegative() || x1.isZero() || y1.isZero() || m.isOne() || m.isNegative()) {
    steps.push({
      id: 'tidy',
      title: 'Tidy the signs',
      eq: ps,
      note: x1.isNegative() || y1.isNegative() ? 'Subtracting a negative is the same as adding.' : undefined,
      lesson: 'y1',
    });
  }
  steps.push({
    id: 'distribute',
    title: 'Optional: distribute to get slope-intercept form',
    eq: `${shifted('y', y1)} = ${fmtTerms([{ coef: m, v: 'x' }, { coef: m.mul(x1).neg() }])}`,
    lesson: 'b',
  });
  steps.push({
    id: 'isolate',
    title: y1.isZero() ? 'y is already alone' : y1.isNegative() ? `Subtract ${plainR(y1.neg())} from both sides` : `Add ${plainR(y1)} to both sides`,
    eq: fmtSlopeIntercept(m, b),
    lesson: 'b',
  });

  return { kind: 'line', m, b, pointSlope: ps, slopeIntercept: fmtSlopeIntercept(m, b), standard: standardFrom(m, b), steps };
}

export function buildPointSlopeLesson(input: PointSlopeInput, r: PointSlopeResult): LessonDecision[] {
  if (r.kind === 'error') return [];
  const { x1, y1, second } = input;
  const out: LessonDecision[] = [];

  if (second) {
    const rise = second.y2.sub(y1);
    const run = second.x2.sub(x1);
    out.push({
      id: 'slope',
      teach: 'Point-slope form needs a slope and one point. You have two points, so start by finding the slope: rise over run.',
      why: run.isZero() ? 'The run is 0, so the slope is undefined.' : `Rise ${plainR(rise)} over run ${plainR(run)} is ${plainR(rise.div(run))}.`,
      answer: run.isZero() ? 'undefined' : rise.div(run).toString(),
      prompt: 'First we need the slope. Rise over run between the two points?',
      context: `(${fmtR(x1)}, ${fmtR(y1)}) and (${fmtR(second.x2)}, ${fmtR(second.y2)})`,
      input: { kind: 'number', label: 'm' },
      helper: 'calculator',
      calc: `(${calcNum(second.y2)} − ${calcNum(y1)}) ÷ (${calcNum(second.x2)} − ${calcNum(x1)})`,
      hints: ['$m = {y_2 - y_1/x_2 - x_1}$', `Rise ${plainR(rise)}, run ${plainR(run)}.`],
      after: run.isZero() ? 'm is undefined' : `m = ${fmtR(rise.div(run))}`,
      check: (raw) => {
        const a = parseAnswer(raw);
        if (!a) return { ok: false, feedback: 'Try a number or fraction, like 2 or -3/4.' };
        if (run.isZero()) return a.kind === 'undefined' ? { ok: true } : { ok: false, feedback: 'The run is 0 here. What happens when you divide by zero?' };
        if (a.kind === 'undefined') return { ok: false, feedback: "The x-values differ, so the slope is a real number." };
        const m = rise.div(run);
        if (a.v.equals(m)) return { ok: true };
        if (!m.isZero() && a.v.equals(m.recip())) return { ok: false, feedback: "That's run over rise. The change in y goes on top." };
        if (a.v.equals(m.neg())) return { ok: false, feedback: 'Right size, wrong sign. Subtract in the same order top and bottom.' };
        return { ok: false, feedback: `Rise is ${plainR(rise)} and run is ${plainR(run)}.` };
      },
    });
  }

  if (r.kind === 'vertical') {
    out.push({
      id: 'vertical',
      teach: 'An undefined slope means the run is 0: x never changes along the line.',
      why: `Every point on the line has x = ${plainR(x1)}, so its equation is x = ${plainR(x1)}.`,
      answer: 'vertical',
      prompt: 'The slope is undefined. What kind of line goes through the point?',
      context: `(${fmtR(x1)}, ${fmtR(y1)})`,
      input: {
        kind: 'choice',
        options: [
          { id: 'vertical', label: `A vertical line, $x = ${fmtR(x1)}$` },
          { id: 'horizontal', label: `A horizontal line, $y = ${fmtR(y1)}$` },
        ],
      },
      hints: ['Undefined slope: the run is zero, so x never changes.'],
      after: `x = ${fmtR(x1)}`,
      check: (id) => (id === 'vertical' ? { ok: true } : { ok: false, feedback: 'Horizontal lines have slope 0. Undefined slope means x stays the same.' }),
    });
    return out;
  }

  const m = r.m;
  const rightX = timesShift(m, x1);
  const xOptions = [
    { id: 'right', label: `$${rightX}$` },
    { id: 'sign', label: `$${timesShift(m, x1.neg())}$` },
    { id: 'swap', label: `$${timesShift(m, y1)}$` },
  ].filter((o, i, arr) => arr.findIndex((p) => p.label === o.label) === i);
  if (xOptions.length > 1) {
    out.push({
      id: 'x1',
      teach: 'Point-slope form, $y - y_1 = m(x - x_1)$, says: how far y is from your point equals the slope times how far x is from your point. Build the right side: the slope, times x minus the point’s x-coordinate.',
      why: x1.isNegative() ? `x − (${plainR(x1)}) becomes x + ${plainR(x1.neg())}: subtracting a negative is adding.` : x1.isZero() ? 'x − 0 is just x.' : `x₁ = ${plainR(x1)}, so the bracket is (x − ${plainR(x1)}).`,
      answer: 'right',
      prompt: `Point-slope form is $y - y_1 = m(x - x_1)$. Using m = $${fmtR(m)}$ and the point, what goes on the right side?`,
      context: `(${fmtR(x1)}, ${fmtR(y1)})`,
      input: { kind: 'choice', options: xOptions },
      hints: ['x₁ is the x-coordinate of the point, and it gets subtracted from x.', x1.isNegative() ? `x − (${plainR(x1)}) becomes x + ${plainR(x1.neg())}.` : `x − ${plainR(x1)}.`],
      after: `y - y_1 = ${rightX}`,
      check: (id) =>
        id === 'right'
          ? { ok: true }
          : id === 'sign'
            ? { ok: false, feedback: x1.isNegative() ? 'Subtracting a negative turns into adding. Check that sign.' : 'The formula subtracts x₁, so the sign inside is minus.' }
            : { ok: false, feedback: "That's the y-coordinate. The parentheses hold x and x₁." },
    });
  }

  const ps = pointSlopeForm(m, x1, y1);
  const yOptions = [
    { id: 'right', label: `$${ps}$` },
    { id: 'sign', label: `$${shifted('y', y1.neg())} = ${rightX}$` },
    { id: 'swap', label: `$${shifted('y', x1)} = ${rightX}$` },
  ].filter((o, i, arr) => arr.findIndex((p) => p.label === o.label) === i);
  if (yOptions.length > 1) {
    out.push({
      id: 'y1',
      teach: 'Same idea on the left side: y minus the point’s y-coordinate.',
      why: `Check: x = ${plainR(x1)} makes the right side 0 and y = ${plainR(y1)} makes the left side 0, so the point fits.`,
      answer: 'right',
      prompt: 'Now the left side, $y - y_1$. Which is the finished equation?',
      input: { kind: 'choice', options: yOptions },
      hints: [`y₁ is ${plainR(y1)}.`],
      after: ps,
      check: (id) =>
        id === 'right'
          ? { ok: true }
          : id === 'sign'
            ? { ok: false, feedback: y1.isNegative() ? 'y − (negative) becomes y plus. Look at the sign again.' : 'The formula subtracts y₁ from y.' }
            : { ok: false, feedback: "That used the x-coordinate. The left side uses y₁." },
    });
  }

  out.push({
    id: 'b',
    teach: 'To get slope-intercept form, distribute the slope across the bracket, then move y₁ to the right side.',
    why: `It’s the same line, written as $${r.slopeIntercept}$.`,
    answer: r.b.toString(),
    optional: true,
    prompt: 'Bonus: solve for y. What is the y-intercept $b$?',
    context: ps,
    input: { kind: 'number', label: 'b' },
    helper: 'calculator',
    calc: `${calcNum(y1)} − ${calcNum(m)} × ${calcNum(x1)}`,
    hints: ['Distribute m, then move y₁ to the right side.', `b = y₁ − m·x₁ = ${plainR(y1)} − (${plainR(m)})(${plainR(x1)}).`],
    after: r.slopeIntercept,
    check: (raw) => {
      const a = parseAnswer(raw);
      if (!a || a.kind !== 'value') return { ok: false, feedback: 'Try a number or fraction.' };
      if (a.v.equals(r.b)) return { ok: true };
      if (a.v.equals(y1.add(m.mul(x1)))) return { ok: false, feedback: 'Close: distributing gives −m·x₁, so subtract it.' };
      return { ok: false, feedback: `Multiply ${plainR(m)} by ${plainR(x1)}, then subtract that from ${plainR(y1)}.` };
    },
  });
  return out;
}
