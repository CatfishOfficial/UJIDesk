import { Rational } from './rational';
import { fmtR, fmtRParen, type Markup } from './markup';
import { coef, degree, evalPolyExact, fmtPoly, gcdBig, lcmDenominators, parsePoly, scalePoly, type Poly } from './poly';
import { squareFree } from './surd';
import type { Step } from './steps';
import type { LessonDecision } from './lessons';
import { parseAnswer } from './answers';
import { plainR, round } from './surd';
import { calcNum } from './calcExpr';

/**
 * ax² + bx + c = 0 by the quadratic formula, with exact simplified radicals
 * (x = 3 ± 2√2), the discriminant, complex roots when there are no real ones,
 * and the vertex.
 */
export interface QuadInput {
  poly: Poly;
  variable: string;
  /** Typed as "… = 0" (or as a bare expression). */
  alreadyZero: boolean;
  typed: string;
}

type Roots =
  | { type: 'rational'; r: Rational[] }
  | { type: 'irrational'; num0: bigint; k: bigint; r: bigint; den: bigint }
  | { type: 'complex'; num0: bigint; k: bigint; r: bigint; den: bigint };

export type QuadResult =
  | {
      kind: 'ok';
      v: string;
      a: Rational;
      b: Rational;
      c: Rational;
      /** Whole-number coefficients used in the formula (after clearing fractions). */
      A: bigint;
      B: bigint;
      C: bigint;
      cleared: bigint;
      D: bigint;
      roots: Roots;
      decimals: number[];
      vertex: { h: Rational; k: Rational };
      answer: Markup;
      answerPlain: string;
      steps: Step[];
    }
  | { kind: 'error'; message: string };

const WORDS = /\b(solve|find|the|roots?|zeros?|solutions?|of|for|using|quadratic|formula|equation)\b|:/gi;

/** Reads "x² − 5x + 6 = 0", "2x^2 = 3x + 5", "x^2 - 4", or "a = 1, b = −5, c = 6". */
export function readQuadratic(src: string): { ok: true; value: QuadInput } | { ok: false; error: string } {
  const abc = /a\s*=\s*([^,;]+?)\s*[,;]?\s+b\s*=\s*([^,;]+?)\s*[,;]?\s+c\s*=\s*([^,;\s]+)/i.exec(src.replace(/[−–]/g, '-'));
  if (abc) {
    const [a, b, c] = abc.slice(1, 4).map((t) => Rational.parse(t));
    if (!a || !b || !c) return { ok: false, error: 'a, b and c should be numbers.' };
    return { ok: true, value: { poly: [c, b, a], variable: 'x', alreadyZero: true, typed: src } };
  }
  const cleaned = src.replace(WORDS, ' ').replace(/\bx\s*=\s*\?\s*$/i, '').trim();
  const p = parsePoly(cleaned);
  if (!p.ok) return { ok: false, error: p.error };
  const right = p.value.right;
  const alreadyZero = !p.value.isEquation || (degree(right) === -1);
  return { ok: true, value: { poly: p.value.poly, variable: p.value.variable, alreadyZero, typed: cleaned } };
}

