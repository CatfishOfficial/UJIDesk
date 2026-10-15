import { Rational } from './rational';
import { fmtR, fmtTerms, type Markup } from './markup';
import { checkNumber, parseNumberList, plainR } from './surd';
import type { Step } from './steps';
import type { LessonDecision } from './lessons';
import { numberFeedback } from './geometry';
import { parseAnswer } from './answers';
import { calcNum } from './calcExpr';

/**
 * Arithmetic and geometric sequences: the common difference or ratio, the
 * explicit formula, the next term, the nth term and the sum of n terms.
 */
export type SeqResult =
  | {
      kind: 'arithmetic' | 'geometric';
      terms: Rational[];
      a1: Rational;
      /** Common difference (arithmetic) or ratio (geometric). */
      step: Rational;
      next: Rational;
      n: number;
      an: Rational;
      sum: Rational;
      /** Sum to infinity, for a geometric sequence with |r| < 1. */
      infinite: Rational | null;
      formula: Markup;
      steps: Step[];
      answer: Markup;
      answerPlain: string;
    }
  | { kind: 'error'; message: string; field?: 'terms' | 'n' };

const MAX_N_ARITH = 100000;
const MAX_N_GEO = 300;

/** a_n, a₁₂ (subscripts past 9 use real subscript digits). */
export function aSub(k: number | string, letter = 'a'): Markup {
  const s = String(k);
  if (s.length === 1) return `${letter}_${s}`;
  return `${letter}${[...s].map((c) => '₀₁₂₃₄₅₆₇₈₉'[Number(c)] ?? c).join('')}`;
}

/** Big exact values stay readable: 3.2 × 10¹⁵ beyond 15 digits. */
export function bigR(r: Rational): Markup {
  if (r.n.toString().replace('-', '').length <= 15 && r.d.toString().length <= 8) return fmtR(r);
  const v = r.toNumber();
  if (!Number.isFinite(v)) return 'enormous';
  const [m, e] = v.toExponential(4).split('e');
  return `${m.replace(/\.?0+$/, '')} × 10^{${Number(e)}}`;
}

const powR = (r: Rational, k: number) => {
  let out = Rational.ONE;
  for (let i = 0; i < k; i++) out = out.mul(r);
  return out;
};

