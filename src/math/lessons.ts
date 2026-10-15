import { Rational } from './rational';
import { fmtR, fmtRParen, fmtSlopeIntercept, fmtTerms, type Markup } from './markup';
import { parseAnswer, sameValue } from './answers';
import type { PointsInput, SlopeResult } from './slopeFromPoints';
import { xTerm, type StandardResult } from './standardToSlope';
import { isAlreadyStandard, type LinearEquation } from './linear';
import { calcNum } from './calcExpr';

/**
 * A lesson is a list of decisions. Prompts use $…$ for inline math markup.
 * Decisions are rebuilt deterministically from the problem, so only the step
 * index and accepted answers need to be stored.
 */
export interface LessonDecision {
  id: string;
  /** Teaching before the question: the idea behind this step, in plain words (rich text). */
  teach?: string;
  /** Once answered: why that's the answer. Together these read like a worked solution. */
  why?: string;
  prompt: string;
  /** Crisp equation showing where we are before answering. */
  context?: Markup;
  input: { kind: 'number'; label: string } | { kind: 'choice'; options: { id: string; label: string }[] };
  check: (answer: string) => CheckResult;
  hints: string[];
  /** Crisp result revealed once this decision is made. */
  after: Markup;
  /** An optional tool that can help with this decision. */
  helper?: 'calculator' | 'graph' | 'scratchpad';
  /** What to type on the calculator, e.g. "10 × sin(35)"; the calculator highlights the keys. */
  calc?: string;
  optional?: boolean;
  /** Canonical answer (a number string or a choice id), used when the student asks to be shown. */
  answer: string;
}

export type CheckResult =
  | { ok: true; feedback?: string; value?: string }
  | { ok: false; feedback: string };

export type Accepted = Record<string, string | undefined>;

const p = (r: Rational) => fmtR(r);

// ─── Slope from two points ──────────────────────────────────────────