export function solveQuadratic(input: QuadInput): QuadResult {
  const { poly, variable: v } = input;
  const d = degree(poly);
  if (d < 0) return { kind: 'error', message: 'Everything cancels out, so every x works. That is not a quadratic.' };
  if (d === 0) return { kind: 'error', message: 'There is no x left once it is simplified, so there is nothing to solve.' };
  if (d === 1) {
    const x = coef(poly, 0).neg().div(coef(poly, 1));
    return { kind: 'error', message: `There's no ${v}² term, so it's linear: ${v} = ${plainR(x)}. No formula needed.` };
  }
  if (d > 2) return { kind: 'error', message: `That has a ${v}^${d} term. The quadratic formula only works up to ${v}².` };

  const a = coef(poly, 2);
  const b = coef(poly, 1);
  const c = coef(poly, 0);
  const L = lcmDenominators(poly);
  const scaled = scalePoly(poly, Rational.of(L));
  const A = coef(scaled, 2).n;
  const B = coef(scaled, 1).n;
  const C = coef(scaled, 0).n;
  const D = B * B - 4n * A * C;
  const steps: Step[] = [];
  const std = `${fmtPoly(poly, v)} = 0`;

  if (!input.alreadyZero) steps.push({ id: 'zero', title: 'Move everything to one side', eq: std, lesson: 'abc' });
  if (L !== 1n) steps.push({ id: 'clear', title: `Multiply by ${L} to clear the fractions`, eq: `${fmtPoly(scaled, v)} = 0`, lesson: 'abc' });
  const RA = Rational.of(A);
  const RB = Rational.of(B);
  const RC = Rational.of(C);
  steps.push({ id: 'abc', title: 'Read off a, b and c', eq: `a = ${fmtR(RA)},  b = ${fmtR(RB)},  c = ${fmtR(RC)}`, lesson: 'abc' });
  steps.push({ id: 'formula', title: 'The quadratic formula', eq: `${v} = {-b ± √{b^2 - 4ac}/2a}` });
  steps.push({
    id: 'disc',
    title: 'Start with the discriminant, the part under the root',
    eq: `b^2 - 4ac = ${fmtRParen(RB)}^2 - 4(${fmtR(RA)})(${fmtR(RC)}) = ${D}`,
    lesson: 'disc',
  });
  steps.push({
    id: 'count',
    title: D > 0n ? 'Positive: two real solutions' : D === 0n ? 'Zero: exactly one real solution' : 'Negative: no real solutions',
    eq: `${D} ${D > 0n ? '>' : D === 0n ? '=' : '<'} 0`,
    note: D < 0n ? 'The square root of a negative number isn’t real, so the parabola never touches the x-axis.' : D === 0n ? 'The parabola just touches the x-axis at its vertex.' : undefined,
    lesson: 'count',
  });
  steps.push({
    id: 'sub',
    title: 'Substitute into the formula',
    eq: `${v} = {-${fmtRParen(RB)} ± √{${D}}/2(${fmtR(RA)})} = {${fmtR(RB.neg())} ± √{${D}}/${2n * A}}`,
    lesson: 'roots',
  });

  const absD = D < 0n ? -D : D;
  const { k, r } = squareFree(absD);
  let roots: Roots;
  let answer: Markup;
  let answerPlain: string;
  let decimals: number[] = [];

  if (D >= 0n && r === 1n) {
    const s = Rational.of(k);
    const r1 = RB.neg().sub(s).div(Rational.of(2n * A));
    const r2 = RB.neg().add(s).div(Rational.of(2n * A));
    const list = D === 0n ? [r1] : [r1, r2].sort((p, q) => p.sub(q).sign());
    roots = { type: 'rational', r: list };
    decimals = list.map((x) => x.toNumber());
    if (D > 0n) steps.push({ id: 'root', title: `√${D} = ${k}, a whole number`, eq: `${v} = {${fmtR(RB.neg())} ± ${k}/${2n * A}}`, lesson: 'roots' });
    steps.push({
      id: 'split',
      title: D === 0n ? 'The ± makes no difference when the root is 0' : 'Split the ± into two answers',
      eq: list.map((x) => `${v} = ${fmtR(x)}`).join('  or  '),
      lesson: 'roots',
    });
    answer = list.map((x) => `${v} = ${fmtR(x)}`).join('  or  ');
    answerPlain = list.map((x) => `${v} = ${plainR(x)}`).join(' or ');
  } else {
    let g = gcdBig(gcdBig(B, k), 2n * A);
    if (g === 0n) g = 1n;
    let num0 = -B / g;
    let den = (2n * A) / g;
    const kk = k / g;
    if (den < 0n) {
      num0 = -num0;
      den = -den;
    }
    const ir: Extract<Roots, { num0: bigint }> = { type: D < 0n ? 'complex' : 'irrational', num0, k: kk, r, den };
    roots = ir;
    if (k > 1n) {
      steps.push({
        id: 'simplify',
        title: D < 0n ? `Simplify: √(${D}) = ${k}i${r === 1n ? '' : `√${r}`}` : `Simplify the root: √${D} = ${k}√${r}`,
        eq: `${v} = {${fmtR(RB.neg())} ± ${rootPart(k, r, D < 0n)}/${2n * A}}`,
        note: D < 0n ? 'i stands for √−1.' : `${D} = ${k * k} × ${r}, and √${k * k} = ${k}.`,
        lesson: 'roots',
      });
    } else if (D < 0n) {
      steps.push({ id: 'simplify', title: 'Write √(negative) with i', eq: `${v} = {${fmtR(RB.neg())} ± ${rootPart(k, r, true)}/${2n * A}}`, note: 'i stands for √−1.', lesson: 'roots' });
    }
    if (g > 1n) steps.push({ id: 'reduce', title: `Divide top and bottom by ${g}`, eq: fmtIrrational(v, ir), lesson: 'roots' });
    if (D > 0n) {
      const sq = Math.sqrt(Number(D));
      decimals = [(-Number(B) - sq) / (2 * Number(A)), (-Number(B) + sq) / (2 * Number(A))].sort((p, q) => p - q);
      answer = fmtIrrational(v, ir);
      answerPlain = plainIrrational(v, ir);
      steps.push({ id: 'approx', title: 'As decimals', eq: decimals.map((x) => `${v} ≈ ${round(x, 3).replace('−', '-')}`).join('  or  ') });
    } else {
      answer = 'No real solutions';
      answerPlain = `No real solutions (${plainIrrational(v, ir)})`;
      steps.push({ id: 'complex', title: 'Complex solutions, if your class uses i', eq: fmtIrrational(v, ir) });
    }
  }

  const h = b.neg().div(a.mul(Rational.of(2)));
  const kv = evalPolyExact(poly, h);
  return { kind: 'ok', v, a, b, c, A, B, C, cleared: L, D, roots, decimals, vertex: { h, k: kv }, answer, answerPlain, steps };
}

