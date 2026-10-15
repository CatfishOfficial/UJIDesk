import { Rational } from './rational';
import { fmtR, fmtTerms, type Markup } from './markup';
import { coef, degree, fmtPoly, gcdBig, lcmDenominators, mulPoly, parsePoly, polyEquals, type Poly } from './poly';
import { squareFree } from './surd';
import type { Step } from './steps';
import type { LessonDecision } from './lessons';
import { parseAnswer } from './answers';
import { plainR } from './surd';
import { calcNum } from './calcExpr';

/**
 * Factoring ax² + bx + c over the integers: greatest common factor first
 * (including powers of x), then the AC method (or the quick monic version),
 * with grouping shown step by step. Says honestly when it's prime.
 */
interface Lin {
  m: bigint;
  n: bigint;
}

export type FactorResult =
  | {
      kind: 'factored' | 'prime' | 'gcfOnly';
      v: string;
      poly: Poly;
      isEquation: boolean;
      /** Signed numeric GCF and the power of x taken out. */
      content: Rational;
      xPow: number;
      /** What's left after the GCF: a x² + b x + c (or a x + b). */
      prim: bigint[];
      factors: Lin[];
      /** AC-method pair: p·q = ac, p + q = b. */
      pair?: [bigint, bigint];
      pattern?: 'square' | 'diffSquares';
      answer: Markup;
      answerPlain: string;
      steps: Step[];
      /** Zero-product solutions when it was typed as an equation. */
      roots?: Rational[];
    }
  | { kind: 'error'; message: string };

const WORDS = /\b(factor|factorise|factorize|completely|fully|the|expression|trinomial|polynomial)\b|:/gi;

