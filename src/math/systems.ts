import { Rational } from './rational';
import { fmtR, fmtSlopeIntercept, fmtTerms, type Markup } from './markup';
import { parseLinearEquation, toStandard, type LinearEquation } from './linear';
import type { Step } from './steps';
import type { LessonDecision } from './lessons';
import { parseAnswer } from './answers';
import { plainR } from './surd';
import { calcNum } from './calcExpr';

/**
 * Two linear equations in x and y. Solved by substitution when one equation
 * already says "y = …" or "x = …", otherwise by elimination, the way it's
 * taught. Handles parallel lines (no solution) and the same line twice.
 */
type V = 'x' | 'y';
interface Std {
  A: Rational;
  B: Rational;
  C: Rational;
}

export type SystemResult =
  | {
      kind: 'one' | 'none' | 'infinite';
      method: 'elimination' | 'substitution';
      x?: Rational;
      y?: Rational;
      e1: Std;
      e2: Std;
      steps: Step[];
      answer: Markup;
      answerPlain: string;
      /** Each line as something the graph can draw. */
      lines: string[];
      /** For substitution: equation n gives v = p·(other) + q, substituted into `rest`. */
      sub?: { n: 1 | 2; v: V; p: Rational; q: Rational; rest: Std };
    }
  | { kind: 'error'; message: string; field?: 'eq1' | 'eq2' };

const R = (n: number | bigint) => Rational.of(n);
const coefOf = (e: Std, v: V) => (v === 'x' ? e.A : e.B);
const other = (v: V): V => (v === 'x' ? 'y' : 'x');
const fmtStd = (e: Std) => `${fmtTerms([{ coef: e.A, v: 'x' }, { coef: e.B, v: 'y' }])} = ${fmtR(e.C)}`;
const scaleStd = (e: Std, k: Rational): Std => ({ A: e.A.mul(k), B: e.B.mul(k), C: e.C.mul(k) });

function gcdB(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}
const lcmB = (a: bigint, b: bigint) => (a === 0n || b === 0n ? 0n : (a < 0n ? -a : a) * ((b < 0n ? -b : b) / gcdB(a, b)));

/** Whole-number version of a standard-form equation, so elimination stays tidy. */
function integerize(e: Std): Std {
  let l = 1n;
  for (const c of [e.A, e.B, e.C]) l = lcmB(l, c.d) || l;
  return scaleStd(e, R(l));
}

/** A line as graphable text: y = mx + b, or x = c. */
export function lineText(e: Std): string {
  if (e.B.isZero()) return `x = ${plainR(e.C.div(e.A)).replace('−', '-')}`;
  const m = e.A.neg().div(e.B);
  const b = e.C.div(e.B);
  return fmtSlopeIntercept(m, b).replace(/\{(\d+)\/(\d+)\}/g, '($1/$2)');
}

/** If the typed equation reads "y = …" (or "x = …"), which variable it's solved for. */
function solvedFor(eq: LinearEquation): V | null {
  const isAlone = (side: LinearEquation['left'], v: V) => (v === 'x' ? side.x.isOne() && side.y.isZero() : side.y.isOne() && side.x.isZero()) && side.c.isZero();
  for (const v of ['y', 'x'] as V[]) {
    if (isAlone(eq.left, v) && (v === 'x' ? eq.right.x : eq.right.y).isZero()) return v;
    if (isAlone(eq.right, v) && (v === 'x' ? eq.left.x : eq.left.y).isZero()) return v;
  }
  return null;
}

/** An equation with only one variable in it, like 2x = 6. */
const singleVar = (e: Std): V | null => (e.A.isZero() ? 'y' : e.B.isZero() ? 'x' : null);

export interface EliminationPlan {
  v: V;
  k1: Rational;
  k2: Rational;
  op: 'add' | 'subtract';
  /** After combining: coefficient of the remaining variable, and the constant. */
  R: Rational;
  K: Rational;
}

export function eliminationPlan(e1: Std, e2: Std, v: V): EliminationPlan {
  const c1 = coefOf(e1, v);
  const c2 = coefOf(e2, v);
  const l = lcmB(c1.n, c2.n);
  const k1 = l === 0n ? R(1) : R(l / (c1.n < 0n ? -c1.n : c1.n));
  const k2 = l === 0n ? R(1) : R(l / (c2.n < 0n ? -c2.n : c2.n));
  const op = c1.sign() === c2.sign() ? 'subtract' : 'add';
  const s = op === 'add' ? R(1) : R(-1);
  const o = other(v);
  const Rr = coefOf(e1, o).mul(k1).add(coefOf(e2, o).mul(k2).mul(s));
  const K = e1.C.mul(k1).add(e2.C.mul(k2).mul(s));
  return { v, k1, k2, op, R: Rr, K };
}