function rootPart(k: bigint, r: bigint, imaginary: boolean): Markup {
  const i = imaginary ? 'i' : '';
  if (r === 1n) return k === 1n ? (imaginary ? 'i' : '1') : `${k}${i}`;
  return `${k === 1n ? '' : k}${i}√{${r}}`;
}

export function fmtIrrational(v: string, R: Extract<Roots, { num0: bigint }>): Markup {
  const rad = rootPart(R.k, R.r, R.type === 'complex');
  const top = R.num0 === 0n ? `±${rad}` : `${R.num0} ± ${rad}`;
  if (R.den === 1n) return `${v} = ${top}`;
  if (R.num0 === 0n) return `${v} = ±{${rad}/${R.den}}`;
  return `${v} = {${top}/${R.den}}`;
}

function plainIrrational(v: string, R: Extract<Roots, { num0: bigint }>): string {
  const rad = rootPart(R.k, R.r, R.type === 'complex').replace(/√\{(\d+)\}/, '√$1');
  const top = R.num0 === 0n ? `±${rad}` : `${R.num0} ± ${rad}`;
  const s = R.den === 1n ? `${v} = ${top}` : R.num0 === 0n ? `${v} = ±${rad}/${R.den}` : `${v} = (${top})/${R.den}`;
  return s.replace(/-/g, '−');
}

/** Graphable text for y = the polynomial. */
export function quadGraphText(poly: Poly): string {
  return `y = ${fmtPoly(poly, 'x').replace(/\{(\d+)\/(\d+)\}/g, '($1/$2)')}`;
}

// ─── Lesson ─────────────────────────────────────────────────────────

