import { Rational } from './rational';
import { fmtR, fmtRParen, fmtSlopeIntercept, toPlain, type Markup } from './markup';
import type { Step } from './steps';

export interface PointsInput {
  x1: Rational;
  y1: Rational;
  x2: Rational;
  y2: Rational;
}

export type SlopeResult =
  | {
      kind: 'slope';
      rise: Rational;
      run: Rational;
      m: Rational;
      b: Rational;
      line: Markup;
      steps: Step[];
      answer: Markup;
      answerPlain: string;
      horizontal: boolean;
    }
  | {
      kind: 'vertical';
      rise: Rational;
      run: Rational;
      xValue: Rational;
      line: Markup;
      steps: Step[];
      answer: Markup;
      answerPlain: string;
    }
  | { kind: 'error'; message: string };


export function parsePointsInput(raw: { x1: string; y1: string; x2: string; y2: string }):
  | { ok: true; value: PointsInput }
  | { ok: false; error: string; field?: keyof typeof raw } {
  const out: Partial<PointsInput> = {};
  for (const key of ['x1', 'y1', 'x2', 'y2'] as const) {
    const v = raw[key].trim();
    if (!v) return { ok: false, error: `${label(key)} is empty.`, field: key };
    const r = Rational.parse(v);
    if (!r) return { ok: false, error: `${label(key)} should be a number, like 3, -2.5 or 1/2.`, field: key };
    out[key] = r;
  }
  return { ok: true, value: out as PointsInput };
}

function label(key: string): string {
  return `${key[0]}${key[1] === '1' ? '₁' : '₂'}`;
}

export function solveSlopeFromPoints(p: PointsInput): SlopeResult {
  const { x1, y1, x2, y2 } = p;
  const rise = y2.sub(y1);
  const run = x2.sub(x1);

  if (rise.isZero() && run.isZero()) {
    return {
      kind: 'error',
      message: 'Those are the same point twice. A line needs two different points; infinitely many lines pass through just one.',
    };
  }

  const steps: Step[] = [
    {
      id: 'formula',
      title: 'Slope is rise over run',
      eq: 'm = {y_2 - y_1/x_2 - x_1}',
      lesson: 'rise',
    },
    {
      id: 'substitute',
      title: 'Substitute the coordinates',
      eq: `m = {${fmtRParen(y2)} - ${fmtRParen(y1)}/${fmtRParen(x2)} - ${fmtRParen(x1)}}`,
      note: y1.isNegative() || x1.isNegative() ? 'Subtracting a negative is the same as adding.' : undefined,
      lesson: 'rise',
    },
    {
      id: 'compute',
      title: 'Work out the top and bottom',
      eq: `m = {${fmtR(rise)}/${fmtR(run)}}`,
      lesson: 'run',
    },
  ];

  if (run.isZero()) {
    steps.push({
      id: 'undefined',
      title: 'The run is zero',
      eq: 'm is undefined',
      note: `You can't divide by zero. Both points have x = ${x1}, so the line is vertical.`,
      lesson: 'divide',
    });
    const line = `x = ${fmtR(x1)}`;
    return {
      kind: 'vertical',
      rise, run, xValue: x1, line, steps,
      answer: 'undefined',
      answerPlain: `undefined (vertical line ${toPlain(line)})`,
    };
  }

  const m = rise.div(run);
  const simplified = `m = ${fmtR(m)}`;
  if (simplified !== steps[2].eq) {
    steps.push({
      id: 'simplify',
      title: run.isNegative() ? 'Simplify (a negative bottom moves the sign up front)' : 'Simplify',
      eq: simplified,
      lesson: 'divide',
    });
  }
  if (m.isZero()) {
    steps[steps.length - 1].note = 'Zero rise means a flat, horizontal line.';
  }

  const b = y1.sub(m.mul(x1));
  const line = fmtSlopeIntercept(m, b);
  steps.push({
    id: 'line',
    title: 'Bonus: the line through both points',
    eq: `b = y_1 - m x_1 = ${fmtRParen(y1)} - ${fmtRParen(m)}(${fmtR(x1)}) = ${fmtR(b)}`,
    note: `So the line is ${toPlain(line)}.`,
    lesson: 'line',
  });

  return {
    kind: 'slope',
    rise, run, m, b, line, steps,
    answer: `m = ${fmtR(m)}`,
    answerPlain: toPlain(`m = ${fmtR(m)}`),
    horizontal: m.isZero(),
  };
}