/** The variable that's cheaper to eliminate (smaller common multiple); y on ties. */
export function bestToEliminate(e1: Std, e2: Std): V {
  const cost = (v: V) => {
    const l = lcmB(coefOf(e1, v).n, coefOf(e2, v).n);
    return l === 0n ? Infinity : Number(l);
  };
  return cost('x') < cost('y') ? 'x' : 'y';
}

export function solveSystem(src1: string, src2: string): SystemResult {
  const p1 = parseLinearEquation(src1);
  if (!p1.ok) return { kind: 'error', message: `Equation 1: ${p1.error}`, field: 'eq1' };
  const p2 = parseLinearEquation(src2);
  if (!p2.ok) return { kind: 'error', message: `Equation 2: ${p2.error}`, field: 'eq2' };
  const s1 = toStandard(p1.value);
  const s2 = toStandard(p2.value);
  for (const [s, f] of [[s1, 'eq1'], [s2, 'eq2']] as const) {
    if (s.A.isZero() && s.B.isZero())
      return { kind: 'error', message: `Equation ${f === 'eq1' ? 1 : 2} has no x or y left once it's simplified, so it isn't a line.`, field: f };
  }
  const e1 = integerize(s1);
  const e2 = integerize(s2);
  const det = e1.A.mul(e2.B).sub(e2.A.mul(e1.B));
  const lines = [lineText(e1), lineText(e2)];

  let kind: 'one' | 'none' | 'infinite' = 'one';
  let x: Rational | undefined;
  let y: Rational | undefined;
  if (!det.isZero()) {
    x = e1.C.mul(e2.B).sub(e2.C.mul(e1.B)).div(det);
    y = e1.A.mul(e2.C).sub(e2.A.mul(e1.C)).div(det);
  } else {
    const same = e1.A.mul(e2.C).sub(e2.A.mul(e1.C)).isZero() && e1.B.mul(e2.C).sub(e2.B.mul(e1.C)).isZero();
    kind = same ? 'infinite' : 'none';
  }

  // Substitution when one equation is already solved for a variable (or only has one).
  const pick: [1 | 2, V] | null = singleVar(e1)
    ? [1, singleVar(e1)!]
    : singleVar(e2)
      ? [2, singleVar(e2)!]
      : solvedFor(p1.value)
        ? [1, solvedFor(p1.value)!]
        : solvedFor(p2.value)
          ? [2, solvedFor(p2.value)!]
          : null;
  const method = pick ? 'substitution' : 'elimination';
  let sub: Extract<SystemResult, { method: string }>['sub'];
  let steps: Step[];
  if (pick) {
    const [n, v] = pick;
    const solved = n === 1 ? e1 : e2;
    const rest = n === 1 ? e2 : e1;
    const o = other(v);
    sub = { n, v, p: coefOf(solved, o).neg().div(coefOf(solved, v)), q: solved.C.div(coefOf(solved, v)), rest };
    steps = substitutionSteps(sub, kind, x, y, solved);
  } else steps = eliminationSteps(e1, e2, kind, x, y, s1, s2);

  const answer = kind === 'one' ? `(x, y) = (${fmtR(x!)}, ${fmtR(y!)})` : kind === 'none' ? 'No solution' : 'Infinitely many solutions';
  const answerPlain = kind === 'one' ? `(${plainR(x!)}, ${plainR(y!)})` : kind === 'none' ? 'No solution' : 'Infinitely many solutions';
  return { kind, method, x, y, e1, e2, steps, answer, answerPlain, lines, sub };
}