export function buildSlopeLesson(pt: PointsInput, result: SlopeResult, accepted: Accepted): LessonDecision[] {
  if (result.kind === 'error') return [];
  const { x1, y1, x2, y2 } = pt;
  const rise = y2.sub(y1);
  const run = x2.sub(x1);
  const reversed = accepted.rise === 'reverse';
  const expectedRun = reversed ? run.neg() : run;
  const shownRise = reversed ? rise.neg() : rise;

  const decisions: LessonDecision[] = [
    {
      id: 'rise',
      teach: 'Slope compares how far a line goes **up or down** with how far it goes **across**. Start with the up-or-down part: subtract the y-coordinates, second point minus first.',
      why: reversed ? `Going from point 2 to point 1, y changes by ${fmtPlain(rise.neg())}.` : `From y = ${fmtPlain(y1)} to y = ${fmtPlain(y2)} is a change of ${fmtPlain(rise)}${rise.isZero() ? ': no change at all' : rise.isNegative() ? ', so the line goes down' : ', so the line goes up'}.`,
      answer: rise.toString(),
      prompt: 'How far up or down do we go between the points? That is the **rise**, the change in $y$.',
      context: `(${p(x1)}, ${p(y1)}) and (${p(x2)}, ${p(y2)})`,
      input: { kind: 'number', label: 'rise' },
      helper: 'calculator',
      calc: `${calcNum(y2)} − ${calcNum(y1)}`,
      hints: [
        'Subtract the y-values. Order matters only in that you have to stay consistent.',
        `$y_2 - y_1 = ${fmtRParen(y2)} - ${fmtRParen(y1)}$`,
      ],
      after: `rise = ${fmtRParen(reversed ? y1 : y2)} - ${fmtRParen(reversed ? y2 : y1)} = ${p(shownRise)}`,
      check: (raw) => {
        const a = parseAnswer(raw);
        if (!a || a.kind !== 'value') return { ok: false, feedback: 'Try a number, like 4 or -3.' };
        if (a.v.equals(rise)) return { ok: true, value: 'forward' };
        if (a.v.equals(rise.neg()))
          return {
            ok: true,
            value: 'reverse',
            feedback: "That's y₁ − y₂, going from the second point back to the first. That works, as long as the run goes the same way.",
          };
        if (a.v.equals(run) || a.v.equals(run.neg()))
          return { ok: false, feedback: "That's the change in x, which is the run. Rise is the change in y." };
        if (a.v.equals(y2.add(y1)))
          return { ok: false, feedback: 'Looks like the y-values got added. Rise is a difference, so subtract.' };
        return { ok: false, feedback: `Not quite. Line up the y-values: ${fmtPlain(y2)} and ${fmtPlain(y1)}.` };
      },
    },
    {
      id: 'run',
      teach: 'Now the across part: subtract the x-coordinates in the **same order** you used for y, so both changes are measured from the same starting point.',
      why: `${reversed ? `${pp(x1)} − ${pp(x2)}` : `${pp(x2)} − ${pp(x1)}`} = ${fmtPlain(expectedRun)}${expectedRun.isZero() ? ': the points are straight above each other' : expectedRun.isNegative() ? ', to the left' : ', to the right'}.`,
      answer: expectedRun.toString(),
      prompt: reversed
        ? 'Now the **run**, the change in $x$. Your rise went from point 2 to point 1, so keep that same direction.'
        : 'Now the **run**, the change in $x$, in the same order.',
      context: `rise = ${p(shownRise)}`,
      input: { kind: 'number', label: 'run' },
      helper: 'calculator',
      calc: reversed ? `${calcNum(x1)} − ${calcNum(x2)}` : `${calcNum(x2)} − ${calcNum(x1)}`,
      hints: [
        'Subtract the x-values in the same order you used for y.',
        reversed ? `$x_1 - x_2 = ${fmtRParen(x1)} - ${fmtRParen(x2)}$` : `$x_2 - x_1 = ${fmtRParen(x2)} - ${fmtRParen(x1)}$`,
      ],
      after: `run = ${fmtRParen(reversed ? x1 : x2)} - ${fmtRParen(reversed ? x2 : x1)} = ${p(expectedRun)}`,
      check: (raw) => {
        const a = parseAnswer(raw);
        if (!a || a.kind !== 'value') return { ok: false, feedback: 'Try a number, like 2 or -5.' };
        if (a.v.equals(expectedRun)) return { ok: true };
        if (!expectedRun.isZero() && a.v.equals(expectedRun.neg()))
          return {
            ok: false,
            feedback: reversed
              ? 'That subtracts in the opposite order from your rise. Both have to go from point 2 to point 1.'
              : 'That subtracts in the opposite order from your rise. Both have to go from point 1 to point 2.',
          };
        if (a.v.equals(shownRise)) return { ok: false, feedback: "That's the rise again. The run uses the x-values." };
        return { ok: false, feedback: `Close. Look at just the x-values: ${fmtPlain(x1)} and ${fmtPlain(x2)}.` };
      },
    },
  ];

  if (run.isZero()) {
    decisions.push({
      id: 'divide',
      teach: 'Slope is rise ÷ run, but here the run is 0: the two points sit directly above each other.',
      why: 'You can’t divide by zero, so the slope is **undefined**. Every point on the line has the same x, which makes it a vertical line.',
      answer: 'undefined',
      prompt: 'The run is $0$. What does that make the slope?',
      context: `m = {${p(shownRise)}/0}`,
      input: {
        kind: 'choice',
        options: [
          { id: 'undefined', label: 'Undefined: a vertical line' },
          { id: 'zero', label: 'Zero: a horizontal line' },
          { id: 'rise', label: `Just the rise, ${fmtPlain(shownRise)}` },
        ],
      },
      hints: ['What happens when you try to divide by zero?'],
      after: `m is undefined; the line is x = ${p(x1)}`,
      check: (id) =>
        id === 'undefined'
          ? { ok: true, feedback: "You can't divide by zero. Both points share the same x, so the line goes straight up and down." }
          : id === 'zero'
            ? { ok: false, feedback: 'Zero slope happens when the rise is 0, which gives a flat line. Here the run is 0.' }
            : { ok: false, feedback: "Dividing by 0 doesn't leave the top unchanged. Division by zero has no answer." },
    });
    return decisions;
  }

  const m = rise.div(run);
  decisions.push({
    id: 'divide',
    teach: 'Slope is rise over run, $m = {rise/run}$: how much y changes for every 1 step to the right.',
    why: slopeMeaning(m),
    answer: m.toString(),
    prompt: 'Slope is rise over run. Divide, and simplify if you can.',
    context: `m = {${p(shownRise)}/${p(expectedRun)}}`,
    input: { kind: 'number', label: 'm' },
    helper: 'calculator',
    calc: `${calcNum(shownRise)} ÷ ${calcNum(expectedRun)}`,
    hints: [
      'Top divided by bottom. A fraction answer like 2/3 is totally fine.',
      expectedRun.isNegative() ?'A negative on the bottom can move up front: 4/(−2) is the same as −4/2.' : 'Reduce the fraction by any common factor.',
    ],
    after: `m = ${p(m)}`,
    check: (raw) => {
      const a = parseAnswer(raw);
      if (!a) return { ok: false, feedback: 'Try a number or fraction, like 3 or -2/5.' };
      if (a.kind === 'undefined') return { ok: false, feedback: "The run isn't zero, so the slope is a real number." };
      if (a.v.equals(m)) {
        return a.unreduced
          ? { ok: true, feedback: `Right, and that simplifies to ${fmtPlain(m)}.` }
          : { ok: true };
      }
      if (!m.isZero() && a.v.equals(m.recip()) && !m.abs().isOne())
        return { ok: false, feedback: "That's run over rise. Flip it: the rise goes on top." };
      if (!m.isZero() && a.v.equals(m.neg())) return { ok: false, feedback: 'Right size, wrong sign. Check the signs on the top and bottom.' };
      return { ok: false, feedback: `Divide ${fmtPlain(shownRise)} by ${fmtPlain(expectedRun)}.` };
    },
  });

  if (result.kind === 'slope') {
    decisions.push({
      id: 'line',
      teach: 'The y-intercept b is where the line crosses the y-axis, where x = 0. Every point on the line fits $y = mx + b$, so put in one point and solve for b.',
      why: `${fmtPlain(y1)} = ${fmtPlain(m)} × ${pp(x1)} + b, so b = ${fmtPlain(result.b)}.`,
      answer: result.b.toString(),
      optional: true,
      prompt: 'Bonus: where does the line cross the y-axis? Use $b = y_1 - m x_1$.',
      context: `b = ${fmtRParen(y1)} - ${fmtRParen(m)}(${p(x1)})`,
      input: { kind: 'number', label: 'b' },
      helper: 'calculator',
      calc: `${calcNum(y1)} − ${calcNum(m)} × ${calcNum(x1)}`,
      hints: [`First multiply: ${fmtPlain(m)} × ${fmtPlain(x1)} = ${fmtPlain(m.mul(x1))}.`, `Then ${fmtPlain(y1)} − ${fmtPlain(m.mul(x1))}.`],
      after: fmtSlopeIntercept(m, result.b),
      check: (raw) => {
        const a = parseAnswer(raw);
        if (!a || a.kind !== 'value') return { ok: false, feedback: 'Try a number.' };
        if (a.v.equals(result.b)) return { ok: true };
        if (a.v.equals(y1.add(m.mul(x1)))) return { ok: false, feedback: 'That added m·x₁. Subtract it instead.' };
        return { ok: false, feedback: `Not quite. Multiply m by x₁ first, then subtract that from ${fmtPlain(y1)}.` };
      },
    });
  }
  return decisions;
}