export function solveSequence(rawTerms: string, rawN: string): SeqResult {
  const p = parseNumberList(rawTerms.replace(/\b(sequence|series|next|term|terms|find|the|of|nth|sum)\b|:/gi, ' '));
  if (!p.ok) return { kind: 'error', message: p.error, field: 'terms' };
  const terms = p.values;
  if (terms.length < 3) return { kind: 'error', message: 'Give at least three terms, so the pattern is clear.', field: 'terms' };
  const nText = rawN.trim();
  let n = terms.length;
  if (nText) {
    const v = Number(nText);
    if (!Number.isInteger(v) || v < 1) return { kind: 'error', message: 'n should be a whole number, like 10.', field: 'n' };
    n = v;
  }

  const diffs = terms.slice(1).map((t, i) => t.sub(terms[i]));
  const isArith = diffs.every((d) => d.equals(diffs[0]));
  const ratios = terms.every((t) => !t.isZero()) ? terms.slice(1).map((t, i) => t.div(terms[i])) : null;
  const isGeo = !!ratios && ratios.every((q) => q.equals(ratios[0]));
  const a1 = terms[0];
  const steps: Step[] = [];

  if (isArith) {
    if (n > MAX_N_ARITH) return { kind: 'error', message: `n is huge. Try one up to ${MAX_N_ARITH.toLocaleString()}.`, field: 'n' };
    const d = diffs[0];
    const next = terms[terms.length - 1].add(d);
    const an = a1.add(d.mul(Rational.of(n - 1)));
    const sum = Rational.of(n).mul(a1.add(an)).div(Rational.of(2));
    const simplified = fmtTerms([{ coef: d, v: 'n' }, { coef: a1.sub(d) }]);
    const formula = `a_n = ${fmtR(a1)} + ${d.isNegative() ? `(${fmtR(d)})` : fmtR(d)}(n - 1)`;
    steps.push({ id: 'type', title: 'Subtract neighbours: the difference never changes, so it’s arithmetic', eq: diffs.slice(0, 4).map(fmtR).join(', ') + (diffs.length > 4 ? ', …' : ''), lesson: 'type' });
    steps.push({ id: 'step', title: 'Common difference', eq: `d = ${fmtR(d)}`, lesson: 'step' });
    steps.push({ id: 'next', title: 'Next term: add d once more', eq: `${fmtR(terms[terms.length - 1])} + ${d.isNegative() ? `(${fmtR(d)})` : fmtR(d)} = ${fmtR(next)}`, lesson: 'next' });
    steps.push({ id: 'formula', title: 'Explicit formula: start at a₁, add d for each step after the first', eq: `${formula} = ${simplified}`, lesson: 'formula' });
    if (nText) steps.push({ id: 'nth', title: `Term ${n}`, eq: `${aSub(n)} = ${fmtR(a1)} + ${d.isNegative() ? `(${fmtR(d)})` : fmtR(d)}(${n - 1}) = ${bigR(an)}`, lesson: 'nth' });
    steps.push({ id: 'sum', title: `Sum of the first ${n} terms: n times the average of the first and last`, eq: `${aSub(n, 'S')} = {${n}(${fmtR(a1)} + ${fmtR(an)})/2} = ${bigR(sum)}`, lesson: 'sum' });
    return {
      kind: 'arithmetic',
      terms,
      a1,
      step: d,
      next,
      n,
      an,
      sum,
      infinite: null,
      formula: `a_n = ${simplified}`,
      steps,
      answer: `a_n = ${simplified}${nText ? `,  ${aSub(n)} = ${bigR(an)}` : `,  next ${fmtR(next)}`}`,
      answerPlain: `Arithmetic, d = ${plainR(d)}. aₙ = ${plainSimple(simplified)}. ${nText ? `a${n} = ${plainR(an)}` : `Next: ${plainR(next)}`}. Sum of ${n}: ${plainR(sum)}`,
    };
  }

  if (isGeo) {
    if (n > MAX_N_GEO) return { kind: 'error', message: `Geometric terms grow fast. Try n up to ${MAX_N_GEO}.`, field: 'n' };
    const r = ratios![0];
    const next = terms[terms.length - 1].mul(r);
    const an = a1.mul(powR(r, n - 1));
    const sum = r.isOne() ? a1.mul(Rational.of(n)) : a1.mul(Rational.ONE.sub(powR(r, n))).div(Rational.ONE.sub(r));
    const infinite = r.abs().sub(Rational.ONE).isNegative() ? a1.div(Rational.ONE.sub(r)) : null;
    const base = r.isNegative() || !r.isInteger() ? `(${fmtR(r)})` : fmtR(r);
    const lead = a1.isOne() ? '' : a1.equals(Rational.of(-1)) ? '-' : `${fmtR(a1)} · `;
    const formula = `a_n = ${lead}${base}^{n-1}`;
    steps.push({ id: 'type', title: 'Divide neighbours: the ratio never changes, so it’s geometric', eq: ratios!.slice(0, 4).map(fmtR).join(', ') + (ratios!.length > 4 ? ', …' : ''), lesson: 'type' });
    steps.push({ id: 'step', title: 'Common ratio', eq: `r = ${fmtR(r)}`, lesson: 'step' });
    steps.push({ id: 'next', title: 'Next term: multiply by r once more', eq: `${fmtR(terms[terms.length - 1])} × ${base} = ${fmtR(next)}`, lesson: 'next' });
    steps.push({ id: 'formula', title: 'Explicit formula: start at a₁, multiply by r for each step after the first', eq: formula, lesson: 'formula' });
    if (nText) steps.push({ id: 'nth', title: `Term ${n}`, eq: `${aSub(n)} = ${lead}${base}^{${n - 1}} = ${bigR(an)}`, lesson: 'nth' });
    steps.push({
      id: 'sum',
      title: `Sum of the first ${n} terms`,
      eq: r.isOne() ? `${aSub(n, 'S')} = ${n} × ${fmtR(a1)} = ${bigR(sum)}` : `${aSub(n, 'S')} = {${fmtR(a1)}(1 - ${base}^{${n}})/1 - ${base}} = ${bigR(sum)}`,
      lesson: 'sum',
    });
    if (infinite) steps.push({ id: 'infinite', title: 'Since |r| < 1, the whole infinite series adds up to', eq: `S = {${fmtR(a1)}/1 - ${base}} = ${fmtR(infinite)}` });
    return {
      kind: 'geometric',
      terms,
      a1,
      step: r,
      next,
      n,
      an,
      sum,
      infinite,
      formula,
      steps,
      answer: `${formula}${nText ? `,  ${aSub(n)} = ${bigR(an)}` : `,  next ${fmtR(next)}`}`,
      answerPlain: `Geometric, r = ${plainR(r)}. aₙ = ${plainSimple(formula.replace('a_n = ', ''))}. ${nText ? `a${n} = ${plainR(an)}` : `Next: ${plainR(next)}`}. Sum of ${n}: ${plainR(sum)}`,
    };
  }

  const d2 = diffs.slice(1).map((d, i) => d.sub(diffs[i]));
  const quad = d2.length > 0 && d2.every((x) => x.equals(d2[0]));
  return {
    kind: 'error',
    message: `That's neither arithmetic nor geometric: the differences are ${diffs.slice(0, 4).map(plainR).join(', ')}${ratios ? ` and the ratios are ${ratios.slice(0, 3).map(plainR).join(', ')}` : ''}.${quad ? ' The differences grow steadily, so it may be a quadratic sequence.' : ''}`,
    field: 'terms',
  };
}