function eliminationSteps(e1: Std, e2: Std, kind: string, x: Rational | undefined, y: Rational | undefined, raw1: Std, raw2: Std): Step[] {
  const steps: Step[] = [];
  const changed = (a: Std, b: Std) => !(a.A.equals(b.A) && a.B.equals(b.B) && a.C.equals(b.C));
  steps.push({
    id: 'standard',
    title: changed(e1, raw1) || changed(e2, raw2) ? 'Line both up as Ax + By = C (whole numbers)' : 'Both equations are lined up as Ax + By = C',
    eq: `${fmtStd(e1)},  ${fmtStd(e2)}`,
  });
  const v = bestToEliminate(e1, e2);
  const plan = eliminationPlan(e1, e2, v);
  const o = other(v);
  const m1 = scaleStd(e1, plan.k1);
  const m2 = scaleStd(e2, plan.k2);
  const mult = [!plan.k1.isOne() && `equation 1 by ${plainR(plan.k1)}`, !plan.k2.isOne() && `equation 2 by ${plainR(plan.k2)}`].filter(Boolean).join(' and ');
  if (mult) {
    steps.push({
      id: 'multiply',
      title: `Multiply ${mult} so the ${v}-terms match`,
      eq: `${fmtStd(m1)},  ${fmtStd(m2)}`,
      lesson: 'eliminate',
    });
  }
  steps.push({
    id: 'combine',
    title: `${plan.op === 'add' ? 'Add' : 'Subtract'} the equations: the ${v}-terms cancel`,
    eq: `${fmtTerms([{ coef: plan.R, v: o }], { keepZero: true })} = ${fmtR(plan.K)}`,
    note: plan.op === 'add' ? 'Opposite signs cancel when you add.' : 'Matching signs cancel when you subtract.',
    lesson: 'combine',
  });
  if (kind !== 'one') {
    steps.push({
      id: 'meaning',
      title: kind === 'none' ? 'That is never true, so there is no solution' : 'That is always true, so every point on the line works',
      eq: `0 = ${fmtR(plan.K)}`,
      note: kind === 'none' ? 'The lines are parallel: same slope, different intercepts. They never meet.' : 'Both equations describe the same line.',
      lesson: 'meaning',
    });
    return steps;
  }
  const first = o === 'x' ? x! : y!;
  const second = o === 'x' ? y! : x!;
  steps.push({ id: 'first', title: `Divide by ${plainR(plan.R)}`, eq: `${o} = ${fmtR(first)}`, lesson: 'first' });
  // Back-substitute into whichever equation still has the eliminated variable.
  const back = coefOf(e1, v).isZero() ? e2 : e1;
  const n = back === e1 ? 1 : 2;
  const known = coefOf(back, o).mul(first);
  steps.push({
    id: 'back',
    title: `Put ${o} = ${plainR(first)} back into equation ${n}`,
    eq: `${fmtTerms([{ coef: coefOf(back, v), v }])} ${known.isNegative() ? '-' : '+'} ${fmtR(known.abs())} = ${fmtR(back.C)}`,
    lesson: 'second',
  });
  steps.push({ id: 'second', title: `Solve for ${v}`, eq: `${v} = ${fmtR(second)}`, lesson: 'second' });
  steps.push(checkStep(e1, e2, x!, y!));
  return steps;
}

function substitutionSteps(sub: NonNullable<Extract<SystemResult, { method: string }>['sub']>, kind: string, x: Rational | undefined, y: Rational | undefined, solved: Std): Step[] {
  const { n, v, p, q, rest } = sub;
  const o = other(v);
  const expr = fmtTerms([{ coef: p, v: o }, { coef: q }]);
  const cv = coefOf(rest, v);
  const co = coefOf(rest, o);
  const steps: Step[] = [
    p.isZero() && !(coefOf(solved, v).isOne())
      ? { id: 'solved', title: `Equation ${n} only has ${v}, so solve it first`, eq: `${v} = ${expr}`, lesson: 'substitute' }
      : { id: 'solved', title: `Equation ${n} already says what ${v} is`, eq: `${v} = ${expr}` },
    {
      id: 'substitute',
      title: `Substitute it into equation ${n === 1 ? 2 : 1}`,
      eq: substituted(co, cv, o, expr, rest.C),
      lesson: 'substitute',
    },
  ];
  const lin = co.add(cv.mul(p));
  const cst = cv.mul(q);
  steps.push({
    id: 'simplify',
    title: 'Distribute and collect like terms',
    eq: `${fmtTerms([{ coef: lin, v: o }, { coef: cst }], { keepZero: lin.isZero() })} = ${fmtR(rest.C)}`,
    lesson: 'substitute',
  });
  if (kind !== 'one') {
    steps.push({
      id: 'meaning',
      title: kind === 'none' ? 'That is never true, so there is no solution' : 'That is always true, so every point on the line works',
      eq: `${fmtR(cst)} = ${fmtR(rest.C)}`,
      note: kind === 'none' ? 'The lines are parallel and never meet.' : 'Both equations describe the same line.',
      lesson: 'meaning',
    });
    return steps;
  }
  const first = o === 'x' ? x! : y!;
  const second = o === 'x' ? y! : x!;
  steps.push({ id: 'first', title: `Solve for ${o}`, eq: `${o} = ${fmtR(first)}`, lesson: 'first' });
  steps.push({ id: 'second', title: `Put ${o} = ${plainR(first)} into ${v} = ${expr.replace(/[{}]/g, '').replace(/-/g, '−')}`, eq: `${v} = ${fmtR(second)}`, lesson: 'second' });
  steps.push(checkStep(solved, rest, x!, y!));
  return steps;
}

