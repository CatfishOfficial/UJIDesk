import { Rational } from './rational';
import { fmtR, fmtSlopeIntercept, fmtTerms, toPlain, type Markup } from './markup';
import { isAlreadyStandard, parseLinearEquation, toStandard, type LinearEquation } from './linear';
import type { Step } from './steps';

export type StandardResult =
  | {
      kind: 'slope';
      A: Rational;
      B: Rational;
      C: Rational;
      m: Rational;
      b: Rational;
      steps: Step[];
      answer: Markup;
      answerPlain: string;
      horizontal: boolean;
    }
  | {
      kind: 'vertical';
      A: Rational;
      B: Rational;
      C: Rational;
      xValue: Rational;
      steps: Step[];
      answer: Markup;
      answerPlain: string;
    }
  | { kind: 'error'; message: string };


export function solveStandardToSlope(src: string): StandardResult {
  const parsed = parseLinearEquation(src);
  if (!parsed.ok) return { kind: 'error', message: parsed.error };
  return solveFromEquation(parsed.value);
}

export function solveFromEquation(eq: LinearEquation): StandardResult {
  const { A, B, C } = toStandard(eq);
  const steps: Step[] = [];
  const standardEq = `${fmtTerms([{ coef: A, v: 'x' }, { coef: B, v: 'y' }])} = ${fmtR(C)}`;

  if (A.isZero() && B.isZero()) {
    return {
      kind: 'error',
      message: C.isZero()
        ? 'Everything cancels to 0 = 0, so every point works. That isn\'t a single line.'
        : `Everything cancels to 0 = ${C}, which is never true, so there's no line here.`,
    };
  }

  if (!isAlreadyStandard(eq)) {
    steps.push({
      id: 'collect',
      title: 'Collect x and y on the left, constants on the right',
      eq: standardEq,
      note: 'Now it is in standard form, Ax + By = C.',
      lesson: 'collect',
    });
  }

  if (B.isZero()) {
    const xValue = C.div(A);
    steps.push({
      id: 'no-y',
      title: 'There is no y-term',
      eq: standardEq,
      note: 'x never changes, so this is a vertical line.',
      lesson: 'isolate',
    });
    if (!A.isOne()) {
      steps.push({
        id: 'divide',
        title: `Divide both sides by ${fmtPlainR(A)}`,
        eq: `x = ${fmtR(xValue)}`,
        lesson: 'divide',
      });
    }
    const answer = `x = ${fmtR(xValue)}`;
    return {
      kind: 'vertical',
      A, B, C, xValue, steps,
      answer,
      answerPlain: `${toPlain(answer)} (vertical line, slope undefined)`,
    };
  }

  const m = A.neg().div(B);
  const b = C.div(B);

  if (!A.isZero()) {
    const verb = A.isNegative() ? `Add ${xTerm(A.abs())} to` : `Subtract ${xTerm(A)} from`;
    steps.push({
      id: 'isolate',
      title: `${verb} both sides`,
      eq: `${fmtTerms([{ coef: B, v: 'y' }])} = ${fmtTerms([{ coef: A.neg(), v: 'x' }, { coef: C }])}`,
      note: 'Get the y-term by itself first.',
      lesson: 'isolate',
    });
  } else {
    steps.push({
      id: 'isolate',
      title: 'There is no x-term',
      eq: `${fmtTerms([{ coef: B, v: 'y' }])} = ${fmtR(C)}`,
      note: 'The y-term is already alone, and y never depends on x.',
      lesson: 'isolate',
    });
  }

  if (!B.isOne()) {
    const unreduced = unreducedDivision(A.neg(), C, B);
    const simplified = fmtSlopeIntercept(m, b);
    steps.push({
      id: 'divide',
      title: B.equals(Rational.of(-1)) ? 'Divide every term by −1' : `Divide every term by ${fmtPlainR(B)}`,
      eq: unreduced ?? simplified,
      note: B.isNegative() ? 'Dividing by a negative flips every sign.' : undefined,
      lesson: 'divide',
    });
    if (unreduced && unreduced !== simplified) {
      steps.push({
        id: 'simplify',
        title: 'Simplify',
        eq: simplified,
        lesson: 'slope',
      });
    }
  }

  const answer = fmtSlopeIntercept(m, b);
  return {
    kind: 'slope',
    A, B, C, m, b, steps,
    answer,
    answerPlain: toPlain(answer),
    horizontal: m.isZero(),
  };
}

/**
 * Shows "y = -{3/4}x + {12/4}" before reducing, which is what a teacher writes,
 * but only when every coefficient is an integer (otherwise it gets unreadable).
 */
function unreducedDivision(xCoef: Rational, c: Rational, B: Rational): Markup | null {
  if (!xCoef.isInteger() || !c.isInteger() || !B.isInteger()) return null;
  const den = B.n < 0n ? -B.n : B.n;
  if (den === 1n) return null;
  const term = (num: bigint, v: string, first: boolean): string => {
    if (num === 0n) return '';
    const negative = (num < 0n) !== (B.n < 0n);
    const mag = num < 0n ? -num : num;
    const body = `{${mag}/${den}}${v}`;
    if (first) return negative ? `-${body}` : body;
    return negative ? ` - ${body}` : ` + ${body}`;
  };
  const xPart = term(xCoef.n, 'x', true);
  const cPart = term(c.n, '', xPart === '');
  const rhs = (xPart + cPart) || '0';
  return `y = ${rhs}`;
}

/** "3x", "x" or "1/2x" for step titles. */
export function xTerm(r: Rational): string {
  return r.isOne() ? 'x' : `${fmtPlainR(r)}x`;
}

function fmtPlainR(r: Rational): string {
  return r.toString().replace('-', '−');
}