export function buildQuadLesson(r: Extract<QuadResult, { kind: 'ok' }>): LessonDecision[] {
  const { A, B, C, D, v } = r;
  const RA = Rational.of(A);
  const RB = Rational.of(B);
  const RC = Rational.of(C);
  const out: LessonDecision[] = [];
  const abc = (a: Rational, b: Rational, c: Rational) => `$a = ${fmtR(a)}$, $b = ${fmtR(b)}$, $c = ${fmtR(c)}$`;
  const opts = [
    { id: 'right', label: abc(RA, RB, RC) },
    { id: 'signB', label: abc(RA, RB.neg(), RC) },
    { id: 'swap', label: abc(RA, RC, RB) },
    { id: 'signC', label: abc(RA, RB, RC.neg()) },
  ].filter((o, i, arr) => arr.findIndex((p) => p.label === o.label) === i).slice(0, 3);
  out.push({
    id: 'abc',
    teach: `The quadratic formula needs the equation in **standard form**, $a${v}^2 + b${v} + c = 0$. Then a, b and c are the numbers in front, and each one keeps the sign in front of it.`,
    why: 'Signs travel with their coefficients: a minus in front of a term makes its coefficient negative.',
    answer: 'right',
    prompt: `${r.cleared !== 1n ? `After clearing fractions (× ${r.cleared}), it` : 'It'} has to read $a${v}^2 + b${v} + c = 0$. Which are a, b and c?`,
    context: `${fmtSigned(A, B, C, v)} = 0`,
    input: { kind: 'choice', options: rotate(opts, Number((A + B + C) % 3n)) },
    hints: ['Each coefficient keeps the sign in front of it.', 'c is the number with no variable.'],
    after: `a = ${fmtR(RA)},  b = ${fmtR(RB)},  c = ${fmtR(RC)}`,
    check: (id) =>
      id === 'right'
        ? { ok: true }
        : id === 'swap'
          ? { ok: false, feedback: `b goes with ${v}, c is the plain number.` }
          : { ok: false, feedback: 'Check the sign. A minus in front of a term belongs to its coefficient.' },
  });
  out.push({
    id: 'disc',
    teach: 'The **discriminant**, $b^2 - 4ac$, is the part under the square root. Work it out first: it tells you how many solutions to expect.',
    why: `${bn(B)}² = ${B * B} and 4 · ${bn(A)} · ${bn(C)} = ${neg(4n * A * C)}, so the discriminant is ${B * B} − ${bn(4n * A * C)} = ${neg(D)}.`,
    answer: String(D),
    prompt: 'Work out the discriminant, $b^2 - 4ac$.',
    context: `${fmtRParen(RB)}^2 - 4(${fmtR(RA)})(${fmtR(RC)})`,
    input: { kind: 'number', label: 'D' },
    helper: 'calculator',
    calc: `${calcNum(RB)}² − 4 × ${calcNum(RA)} × ${calcNum(RC)}`,
    hints: [`Square b first: ${fmtRParen(RB).replace(/-/g, '−')}² = ${B * B}. A negative squared is positive.`, `Then 4·a·c = ${4n * A * C}.`],
    after: `b^2 - 4ac = ${D}`,
    check: (raw) => {
      const a = parseAnswer(raw);
      if (!a || a.kind !== 'value' || !a.v.isInteger()) return { ok: false, feedback: 'The discriminant is a whole number here.' };
      const x = a.v.n;
      if (x === D) return { ok: true };
      if (x === B * B + 4n * A * C) return { ok: false, feedback: "It's minus 4ac. Watch the signs when a or c is negative." };
      if (x === -B * B - 4n * A * C) return { ok: false, feedback: 'b² is always positive: a negative times a negative.' };
      if (x === B * B - A * C) return { ok: false, feedback: "Don't forget the 4 in 4ac." };
      return { ok: false, feedback: `b² is ${B * B} and 4ac is ${4n * A * C}. Subtract.` };
    },
  });
  out.push({
    id: 'count',
    teach: 'The formula takes ± the square root of the discriminant. A positive number has two square roots, zero has one, and a negative number has none among the real numbers.',
    why: D > 0n ? `${D} is positive, so the ± gives two different solutions.` : D === 0n ? 'With 0 under the root, + and − give the same answer: one solution.' : `${neg(D)} is negative, and no real number squares to a negative.`,
    answer: D > 0n ? 'two' : D === 0n ? 'one' : 'none',
    prompt: `The discriminant is ${D}. How many real solutions?`,
    input: {
      kind: 'choice',
      options: [
        { id: 'two', label: 'Two' },
        { id: 'one', label: 'One' },
        { id: 'none', label: 'None (real ones, anyway)' },
      ],
    },
    hints: ['Positive: two. Zero: one. Negative: none, since you can’t take the square root of a negative.'],
    after: D > 0n ? 'two real solutions' : D === 0n ? 'one real solution' : 'no real solutions',
    check: (id) => {
      const want = D > 0n ? 'two' : D === 0n ? 'one' : 'none';
      return id === want ? { ok: true } : { ok: false, feedback: D < 0n ? 'A negative discriminant means √(negative), which isn’t a real number.' : D === 0n ? 'With √0 = 0, the ± gives the same answer twice.' : 'A positive discriminant has a real square root, and the ± gives two answers.' };
    },
  });
  if (D < 0n) return out;

  if (r.roots.type === 'rational') {
    const want = r.roots.r;
    out.push({
      id: 'roots',
      teach: `Now the whole formula: $${v} = {-b ± √{b^2 - 4ac}/2a}$. The ± means do it twice: once adding the square root, once subtracting it.`,
      why: 'Each solution makes the equation true. Try putting one back in.',
      answer: want.map((x) => x.toString()).join(', '),
      prompt: want.length === 1 ? `√0 = 0, so ${v} = −b ⁄ 2a. What is ${v}?` : `√${D} is a whole number. Finish the formula: what are both solutions?`,
      context: `${v} = {${fmtR(RB.neg())} ± √{${D}}/${2n * A}}`,
      input: { kind: 'number', label: want.length === 1 ? v : 'both' },
      helper: 'calculator',
      calc: `(${calcNum(RB.neg())} + √(${D})) ÷ (2 × ${calcNum(RA)})`,
      hints: [want.length === 1 ? `${plainR(RB.neg())} ÷ ${2n * A}.` : `√${D} = ${squareFree(D).k}. Do the + and the − separately.`, 'Type both, separated by a comma.'],
      after: r.answer,
      check: (raw) => {
        const got = (raw.replace(/[−–]/g, '-').match(/-?\d+(?:\.\d+)?(?:\/\d+)?/g) ?? []).map((t) => Rational.parse(t)).filter(Boolean) as Rational[];
        if (!got.length) return { ok: false, feedback: 'Type the solution(s), like 2, 3.' };
        const matches = want.every((w) => got.some((g) => g.equals(w))) && got.every((g) => want.some((w) => w.equals(g)));
        if (matches) return { ok: true };
        if (want.length === 2 && got.length === 1 && want.some((w) => w.equals(got[0]))) return { ok: false, feedback: 'That’s one of them. The ± gives a second.' };
        if (got.some((g) => want.some((w) => w.equals(g.neg())))) return { ok: false, feedback: 'Signs flipped: the formula starts with −b.' };
        return { ok: false, feedback: 'Do the + version and the − version separately, then divide each by 2a.' };
      },
    });
  } else {
    const R = r.roots as Extract<Roots, { num0: bigint }>;
    const right = fmtIrrational(v, R);
    const signErr = fmtIrrational(v, { ...R, num0: -R.num0 });
    const halfDiv = `${v} = ${fmtR(RB.neg())} ± {${rootPart(squareFree(D).k, R.r, false)}/${2n * A}}`;
    const options = [
      { id: 'right', label: `$${right}$` },
      { id: 'sign', label: `$${signErr}$` },
      { id: 'half', label: `$${halfDiv}$` },
    ].filter((o, i, arr) => arr.findIndex((p) => p.label === o.label) === i);
    out.push({
      id: 'roots',
      teach: `√${D} isn’t a whole number, so the exact answer keeps a square root. Simplify it by pulling out the biggest perfect-square factor, and remember the 2a divides the whole top.`,
      why: `As decimals that’s about ${r.decimals.map((x) => round(x, 3)).join(' and ')}, but the root form is exact.`,
      answer: 'right',
      prompt: `√${D} doesn't come out whole, so the answer keeps the root. Which is it, simplified?`,
      context: `${v} = {${fmtR(RB.neg())} ± √{${D}}/${2n * A}}`,
      input: { kind: 'choice', options: rotate(options, Number(D % 3n)) },
      hints: [squareFree(D).k > 1n ? `√${D} = ${squareFree(D).k}√${R.r}.` : `√${D} doesn't simplify.`, 'The 2a divides the whole top, both −b and the root.'],
      after: right,
      check: (id) =>
        id === 'right'
          ? { ok: true }
          : id === 'sign'
            ? { ok: false, feedback: 'The formula starts with −b, so flip the sign of b.' }
            : { ok: false, feedback: 'The fraction bar goes under everything: 2a divides −b too.' },
    });
  }
  out.push({
    id: 'vertex',
    teach: 'A parabola is symmetric, so its turning point (the vertex) sits exactly halfway between the roots, at $x = {-b/2a}$.',
    why: `The axis of symmetry is x = ${plainR(r.vertex.h)}, and the vertex is (${plainR(r.vertex.h)}, ${plainR(r.vertex.k)}).`,
    answer: r.vertex.h.toString(),
    optional: true,
    prompt: 'Bonus: the vertex sits halfway between the roots, at $x = {-b/2a}$. What is that x?',
    input: { kind: 'number', label: 'x' },
    hints: [`${plainR(RB.neg())} ÷ ${2n * A}.`],
    after: `vertex (${fmtR(r.vertex.h)}, ${fmtR(r.vertex.k)})`,
    check: (raw) => {
      const a = parseAnswer(raw);
      if (!a || a.kind !== 'value') return { ok: false, feedback: 'Try a number or fraction.' };
      return a.v.equals(r.vertex.h) ? { ok: true } : a.v.equals(r.vertex.h.neg()) ? { ok: false, feedback: 'Check the sign: it’s −b.' } : { ok: false, feedback: `−b is ${plainR(RB.neg())} and 2a is ${2n * A}.` };
    },
  });
  return out;
}

/** A bigint with a true minus sign, in parentheses when negative: (−5). */
const neg = (n: bigint) => (n < 0n ? `−${-n}` : `${n}`);
const bn = (n: bigint) => (n < 0n ? `(${neg(n)})` : `${n}`);

function fmtSigned(A: bigint, B: bigint, C: bigint, v: string): Markup {
  return fmtPoly([Rational.of(C), Rational.of(B), Rational.of(A)], v);
}

function rotate<T>(arr: T[], n: number): T[] {
  const k = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}