/** 3x + 2(4x − 1) = 9, written the way it's substituted. */
function substituted(co: Rational, cv: Rational, o: V, expr: Markup, C: Rational): Markup {
  const lead = co.isZero() ? '' : fmtTerms([{ coef: co, v: o }]);
  let term: string;
  if (!lead) term = cv.isOne() ? '' : cv.equals(R(-1)) ? '-' : fmtR(cv);
  else term = (cv.isNegative() ? ' - ' : ' + ') + (cv.abs().isOne() ? '' : fmtR(cv.abs()));
  return `${lead}${term}(${expr}) = ${fmtR(C)}`;
}

function checkStep(e1: Std, e2: Std, x: Rational, y: Rational): Step {
  const show = (e: Std) => `${fmtR(e.A.mul(x).add(e.B.mul(y)))} = ${fmtR(e.C)}`;
  return {
    id: 'check',
    title: `Check (${plainR(x)}, ${plainR(y)}) in both equations`,
    eq: `${show(e1)} ✓,  ${show(e2)} ✓`,
  };
}

// ─── Lesson ─────────────────────────────────────────────────────────

export function buildSystemLesson(r: Extract<SystemResult, { method: string }>, accepted: Record<string, string | undefined>): LessonDecision[] {
  const { e1, e2 } = r;
  const out: LessonDecision[] = [];
  const v: V = (accepted.eliminate as V | undefined) ?? bestToEliminate(e1, e2);
  const plan = eliminationPlan(e1, e2, v);
  const o = other(v);

  if (r.method === 'elimination') {
    const describe = (w: V) => {
      const p = eliminationPlan(e1, e2, w);
      const parts = [!p.k1.isOne() && `×${plainR(p.k1)} on equation 1`, !p.k2.isOne() && `×${plainR(p.k2)} on equation 2`].filter(Boolean).join(', ');
      return `Eliminate ${w}${parts ? ` (${parts}, then ${p.op})` : ` (just ${p.op})`}`;
    };
    const both = (['x', 'y'] as V[]).filter((w) => !coefOf(e1, w).isZero() && !coefOf(e2, w).isZero());
    if (both.length === 2) {
      out.push({
        id: 'eliminate',
        teach: 'A solution is a point that makes **both** equations true: where the two lines cross. Elimination gets rid of one variable: multiply so its coefficients match (or are opposites), then add or subtract the equations.',
        why: `With ${v} gone, only ${o} is left, and one equation with one unknown is easy to solve.`,
        answer: bestToEliminate(e1, e2),
        prompt: 'Elimination: make one variable cancel when the equations are combined. Which one will you go after?',
        context: `${fmtStd(e1)},  ${fmtStd(e2)}`,
        input: { kind: 'choice', options: both.map((w) => ({ id: w, label: describe(w) })) },
        hints: ['Either works. Pick the one whose coefficients are easiest to match.'],
        after: `${fmtStd(scaleStd(e1, plan.k1))},  ${fmtStd(scaleStd(e2, plan.k2))}`,
        check: (id) => ({ ok: true, value: id, feedback: id === bestToEliminate(e1, e2) ? undefined : 'That works too. A slightly bigger multiplier, same answer.' }),
      });
    }
    const right = `${fmtTerms([{ coef: plan.R, v: o }], { keepZero: true })} = ${fmtR(plan.K)}`;
    const wrongOp = eliminationPlan(e1, e2, v);
    const flip = wrongOp.op === 'add' ? R(-1) : R(1);
    const wrongV = coefOf(e1, v).mul(plan.k1).add(coefOf(e2, v).mul(plan.k2).mul(flip));
    const wrongO = coefOf(e1, o).mul(plan.k1).add(coefOf(e2, o).mul(plan.k2).mul(flip));
    const wrongK = e1.C.mul(plan.k1).add(e2.C.mul(plan.k2).mul(flip));
    const noScaleK = e1.C.add(e2.C.mul(plan.op === 'add' ? R(1) : R(-1)));
    const options = [
      { id: 'right', label: `$${right}$` },
      { id: 'op', label: `$${fmtTerms([{ coef: wrongV, v }, { coef: wrongO, v: o }], { keepZero: true })} = ${fmtR(wrongK)}$` },
      { id: 'const', label: `$${fmtTerms([{ coef: plan.R, v: o }], { keepZero: true })} = ${fmtR(noScaleK)}$` },
    ].filter((x, i, arr) => arr.findIndex((y) => y.label === x.label) === i);
    out.push({
      id: 'combine',
      teach: `The ${v}-terms have ${plan.op === 'add' ? 'opposite signs, so **adding** cancels them' : 'the same sign, so **subtracting** cancels them'}. Combine every term, the numbers on the right included.`,
      why: `${plan.op === 'add' ? 'Adding' : 'Subtracting'} equal things from both sides keeps them equal, and it wipes out ${v}.`,
      answer: 'right',
      prompt: `${plan.k1.isOne() && plan.k2.isOne() ? '' : 'After multiplying, '}${plan.op} the equations. What's left?`,
      context: `${fmtStd(scaleStd(e1, plan.k1))},  ${fmtStd(scaleStd(e2, plan.k2))}`,
      input: { kind: 'choice', options: shuffle(options, Number(plan.K.n)) },
      hints: [`The ${v}-terms have ${plan.op === 'add' ? 'opposite' : 'the same'} signs, so ${plan.op === 'add' ? 'adding' : 'subtracting'} cancels them.`, 'Combine every term, the numbers on the right included.'],
      after: right,
      check: (id) =>
        id === 'right'
          ? { ok: true }
          : id === 'op'
            ? { ok: false, feedback: `That ${plan.op === 'add' ? 'subtracted' : 'added'}, so ${v} didn't cancel. Try the other operation.` }
            : { ok: false, feedback: 'The multiplier applies to the whole equation, the number on the right too.' },
    });
  } else if (r.sub) {
    const { v: sv, p, q, rest, n } = r.sub;
    const so = other(sv);
    const cv = coefOf(rest, sv);
    const co = coefOf(rest, so);
    const eqOf = (lin: Rational, cst: Rational) => `$${fmtTerms([{ coef: lin, v: so }, { coef: cst }], { keepZero: lin.isZero() })} = ${fmtR(rest.C)}$`;
    const options = [
      { id: 'right', label: eqOf(co.add(cv.mul(p)), cv.mul(q)) },
      { id: 'dist', label: eqOf(co.add(cv.mul(p)), q) },
      { id: 'sign', label: eqOf(co.sub(cv.mul(p)), cv.mul(q)) },
    ].filter((x, i, arr) => arr.findIndex((y) => y.label === x.label) === i);
    out.push({
      id: 'substitute',
      teach: `Equation ${n} says exactly what ${sv} equals, so swap ${sv} for that expression in the other equation. Put it in **parentheses**, so the number in front multiplies every term.`,
      why: 'Now there’s only one variable left, so it can be solved.',
      answer: 'right',
      prompt: `Equation ${n} says $${sv} = ${fmtTerms([{ coef: p, v: so }, { coef: q }])}$. Put that in for $${sv}$ in the other equation and simplify. Which do you get?`,
      context: fmtStd(rest),
      input: { kind: 'choice', options: shuffle(options, Number(rest.C.n) + 3) },
      hints: ['Wrap the expression in parentheses when you substitute it.', `Then multiply ${plainR(cv)} by every term inside.`],
      after: r.steps.find((s) => s.id === 'simplify')?.eq ?? '',
      check: (id) =>
        id === 'right'
          ? { ok: true }
          : id === 'dist'
            ? { ok: false, feedback: `The ${plainR(cv)} multiplies everything in the parentheses, the constant too.` }
            : { ok: false, feedback: 'Check the sign when you combine the two terms.' },
    });
  }

  if (r.kind !== 'one') {
    out.push({
      id: 'meaning',
      teach: 'Both variables cancelled out. What’s left is either always true or never true.',
      why: r.kind === 'none' ? 'A false statement means no (x, y) can work: the lines are parallel and never cross.' : 'A true statement means every point on the line works: both equations are the same line.',
      answer: r.kind,
      prompt: `Both variables vanished. What does that mean?`,
      context: r.steps.find((s) => s.id === 'meaning')?.eq,
      input: {
        kind: 'choice',
        options: [
          { id: 'none', label: 'No solution: the lines are parallel' },
          { id: 'infinite', label: 'Infinitely many: it is the same line twice' },
          { id: 'zero', label: 'The solution is (0, 0)' },
        ],
      },
      hints: ['Is the leftover statement true, like 0 = 0, or false, like 0 = 5?'],
      after: r.answer,
      check: (id) =>
        id === r.kind
          ? { ok: true }
          : id === 'zero'
            ? { ok: false, feedback: "The variables didn't come out as 0. They disappeared entirely." }
            : { ok: false, feedback: r.kind === 'none' ? 'A false statement like that means no point works.' : 'A true statement means every point on the line works.' },
    });
    return out;
  }

  const sub = r.method === 'substitution';
  const firstVar: V = sub ? (r.steps.find((s) => s.id === 'first')!.eq.startsWith('x') ? 'x' : 'y') : o;
  const firstVal = firstVar === 'x' ? r.x! : r.y!;
  const secondVar = other(firstVar);
  const secondVal = secondVar === 'x' ? r.x! : r.y!;
  // What to type: the last division for the first value, then back-substitution into an equation that has both.
  let firstCalc = `${calcNum(plan.K)} ÷ ${calcNum(plan.R)}`;
  if (sub && r.sub) {
    const so = other(r.sub.v);
    const lin = coefOf(r.sub.rest, so).add(coefOf(r.sub.rest, r.sub.v).mul(r.sub.p));
    const cst = coefOf(r.sub.rest, r.sub.v).mul(r.sub.q);
    firstCalc = `(${calcNum(r.sub.rest.C)} − ${calcNum(cst)}) ÷ ${calcNum(lin)}`;
  }
  const backEq = !coefOf(e1, secondVar).isZero() ? e1 : e2;
  const secondCalc = `(${calcNum(backEq.C)} − ${calcNum(coefOf(backEq, firstVar))} × ${calcNum(firstVal)}) ÷ ${calcNum(coefOf(backEq, secondVar))}`;
  out.push({
    id: 'first',
    teach: `Solve for ${firstVar} like any two-step equation: undo adding or subtracting first, then undo the multiplying.`,
    why: `${firstVar} = ${plainR(firstVal)}.`,
    answer: firstVal.toString(),
    prompt: `Solve for $${firstVar}$.`,
    context: sub ? r.steps.find((s) => s.id === 'simplify')?.eq : `${fmtTerms([{ coef: plan.R, v: o }])} = ${fmtR(plan.K)}`,
    input: { kind: 'number', label: firstVar },
    helper: 'calculator',
    calc: firstCalc,
    hints: ['Get the variable alone: undo the constant, then divide by its coefficient.'],
    after: `${firstVar} = ${fmtR(firstVal)}`,
    check: (raw) => numberCheck(raw, firstVal),
  });
  out.push({
    id: 'second',
    teach: 'Put the value you found back into either original equation, and solve for the other variable.',
    why: `So the lines cross at (${plainR(r.x!)}, ${plainR(r.y!)}). Putting it into both equations makes both true.`,
    answer: secondVal.toString(),
    prompt: `Now put $${firstVar} = ${fmtR(firstVal)}$ back into either equation. What is $${secondVar}$?`,
    input: { kind: 'number', label: secondVar },
    helper: 'calculator',
    calc: secondCalc,
    hints: [`Equation 1 works: ${fmtStd(e1).replace(/[{}]/g, '')}.`],
    after: r.answer,
    check: (raw) => numberCheck(raw, secondVal),
  });
  return out;
}

function numberCheck(raw: string, want: Rational) {
  const a = parseAnswer(raw);
  if (!a || a.kind !== 'value') return { ok: false as const, feedback: 'Try a number or fraction.' };
  if (a.v.equals(want)) return { ok: true as const };
  if (a.v.equals(want.neg())) return { ok: false as const, feedback: 'Right size, wrong sign.' };
  return { ok: false as const, feedback: 'Not quite. Check the arithmetic one step at a time.' };
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = (Math.abs(seed) % 9973) + 11;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 48271) % 2147483647;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