const plainSimple = (m: Markup) =>
  m
    .replace(/\{(\d+)\/(\d+)\}/g, '$1/$2')
    .replace(/\^\{n-1\}/g, 'ⁿ⁻¹')
    .replace(/_n/g, 'ₙ')
    .replace(/-/g, '−');

export function buildSeqLesson(r: Extract<SeqResult, { kind: 'arithmetic' | 'geometric' }>, hasN: boolean): LessonDecision[] {
  const arith = r.kind === 'arithmetic';
  const ctx = `${r.terms.map(fmtR).join(', ')}, …`;
  const out: LessonDecision[] = [
    {
      id: 'type',
      teach: 'Look at how you get from one term to the next. **Arithmetic**: add the same number each time. **Geometric**: multiply by the same number each time. Test it by subtracting neighbours, then by dividing them.',
      why: arith ? `${plainR(r.terms[1])} − ${plainR(r.terms[0])} = ${plainR(r.step)} and ${plainR(r.terms[2])} − ${plainR(r.terms[1])} = ${plainR(r.step)}: the same every time.` : `${plainR(r.terms[1])} ÷ ${plainR(r.terms[0])} = ${plainR(r.step)} and ${plainR(r.terms[2])} ÷ ${plainR(r.terms[1])} = ${plainR(r.step)}: the same every time.`,
      answer: r.kind,
      prompt: 'Look at how you get from one term to the next. What kind of sequence is it?',
      context: ctx,
      input: {
        kind: 'choice',
        options: [
          { id: 'arithmetic', label: 'Arithmetic: add the same amount each time' },
          { id: 'geometric', label: 'Geometric: multiply by the same amount each time' },
        ],
      },
      hints: ['Try subtracting neighbours. If that isn’t constant, try dividing.'],
      after: arith ? 'arithmetic' : 'geometric',
      check: (id) => (id === r.kind ? { ok: true } : { ok: false, feedback: arith ? 'Subtract neighbours: the gap is the same every time.' : 'The gaps grow, but dividing neighbours gives the same number.' }),
    },
    {
      id: 'step',
      teach: arith ? 'The common difference d is what you add each step: any term minus the one before it.' : 'The common ratio r is what you multiply by each step: any term divided by the one before it.',
      why: arith ? (r.step.isNegative() ? `d = ${plainR(r.step)}. A negative difference means the terms go down.` : `d = ${plainR(r.step)}.`) : r.step.isNegative() ? `r = ${plainR(r.step)}. A negative ratio makes the signs flip back and forth.` : r.step.abs().sub(Rational.ONE).isNegative() ? `r = ${plainR(r.step)}. Between 0 and 1, so the terms shrink.` : `r = ${plainR(r.step)}.`,
      answer: r.step.toString(),
      prompt: arith ? 'What is the common difference $d$?' : 'What is the common ratio $r$?',
      context: ctx,
      input: { kind: 'number', label: arith ? 'd' : 'r' },
      hints: [arith ? `${plainR(r.terms[1])} − ${plainR(r.terms[0])}.` : `${plainR(r.terms[1])} ÷ ${plainR(r.terms[0])}.`],
      after: `${arith ? 'd' : 'r'} = ${fmtR(r.step)}`,
      check: (raw) => {
        const a = parseAnswer(raw);
        if (!a || a.kind !== 'value') return { ok: false, feedback: 'Try a number or fraction.' };
        if (a.v.equals(r.step)) return { ok: true };
        if (a.v.equals(r.step.neg())) return { ok: false, feedback: 'Check the direction: later term minus earlier term.' };
        if (!arith && !r.step.isZero() && a.v.equals(r.step.recip())) return { ok: false, feedback: 'Upside down: divide a later term by the one before it.' };
        return { ok: false, feedback: arith ? 'Subtract a term from the one after it.' : 'Divide a term by the one before it.' };
      },
    },
    {
      id: 'next',
      teach: arith ? 'Keep the pattern going: add d to the last term.' : 'Keep the pattern going: multiply the last term by r.',
      why: `${plainR(r.terms[r.terms.length - 1])} ${arith ? '+' : '×'} ${r.step.isNegative() ? `(${plainR(r.step)})` : plainR(r.step)} = ${plainR(r.next)}.`,
      answer: r.next.toString(),
      prompt: 'So what comes next?',
      context: ctx,
      input: { kind: 'number', label: 'next' },
      hints: [arith ? `Add ${plainR(r.step)} to the last term.` : `Multiply the last term by ${plainR(r.step)}.`],
      after: `next: ${fmtR(r.next)}`,
      check: (raw) => {
        const a = parseAnswer(raw);
        if (!a || a.kind !== 'value') return { ok: false, feedback: 'Try a number or fraction.' };
        return a.v.equals(r.next) ? { ok: true } : { ok: false, feedback: arith ? 'Add the difference to the last term.' : 'Multiply the last term by the ratio.' };
      },
    },
  ];
  if (hasN) {
    out.push({
      id: 'nth',
      teach: arith ? `To jump straight to term ${r.n} without listing them all, start at a₁ and add d once for each step after the first: n − 1 = ${r.n - 1} steps.` : `To jump straight to term ${r.n}, start at a₁ and multiply by r once for each step after the first: n − 1 = ${r.n - 1} times.`,
      why: `$${aSub(r.n)} = ${bigR(r.an)}$`,
      answer: r.an.toString(),
      prompt: arith ? `Use $a_n = a_1 + (n - 1)d$. What is term ${r.n}?` : `Use $a_n = a_1 · r^{n-1}$. What is term ${r.n}?`,
      context: r.formula,
      input: { kind: 'number', label: aSub(r.n).replace('_', '') },
      helper: 'calculator',
      calc: arith ? `${calcNum(r.a1)} + ${r.n - 1} × ${calcNum(r.step)}` : `${calcNum(r.a1)} × ${calcNum(r.step)}^${r.n - 1}`,
      hints: [arith ? `${plainR(r.a1)} + ${r.n - 1} × ${plainR(r.step)}.` : `${plainR(r.a1)} × ${plainR(r.step)}^${r.n - 1}.`, `Watch out: it's n − 1 steps from the first term, not n.`],
      after: `${aSub(r.n)} = ${bigR(r.an)}`,
      check: (raw) => {
        const v = checkNumber(raw, r.an.toNumber(), { places: 2 });
        const offByOne = arith ? r.a1.add(r.step.mul(Rational.of(r.n))) : r.a1.mul(powRs(r.step, r.n));
        if (v !== 'exact' && v !== 'rounded' && checkNumber(raw, offByOne.toNumber()) === 'exact') return { ok: false, feedback: 'Off by one step: from term 1 to term n is n − 1 steps.' };
        return numberFeedback(v);
      },
    });
  }
  out.push({
    id: 'sum',
    teach: arith ? 'Pair the first term with the last, the second with the second-to-last, and so on: every pair adds to the same total, and there are n ÷ 2 pairs. So $S_n = {n(a_1 + a_n)/2}$.' : 'A geometric series has a formula that adds them all at once: $S_n = {a_1(1 - r^n)/1 - r}$.',
    why: `$${aSub(r.n, 'S')} = ${bigR(r.sum)}$`,
    answer: r.sum.toString(),
    optional: true,
    prompt: `Bonus: add up the first ${r.n} terms. What is $${aSub(r.n, 'S')}$?`,
    input: { kind: 'number', label: 'sum' },
    helper: 'calculator',
    calc: arith ? `${r.n} × (${calcNum(r.a1)} + ${calcNum(r.an)}) ÷ 2` : undefined,
    hints: [arith ? 'n × (first + last) ÷ 2.' : 'a₁(1 − rⁿ) ÷ (1 − r).'],
    after: `${aSub(r.n, 'S')} = ${bigR(r.sum)}`,
    check: (raw) => numberFeedback(checkNumber(raw, r.sum.toNumber(), { places: 2 })),
  });
  return out;
}

function powRs(r: Rational, k: number) {
  let out = Rational.ONE;
  for (let i = 0; i < k; i++) out = out.mul(r);
  return out;
}