export function solveFactoring(src: string): FactorResult {
  const p = parsePoly(src.replace(WORDS, ' ').trim());
  if (!p.ok) return { kind: 'error', message: p.error };
  const { poly, variable: v, isEquation } = p.value;
  const d = degree(poly);
  if (d < 1) return { kind: 'error', message: d < 0 ? 'Everything cancels to 0, so there is nothing to factor.' : "That's just a number. Factoring needs a variable." };

  // Lowest power of x present: that much x is common to every term.
  let xPow = 0;
  while (coef(poly, xPow).isZero()) xPow++;
  const rest = poly.slice(xPow);
  if (rest.length - 1 > 2) return { kind: 'error', message: `After taking out common factors this is still degree ${rest.length - 1}. This tool factors quadratics (ax² + bx + c).` };

  // Numeric GCF: gcd of numerators over lcm of denominators, signed so the lead is positive.
  const L = lcmDenominators(rest);
  const ints = rest.map((c) => c.mul(Rational.of(L)).n);
  let g = ints.reduce((acc, x) => gcdBig(acc, x), 0n);
  if (ints[ints.length - 1] < 0n) g = -g;
  const content = Rational.of(g, L);
  const prim = ints.map((x) => x / g);

  const steps: Step[] = [];
  const hasGcf = !content.isOne() || xPow > 0;
  const gcfMarkup = gcfText(content, xPow, v);
  const primPoly = prim.map((x) => Rational.of(x));
  if (hasGcf) {
    steps.push({
      id: 'gcf',
      title: content.isNegative() ? 'Take out the greatest common factor (with the minus, so the lead is positive)' : 'Take out the greatest common factor',
      eq: `${gcfMarkup}(${fmtPoly(primPoly, v)})`,
      lesson: 'gcf',
    });
  }

  const base = { v, poly, isEquation, content, xPow, prim };

  if (prim.length === 1) return { kind: 'error', message: "That's a single term, so there's nothing to factor." };

  if (prim.length === 2) {
    // a x + b: the GCF is all there is.
    const f: Lin = { m: prim[1], n: prim[0] };
    const answer = `${gcfMarkup}${linParen(f, v, true)}`;
    steps.push(checkStep(poly, v));
    return {
      ...base,
      kind: hasGcf ? 'gcfOnly' : 'prime',
      factors: [f],
      answer: hasGcf ? answer : fmtPoly(poly, v),
      answerPlain: plainOf(hasGcf ? answer : fmtPoly(poly, v)),
      steps: hasGcf ? steps : [{ id: 'prime', title: 'No common factor, and it’s only degree 1', eq: fmtPoly(poly, v), note: 'It is already as factored as it gets.' }],
      roots: isEquation ? rootsOf(content, xPow, [f]) : undefined,
    };
  }

  const [c, b, a] = prim;
  const D = b * b - 4n * a * c;
  const sq = D >= 0n ? squareFree(D) : null;
  const ac = a * c;

  if (!sq || sq.r !== 1n) {
    if (a !== 1n) steps.push({ id: 'ac', title: 'Multiply a·c', eq: `${a} · ${paren(c)} = ${ac}`, lesson: 'ac' });
    steps.push({
      id: 'nopair',
      title: `No two integers multiply to ${ac} and add to ${b}`,
      eq: `b^2 - 4ac = ${D}`,
      note: `${D < 0n ? 'The discriminant is negative' : `${D} isn't a perfect square`}, which is the giveaway: it doesn't factor over the integers.`,
      lesson: 'pair',
    });
    const answer = hasGcf ? `${gcfMarkup}(${fmtPoly(primPoly, v)})` : fmtPoly(poly, v);
    return { ...base, kind: hasGcf ? 'gcfOnly' : 'prime', factors: [], answer, answerPlain: plainOf(answer), steps, roots: undefined };
  }

  // Rational roots num/den give factors (den·x − num). For (m₁x + n₁)(m₂x + n₂) the AC pair is m₁n₂ and m₂n₁.
  const s = sq.k;
  const roots = [Rational.of(-b - s, 2n * a), Rational.of(-b + s, 2n * a)];
  const f1: Lin = { m: roots[0].d, n: -roots[0].n };
  const f2: Lin = { m: roots[1].d, n: -roots[1].n };
  let p1 = f1.m * f2.n;
  let q1 = f2.m * f1.n;
  // Put the pair in a friendly order: the one sharing a factor with a goes first.
  if (gcdBig(a, p1) < gcdBig(a, q1)) [p1, q1] = [q1, p1];
  const factors = orderFactors([f1, f2]);
  const same = factors[0].m === factors[1].m && factors[0].n === factors[1].n;
  const pattern: 'square' | 'diffSquares' | undefined = same ? 'square' : b === 0n ? 'diffSquares' : undefined;
  const body = same ? `${linParen(factors[0], v, true)}^2` : `${linParen(factors[0], v, true)}${linParen(factors[1], v, true)}`;
  const answer = `${gcfMarkup}${body}`;

  if (a === 1n) {
    steps.push({
      id: 'pair',
      title: `Find two numbers that multiply to ${c} and add to ${b}`,
      eq: `${paren(p1)} · ${paren(q1)} = ${c},  ${paren(p1)} + ${paren(q1)} = ${b}`,
      lesson: 'pair',
    });
    steps.push({ id: 'write', title: 'Each number goes in its own bracket', eq: hasGcf ? `${gcfMarkup}${body}` : body, lesson: 'final' });
  } else {
    steps.push({ id: 'ac', title: 'Multiply a·c', eq: `${a} · ${paren(c)} = ${ac}`, lesson: 'ac' });
    steps.push({ id: 'pair', title: `Find two numbers that multiply to ${ac} and add to ${b}`, eq: `${paren(p1)} · ${paren(q1)} = ${ac},  ${paren(p1)} + ${paren(q1)} = ${b}`, lesson: 'pair' });
    const split = fmtTerms([
      { coef: Rational.of(a), v: `${v}^2` },
      { coef: Rational.of(p1), v },
      { coef: Rational.of(q1), v },
      { coef: Rational.of(c) },
    ]);
    const termPlain = (k: bigint) => (k === 1n ? v : k === -1n ? `−${v}` : `${plainR(Rational.of(k))}${v}`);
    steps.push({ id: 'split', title: `Split the middle term: ${termPlain(b)} = ${termPlain(p1)} ${q1 < 0n ? '−' : '+'} ${termPlain(q1 < 0n ? -q1 : q1)}`, eq: split, lesson: 'final' });
    const g1 = gcdBig(a, p1);
    const inner: Lin = { m: a / g1, n: p1 / g1 };
    const g2 = (q1 < 0n ? -1n : 1n) * gcdBig(q1, c);
    const grouped = `${g1 === 1n ? '' : g1}${v}${linParen(inner, v, true)} ${g2 < 0n ? '-' : '+'} ${g2 < 0n ? (-g2 === 1n ? '' : -g2) : g2 === 1n ? '' : g2}${linParen(inner, v, true)}`;
    steps.push({ id: 'group', title: 'Group in pairs and factor each pair', eq: grouped.replace(/ - \(/, ' - 1(').replace(/ \+ \(/, ' + 1('), lesson: 'final' });
    steps.push({ id: 'common', title: 'Both groups share a bracket, so factor it out', eq: hasGcf ? `${gcfMarkup}${body}` : body, lesson: 'final' });
  }
  if (pattern === 'square') steps.push({ id: 'pattern', title: 'A perfect square trinomial', eq: answer, note: 'Both brackets are the same, so it’s written as a square.' });
  if (pattern === 'diffSquares') steps.push({ id: 'pattern', title: 'A difference of squares', eq: answer, note: 'a² − b² always factors as (a − b)(a + b).' });
  steps.push(checkStep(poly, v));
  if (isEquation) {
    const rs = rootsOf(content, xPow, factors);
    steps.push({ id: 'zero', title: 'Set each factor equal to zero', eq: rs.map((r) => `${v} = ${fmtR(r)}`).join('  or  '), note: 'If a product is 0, one of its factors is 0.' });
  }
  return {
    ...base,
    kind: 'factored',
    factors,
    pair: [p1, q1],
    pattern,
    answer,
    answerPlain: plainOf(answer),
    steps,
    roots: isEquation ? rootsOf(content, xPow, factors) : undefined,
  };
}

function orderFactors(fs: Lin[]): Lin[] {
  return [...fs].sort((x, y) => (x.m === y.m ? Number(y.n - x.n) : Number(y.m - x.m)));
}

function rootsOf(_content: Rational, xPow: number, fs: Lin[]): Rational[] {
  const rs = fs.map((f) => Rational.of(-f.n, f.m));
  if (xPow > 0) rs.unshift(Rational.ZERO);
  return rs.filter((r, i) => rs.findIndex((s) => s.equals(r)) === i).sort((p, q) => p.sub(q).sign());
}

function gcfText(content: Rational, xPow: number, v: string): Markup {
  const num = content.isOne() ? '' : content.equals(Rational.of(-1)) ? '-' : fmtR(content);
  const xs = xPow === 0 ? '' : xPow === 1 ? v : `${v}^${xPow}`;
  return `${num}${xs}`;
}

/** (2x − 3); a lone x with no constant stays bare unless forced. */
function linParen(f: Lin, v: string, force = false): Markup {
  const t = fmtTerms([{ coef: Rational.of(f.m), v }, { coef: Rational.of(f.n) }]);
  return force || f.n !== 0n ? `(${t})` : t;
}

const sgn = (n: bigint) => (n < 0n ? `−${-n}` : `${n}`);
const par = (n: bigint) => (n < 0n ? `(${sgn(n)})` : `${n}`);
const paren = (n: bigint) => (n < 0n ? `(${n})` : `${n}`);
const plainOf = (m: Markup) =>
  m
    .replace(/\{(\d+)\/(\d+)\}/g, '$1/$2')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/-/g, '−');

function checkStep(poly: Poly, v: string): Step {
  return { id: 'check', title: 'Check: multiplying it back out gives the original', eq: `${fmtPoly(poly, v)} ✓` };
}

/** Expands a typed factored form and says whether it equals the target and actually looks factored. */
export function checkFactoredAnswer(raw: string, target: Poly): 'right' | 'notFactored' | 'wrong' | 'invalid' {
  const p = parsePoly(raw);
  if (!p.ok || p.value.isEquation) return 'invalid';
  if (!polyEquals(p.value.poly, target)) return 'wrong';
  const s = raw.replace(/\s+/g, '');
  return /\)\s*\(|\)\^?2|\)²|^[-\d/.]*[a-z]?\^?\d*\(/i.test(s) ? 'right' : 'notFactored';
}

export function expandFactors(content: Rational, xPow: number, fs: Lin[]): Poly {
  let p: Poly = [content];
  for (let i = 0; i < xPow; i++) p = mulPoly(p, [Rational.ZERO, Rational.ONE]);
  for (const f of fs) p = mulPoly(p, [Rational.of(f.n), Rational.of(f.m)]);
  return p;
}

// ─── Lesson ─────────────────────────────────────────────────────────

export function buildFactorLesson(r: Extract<FactorResult, { v: string }>): LessonDecision[] {
  const { v, content, xPow, prim } = r;
  const out: LessonDecision[] = [];
  const hasGcf = !content.isOne() || xPow > 0;
  const primPoly = prim.map((x) => Rational.of(x));

  if (hasGcf) {
    const right = gcfText(content, xPow, v);
    const smaller = xPow > 0 ? gcfText(content, 0, v) : content.abs().isInteger() && content.n % 2n === 0n ? gcfText(content.div(Rational.of(2)), 0, v) : null;
    const opts = [
      { id: 'right', label: `$${right}$` },
      ...(smaller && smaller !== right && smaller !== '' ? [{ id: 'small', label: `$${smaller}$` }] : []),
      { id: 'none', label: 'There isn’t one' },
    ];
    out.push({
      id: 'gcf',
      teach: 'Factoring is multiplying in reverse. **Always** start by taking out the greatest common factor: the largest number (and power of the variable) that divides every term.',
      why: `Dividing every term by $${right}$ leaves $${fmtPoly(primPoly, v)}$.`,
      answer: 'right',
      prompt: 'Always look for a common factor first. What is the greatest one every term shares?',
      context: fmtPoly(r.poly, v),
      input: { kind: 'choice', options: opts },
      hints: ['Look at the numbers and at the powers of the variable separately.', content.isNegative() ? 'Taking out a negative also makes the first term positive, which is tidier.' : 'Biggest number that divides every coefficient.'],
      after: `${right}(${fmtPoly(primPoly, v)})`,
      check: (id) =>
        id === 'right'
          ? { ok: true }
          : id === 'small'
            ? { ok: false, feedback: 'That is a common factor, but a bigger one is hiding.' }
            : { ok: false, feedback: 'Every term shares something here. Check the numbers and the powers.' },
    });
  }
  if (prim.length < 3) return out;
  const [c, b, a] = prim;
  const ac = a * c;
  if (a !== 1n) {
    out.push({
      id: 'ac',
      teach: `When the ${v}² term has a number other than 1 in front, use the **AC method**: multiply a by c. Then look for two numbers that multiply to that and add to b.`,
      why: `${a} × ${par(c)} = ${sgn(ac)}.`,
      answer: String(ac),
      prompt: `${hasGcf ? 'Now the bracket. ' : ''}The leading coefficient isn't 1, so use the AC method. What is $a · c$?`,
      context: fmtPoly(primPoly, v),
      input: { kind: 'number', label: 'ac' },
      helper: 'calculator',
      calc: `${a} × ${calcNum(Rational.of(c))}`,
      hints: [`a = ${a} and c = ${plainR(Rational.of(c))}.`],
      after: `ac = ${ac}`,
      check: (raw) => {
        const x = parseAnswer(raw);
        if (!x || x.kind !== 'value') return { ok: false, feedback: 'Try a whole number.' };
        if (x.v.equals(Rational.of(ac))) return { ok: true };
        if (x.v.equals(Rational.of(-ac))) return { ok: false, feedback: 'Check the sign of c.' };
        return { ok: false, feedback: `Multiply ${a} by ${plainR(Rational.of(c))}.` };
      },
    });
  }
  const target = a === 1n ? c : ac;
  if (r.kind !== 'factored') {
    out.push({
      id: 'pair',
      teach: `Look for two whole numbers that multiply to ${target} and add to ${b}. List the factor pairs of ${target} and add each pair up.`,
      why: `None of the factor pairs of ${target} add to ${b}, so it can’t be factored with whole numbers. That’s called prime.`,
      answer: 'none',
      prompt: `Is there a pair of integers that multiplies to ${target} and adds to ${b}?`,
      input: {
        kind: 'choice',
        options: [
          { id: 'none', label: 'No pair works, so it doesn’t factor (it’s prime)' },
          { id: 'yes', label: 'Yes, there is one' },
        ],
      },
      hints: [`List the factor pairs of ${target} and add each pair.`, `Shortcut: b² − 4ac = ${b * b - 4n * ac} isn't a perfect square.`],
      after: r.answer,
      check: (id) => (id === 'none' ? { ok: true } : { ok: false, feedback: `Try them all: none of the factor pairs of ${target} adds to ${b}.` }),
    });
    return out;
  }
  const [p, q] = r.pair!;
  out.push({
    id: 'pair',
    teach: `List pairs of numbers that multiply to ${target}, and find the pair that adds to ${b}. ${target < 0n ? 'The product is negative, so one number is negative and one positive.' : b < 0n ? 'The product is positive but the sum negative, so both are negative.' : 'Positive product and positive sum: both positive.'}`,
    why: `${sgn(p)} × ${par(q)} = ${sgn(target)} and ${sgn(p)} + ${par(q)} = ${sgn(b)}.`,
    answer: `${p}, ${q}`,
    prompt: `Which two numbers multiply to **${target}** and add to **${b}**?`,
    input: { kind: 'number', label: 'numbers' },
    hints: [target < 0n ? 'The product is negative, so one number is negative and one is positive.' : b < 0n ? 'Positive product, negative sum: both numbers are negative.' : 'Positive product, positive sum: both numbers are positive.', `They are ${p} and ${q}.`],
    after: `${p} · ${paren(q)} = ${target},  ${p} + ${paren(q)} = ${b}`,
    check: (raw) => {
      const got = (raw.replace(/[−–]/g, '-').match(/-?\d+/g) ?? []).map((t) => BigInt(t));
      if (got.length !== 2) return { ok: false, feedback: 'Type two numbers, like 2, -3.' };
      const [x, y] = got;
      if (x * y === target && x + y === b) return { ok: true };
      if (x * y === target) return { ok: false, feedback: `Those multiply to ${target}, but add to ${x + y}. You need ${b}.` };
      if (x + y === b) return { ok: false, feedback: `Those add to ${b}, but multiply to ${x * y}. You need ${target}.` };
      if (-x * -y === target && -x + -y === b) return { ok: false, feedback: 'Right numbers, flip both signs.' };
      return { ok: false, feedback: 'Not quite. List factor pairs of the product and check each sum.' };
    },
  });
  const sw = (f: Lin): Lin => ({ m: f.m, n: -f.n });
  const opts = [
    { id: 'right', label: `$${r.answer}$` },
    { id: 'sign', label: `$${gcfText(content, xPow, v)}${r.factors.map((f) => linParen(sw(f), v, true)).join('')}$` },
  ];
  if (a !== 1n) opts.push({ id: 'pair', label: `$${gcfText(content, xPow, v)}(${v} ${p < 0n ? '-' : '+'} ${p < 0n ? -p : p})(${a}${v} ${q < 0n ? '-' : '+'} ${q < 0n ? -q : q})$` });
  out.push({
    id: 'final',
    teach: a === 1n ? `With a 1 in front of ${v}², each number goes straight into its own bracket with ${v}.` : `Split the middle term into ${p}${v} and ${q}${v}, group the four terms in pairs, factor each pair, then take out the bracket they share.`,
    why: 'Multiply it back out (FOIL) and you get the original expression.',
    answer: 'right',
    prompt: a === 1n ? 'Each number goes into its own bracket with x. Which is the factored form?' : 'Split the middle term with those numbers, group, and factor. Which is the result?',
    input: { kind: 'choice', options: rotate(opts.filter((o, i, arr) => arr.findIndex((x) => x.label === o.label) === i), Number(ac % 3n)) },
    hints: ['Multiply your choice back out. It should give the original.'],
    after: r.answer,
    check: (id) =>
      id === 'right'
        ? { ok: true }
        : id === 'sign'
          ? { ok: false, feedback: 'Multiply it out: the middle term comes out with the wrong sign.' }
          : { ok: false, feedback: "With a leading coefficient, the numbers don't drop straight into the brackets. Group first." },
  });
  return out;
}

function rotate<T>(arr: T[], n: number): T[] {
  const k = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