// ─── Standard form to slope-intercept ───────────────────────────────

export function buildStandardLesson(eq: LinearEquation, result: StandardResult): LessonDecision[] {
  if (result.kind === 'error') return [];
  const { A, B, C } = result;
  const decisions: LessonDecision[] = [];
  const std = `${fmtTerms([{ coef: A, v: 'x' }, { coef: B, v: 'y' }])} = ${p(C)}`;

  if (!isAlreadyStandard(eq)) {
    const options = [{ id: 'right', label: `$${std}$` }];
    if (!C.isZero()) options.push({ id: 'signC', label: `$${fmtTerms([{ coef: A, v: 'x' }, { coef: B, v: 'y' }])} = ${p(C.neg())}$` });
    if (!A.isZero()) options.push({ id: 'signA', label: `$${fmtTerms([{ coef: A.neg(), v: 'x' }, { coef: B, v: 'y' }])} = ${p(C)}$` });
    decisions.push({
      id: 'collect',
      teach: 'Standard form keeps the x and y terms on the left and the plain number on the right: $Ax + By = C$. To move a term across the equals sign, do the opposite operation to both sides; that flips its sign.',
      why: 'Every term that crossed the equals sign changed sign. Nothing else changed.',
      answer: 'right',
      prompt: "First, let's tidy it into standard form: x and y terms on the left, numbers on the right. Which is it?",
      input: { kind: 'choice', options: shuffleStable(options, A.n + C.n) },
      hints: ['When a term crosses the equals sign, its sign flips.'],
      after: std,
      check: (id) =>
        id === 'right'
          ? { ok: true }
          : { ok: false, feedback: 'One term crossed the equals sign without flipping its sign. Moving it means doing the opposite operation on both sides.' },
    });
  }

  if (B.isZero()) {
    decisions.push({
      id: 'isolate',
      teach: 'To get to $y = mx + b$ we’ll solve for y. But first: is there a y to solve for?',
      why: 'Only x is pinned down, to a single value. Every point on the line has that x, so it’s vertical, with an undefined slope.',
      answer: 'vertical',
      prompt: 'There is no $y$ in this equation at all. What kind of line is that?',
      context: std,
      input: {
        kind: 'choice',
        options: [
          { id: 'vertical', label: 'Vertical: x stays the same everywhere' },
          { id: 'horizontal', label: 'Horizontal: y stays the same everywhere' },
          { id: 'none', label: "It isn't a line" },
        ],
      },
      hints: ['If only x is pinned down, y is free to be anything.'],
      after: std,
      check: (id) =>
        id === 'vertical'
          ? { ok: true, feedback: "Right. And a vertical line has no slope-intercept form, because its slope is undefined." }
          : id === 'horizontal'
            ? { ok: false, feedback: 'Horizontal lines look like y = 3. Here x is the one pinned down.' }
            : { ok: false, feedback: 'It is a line, just a special one. Every point has the same x.' },
    });
    if (result.kind === 'vertical' && !A.isOne()) {
      decisions.push({
        id: 'divide',
        teach: `x is being multiplied by ${fmtPlain(A)}. Undo that by dividing both sides by ${fmtPlain(A)}.`,
        why: `x = ${fmtPlain(C)} ÷ ${pp(A)} = ${fmtPlain(result.xValue)}.`,
        answer: result.xValue.toString(),
        prompt: 'Divide both sides by the coefficient of $x$. What is $x$?',
        context: std,
        input: { kind: 'number', label: 'x' },
        helper: 'calculator',
        calc: `${calcNum(C)} ÷ ${calcNum(A)}`,
        hints: [`Divide ${fmtPlain(C)} by ${fmtPlain(A)}.`],
        after: `x = ${p(result.xValue)}`,
        check: (raw) => {
          const a = parseAnswer(raw);
          if (!a || a.kind !== 'value') return { ok: false, feedback: 'Try a number or fraction.' };
          if (a.v.equals(result.xValue)) return { ok: true };
          if (a.v.equals(A.div(C))) return { ok: false, feedback: 'That one is upside down: C goes on top, A on the bottom.' };
          return { ok: false, feedback: `Divide ${fmtPlain(C)} by ${fmtPlain(A)}.` };
        },
      });
    }
    return decisions;
  }

  if (result.kind !== 'slope') return decisions;
  const { m, b } = result;
  const isolated = `${fmtTerms([{ coef: B, v: 'y' }])} = ${fmtTerms([{ coef: A.neg(), v: 'x' }, { coef: C }])}`;

  if (!A.isZero()) {
    const mag = xTerm(A.abs());
    decisions.push({
      id: 'isolate',
      teach: 'Goal: y by itself. Work backwards from y: first move the x-term to the other side with the **opposite operation**, done to both sides; then deal with the number multiplying y.',
      why: `${A.isNegative() ? 'Adding' : 'Subtracting'} ${mag} on both sides cancels it on the left and keeps the equation balanced.`,
      answer: A.isNegative() ? 'add' : 'sub',
      prompt: 'Goal: get $y$ by itself. What should happen to the $x$-term first?',
      context: std,
      input: {
        kind: 'choice',
        options: [
          { id: 'sub', label: `Subtract ${mag} from both sides` },
          { id: 'add', label: `Add ${mag} to both sides` },
          { id: 'div', label: `Divide both sides by ${fmtPlain(A)}` },
        ],
      },
      hints: ['Undo the x-term with the opposite operation, on both sides.'],
      after: isolated,
      check: (id) => {
        const right = A.isNegative() ? 'add' : 'sub';
        if (id === right) return { ok: true };
        if (id === 'div') return { ok: false, feedback: "Dividing by the x-coefficient doesn't move x out of the way. First clear the x-term from the left." };
        return {
          ok: false,
          feedback: A.isNegative()
            ? `The x-term is negative, so adding ${mag} is what cancels it out.`
            : `That would double the x-term instead of cancelling it. Do the opposite.`,
        };
      },
    });
  } else {
    decisions.push({
      id: 'isolate',
      teach: 'Goal: y by itself. Notice anything missing from this equation?',
      why: 'With no x-term, y comes out the same whatever x is: a horizontal line, slope 0.',
      answer: 'horizontal',
      prompt: 'There is no $x$-term. What does that tell you about the line?',
      context: std,
      input: {
        kind: 'choice',
        options: [
          { id: 'horizontal', label: 'Horizontal: slope 0' },
          { id: 'vertical', label: 'Vertical: slope undefined' },
          { id: 'none', label: "It isn't a line" },
        ],
      },
      hints: ['If x can be anything and y is fixed, which way does the line run?'],
      after: isolated,
      check: (id) =>
        id === 'horizontal'
          ? { ok: true, feedback: 'Yes. y is the same no matter what x is, so the slope is 0.' }
          : { ok: false, feedback: 'Vertical lines have no y-term. Here y is the one pinned down.' },
    });
  }

  if (!B.isOne()) {
    decisions.push({
      id: 'divide',
      teach: `y is still being multiplied by ${fmtPlain(B)}. Undo that by dividing **every** term, on both sides, by ${fmtPlain(B)}.`,
      why: 'Dividing every term keeps the equation balanced, and now y is alone.',
      answer: B.toString(),
      prompt: 'To get $y$ completely alone, what do you divide every term by?',
      context: isolated,
      input: { kind: 'number', label: 'divide by' },
      hints: ['Look at the number attached to y, sign included.'],
      after: fmtSlopeIntercept(m, b),
      check: (raw) => {
        const a = parseAnswer(raw);
        if (!a || a.kind !== 'value') return { ok: false, feedback: 'Try a number.' };
        if (a.v.equals(B)) return { ok: true };
        if (a.v.equals(B.neg())) return { ok: false, feedback: `Almost. The coefficient on y is ${fmtPlain(B)}, and its sign comes along too.` };
        if (a.v.equals(A)) return { ok: false, feedback: "That's the x-coefficient. We want y alone, so divide by y's number." };
        return { ok: false, feedback: "Divide by whatever is multiplying y." };
      },
    });
  }

  decisions.push({
    id: 'slope',
    teach: 'In $y = mx + b$, the number multiplying x is the slope m: how much y changes each time x goes up by 1.',
    why: slopeMeaning(m),
    answer: m.toString(),
    prompt: 'Read off the slope $m$, the number in front of $x$.',
    context: B.isOne() ? isolated : undefined,
    input: { kind: 'number', label: 'm' },
    hints: ['In y = mx + b, the slope is the coefficient on x.', `It's −A ÷ B here: ${fmtPlain(A.neg())} ÷ ${fmtPlain(B)}.`],
    after: `m = ${p(m)}`,
    check: (raw) => {
      const a = parseAnswer(raw);
      if (!a) return { ok: false, feedback: 'Try a number or fraction, like -3/4.' };
      if (a.kind === 'undefined') return { ok: false, feedback: "There is a y-term, so this line isn't vertical. Its slope is a real number." };
      if (a.v.equals(m)) return a.unreduced ? { ok: true, feedback: `Yes, which simplifies to ${fmtPlain(m)}.` } : { ok: true };
      if (!m.isZero() && a.v.equals(m.neg())) return { ok: false, feedback: 'The size is right but the sign is off. The x-term flipped sign when it crossed the equals sign.' };
      if (!m.isZero() && (a.v.equals(m.recip()) || a.v.equals(m.recip().neg())))
        return { ok: false, feedback: "That's upside down. The y-coefficient goes on the bottom." };
      return { ok: false, feedback: 'Look at the coefficient on x after dividing everything.' };
    },
  });

  decisions.push({
    id: 'intercept',
    teach: 'The constant b is the y-intercept: the line crosses the y-axis at the point (0, b).',
    why: `When x = 0, y = ${fmtPlain(b)}, so the line crosses the y-axis at (0, ${fmtPlain(b)}).`,
    answer: b.toString(),
    prompt: 'And the $y$-intercept $b$, the constant term?',
    input: { kind: 'number', label: 'b' },
    hints: ['b is the number on its own, after dividing.', `${fmtPlain(C)} ÷ ${fmtPlain(B)}.`],
    after: fmtSlopeIntercept(m, b),
    check: (raw) => {
      const a = parseAnswer(raw);
      if (!a || a.kind !== 'value') return { ok: false, feedback: 'Try a number or fraction.' };
      if (a.v.equals(b)) return a.unreduced ? { ok: true, feedback: `Yes, which simplifies to ${fmtPlain(b)}.` } : { ok: true };
      if (!B.isOne() && a.v.equals(C)) return { ok: false, feedback: `Don't forget: the constant gets divided by ${fmtPlain(B)} too.` };
      if (!b.isZero() && a.v.equals(b.neg())) return { ok: false, feedback: 'Check the sign.' };
      return { ok: false, feedback: `Divide the constant ${fmtPlain(C)} by ${fmtPlain(B)}.` };
    },
  });

  return decisions;
}

// ─── helpers ────────────────────────────────────────────────────────

/** A number for a worked line, in parentheses when negative: (−3). */
function pp(r: Rational): string {
  return r.isNegative() ? `(${fmtPlain(r)})` : fmtPlain(r);
}

/** What a slope says about the line, in words. */
function slopeMeaning(m: Rational): string {
  if (m.isZero()) return 'A slope of 0 means the line is flat: y never changes.';
  const dir = m.isNegative() ? 'down' : 'up';
  return `m = ${fmtPlain(m)}: for every 1 step to the right, the line goes ${dir} ${fmtPlain(m.abs())}. ${m.isNegative() ? 'A negative slope falls from left to right.' : 'A positive slope rises from left to right.'}`;
}

export function fmtPlain(r: Rational): string {
  return r.toString().replace('-', '−');
}

/** Deterministic shuffle, so choices don't jump around between renders. */
function shuffleStable<T>(arr: T[], seed: bigint): T[] {
  const out = [...arr];
  let s = Number((seed < 0n ? -seed : seed) % 9973n) + 7;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 48271) % 2147483647;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export { sameValue };
