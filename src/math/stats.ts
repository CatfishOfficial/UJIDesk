import { Rational } from './rational';
import { fmtR, fmtRParen, type Markup } from './markup';
import { checkNumber, parseNumberList, plainR, round } from './surd';
import type { Step } from './steps';
import type { LessonDecision } from './lessons';
import { numberFeedback } from './geometry';
import { calcNum } from './calcExpr';

/** Mean, median, mode and range of a list, exactly. */
export type StatsResult =
  | {
      kind: 'ok';
      values: Rational[];
      sorted: Rational[];
      n: number;
      sum: Rational;
      mean: Rational;
      median: Rational;
      /** Middle index (or the two middle indexes) in the sorted list. */
      middle: number[];
      modes: Rational[];
      modeCount: number;
      min: Rational;
      max: Rational;
      range: Rational;
      steps: Step[];
      answer: Markup;
      answerPlain: string;
    }
  | { kind: 'error'; message: string };

/** Long lists get shortened in the steps so they stay readable. */
export function listMarkup(xs: Rational[], highlight: number[] = []): Markup {
  const show = (x: Rational, i: number) => (highlight.includes(i) ? `[${fmtR(x)}]` : fmtR(x));
  if (xs.length <= 14) return xs.map(show).join(', ');
  return [...xs.slice(0, 6).map(show), '…', ...xs.slice(-4).map((x, i) => show(x, xs.length - 4 + i))].join(', ');
}

/** Statistics read best as decimals: 15.5, or 17/3 ≈ 5.667 when it repeats. */
const terminates = (d: bigint) => {
  while (d % 2n === 0n) d /= 2n;
  while (d % 5n === 0n) d /= 5n;
  return d === 1n;
};
const exactOrRound = (r: Rational) =>
  r.isInteger() ? fmtR(r) : terminates(r.d) && r.d <= 10000n ? String(r.toNumber()).replace('-', '-') : `${fmtR(r)} ≈ ${round(r.toNumber(), 3).replace('−', '-')}`;
const plainExact = (r: Rational) => (r.isInteger() || (terminates(r.d) && r.d <= 10000n) ? String(r.toNumber()).replace('-', '−') : `${plainR(r)} ≈ ${round(r.toNumber(), 3)}`);

export function solveStats(raw: string): StatsResult {
  const p = parseNumberList(raw.replace(/\b(mean|median|mode|range|average|of|find|the|and|data|set)\b|:/gi, ' '));
  if (!p.ok) return { kind: 'error', message: p.error };
  const values = p.values;
  if (values.length < 2) return { kind: 'error', message: 'Statistics need at least two numbers.' };
  if (values.length > 500) return { kind: 'error', message: 'That is a lot of numbers. This tool handles up to 500.' };
  const n = values.length;
  const sorted = [...values].sort((a, b) => a.sub(b).sign());
  const sum = values.reduce((a, b) => a.add(b), Rational.ZERO);
  const mean = sum.div(Rational.of(n));
  const middle = n % 2 ? [(n - 1) / 2] : [n / 2 - 1, n / 2];
  const median = middle.length === 1 ? sorted[middle[0]] : sorted[middle[0]].add(sorted[middle[1]]).div(Rational.of(2));
  const counts = new Map<string, { v: Rational; c: number }>();
  for (const v of sorted) {
    const k = v.toString();
    counts.set(k, { v, c: (counts.get(k)?.c ?? 0) + 1 });
  }
  const top = Math.max(...[...counts.values()].map((x) => x.c));
  const allSame = [...counts.values()].every((x) => x.c === top);
  const modes = top > 1 && !(allSame && counts.size > 1) ? [...counts.values()].filter((x) => x.c === top).map((x) => x.v) : [];
  const min = sorted[0];
  const max = sorted[n - 1];
  const range = max.sub(min);

  const steps: Step[] = [
    { id: 'sort', title: `Put the ${n} numbers in order`, eq: listMarkup(sorted), lesson: 'median' },
    { id: 'sum', title: 'Add them all up', eq: `sum = ${fmtR(sum)}`, lesson: 'sum' },
    { id: 'mean', title: 'Mean: the sum shared equally', eq: `mean = {${fmtR(sum)}/${n}} = ${exactOrRound(mean)}`, lesson: 'mean' },
    {
      id: 'median',
      title: n % 2 ? `Median: the middle number (position ${middle[0] + 1})` : `Median: halfway between the two middle numbers (positions ${middle[0] + 1} and ${middle[1] + 1})`,
      eq: n % 2 ? `median = ${fmtR(median)}` : `median = {${fmtR(sorted[middle[0]])} + ${fmtR(sorted[middle[1]])}/2} = ${exactOrRound(median)}`,
      lesson: 'median',
    },
    {
      id: 'mode',
      title: modes.length ? `Mode: what shows up most (${top} times)` : 'Mode: nothing repeats more than anything else',
      eq: modes.length ? `mode = ${modes.map(fmtR).join(', ')}` : 'no mode',
      note: modes.length > 1 ? 'A tie is allowed: a list can have more than one mode.' : undefined,
      lesson: 'mode',
    },
    { id: 'range', title: 'Range: biggest minus smallest', eq: `range = ${fmtR(max)} - ${fmtRParen(min)} = ${fmtR(range)}`, lesson: 'range' },
  ];
  // The headline keeps to short numbers; repeating decimals show as ≈ and the exact fraction goes in the steps.
  const short = (r: Rational) => (r.isInteger() || (terminates(r.d) && r.d <= 10000n) ? exactOrRound(r) : null);
  const answer = `mean ${short(mean) ? `= ${short(mean)}` : `≈ ${round(mean.toNumber(), 2).replace('−', '-')}`},  median ${short(median) ? `= ${short(median)}` : `≈ ${round(median.toNumber(), 2).replace('−', '-')}`}`;
  const answerPlain = `Mean ${plainExact(mean)}, median ${plainExact(median)}, mode ${modes.length ? modes.map(plainR).join(', ') : 'none'}, range ${plainR(range)}`;
  return { kind: 'ok', values, sorted, n, sum, mean, median, middle, modes, modeCount: top, min, max, range, steps, answer, answerPlain };
}

export function buildStatsLesson(r: Extract<StatsResult, { kind: 'ok' }>): LessonDecision[] {
  const out: LessonDecision[] = [
    {
      id: 'sum',
      teach: 'The **mean** is the “fair share”: what each value would be if they were pooled and split evenly. Step one is the pool: add everything up.',
      why: `The values add up to ${plainR(r.sum)}.`,
      answer: r.sum.toString(),
      prompt: `For the mean, first add up all ${r.n} numbers. What is the sum?`,
      context: listMarkup(r.values),
      input: { kind: 'number', label: 'sum' },
      helper: 'calculator',
      calc: r.n <= 12 ? r.values.map(calcNum).join(' + ') : undefined,
      hints: ['Add them one at a time, or use the calculator.'],
      after: `sum = ${fmtR(r.sum)}`,
      check: (raw) => {
        const v = checkNumber(raw, r.sum.toNumber());
        return numberFeedback(v === 'exact' || v === 'invalid' ? v : 'wrong', 'Not quite. Add them again carefully.');
      },
    },
    {
      id: 'mean',
      teach: `Now split the total evenly: divide it by how many values there are (${r.n}).`,
      why: `$${fmtR(r.sum)} ÷ ${r.n} = ${exactOrRound(r.mean)}$`,
      answer: r.mean.isInteger() ? r.mean.toString() : round(r.mean.toNumber(), 2),
      prompt: `Now share the sum equally: divide by how many numbers there are (${r.n}). What is the mean?`,
      context: `mean = {${fmtR(r.sum)}/${r.n}}`,
      input: { kind: 'number', label: 'mean' },
      helper: 'calculator',
      calc: `${calcNum(r.sum)} ÷ ${r.n}`,
      hints: [`${plainR(r.sum)} ÷ ${r.n}.`],
      after: `mean = ${exactOrRound(r.mean)}`,
      check: (raw) => {
        if (checkNumber(raw, r.sum.toNumber()) === 'exact' && r.n > 1) return { ok: false, feedback: 'That is the sum. Divide it by how many numbers there are.' };
        if (checkNumber(raw, r.median.toNumber()) === 'exact' && !r.median.equals(r.mean)) return { ok: false, feedback: "That's the median. The mean is the sum divided by the count." };
        return numberFeedback(checkNumber(raw, r.mean.toNumber(), { places: 2 }));
      },
    },
    {
      id: 'median',
      teach: `The **median** is the middle value once the data is sorted, smallest to largest: half the values are below it and half above.${r.n % 2 ? '' : ' With an even count there are two middle values, so take the number halfway between them.'}`,
      why: r.n % 2 ? `Sorted, value number ${r.middle[0] + 1} of ${r.n} is ${plainR(r.median)}.` : `The two middle values are ${plainR(r.sorted[r.middle[0]])} and ${plainR(r.sorted[r.middle[1]])}; halfway between them is ${plainR(r.median)}.`,
      answer: r.median.toString(),
      prompt: r.n % 2 ? 'Sorted, which number sits exactly in the middle? That’s the median.' : 'There’s an even count, so the median is halfway between the two middle numbers. What is it?',
      context: listMarkup(r.sorted),
      input: { kind: 'number', label: 'median' },
      hints: [r.n % 2 ? `It's number ${r.middle[0] + 1} of ${r.n}.` : `The middle two are ${plainR(r.sorted[r.middle[0]])} and ${plainR(r.sorted[r.middle[1]])}. Average them.`],
      after: `median = ${exactOrRound(r.median)}`,
      check: (raw) => {
        const mid = Math.floor(r.values.length / 2);
        if (checkNumber(raw, r.values[mid].toNumber()) === 'exact' && !r.values[mid].equals(r.median)) return { ok: false, feedback: 'Sort the list first. The median is the middle of the sorted list.' };
        return numberFeedback(checkNumber(raw, r.median.toNumber(), { places: 2 }));
      },
    },
    {
      id: 'mode',
      teach: 'The **mode** is the value that shows up most often. A list can have one mode, a tie between several, or none if nothing repeats more than the rest.',
      why: r.modes.length ? `${r.modes.map(plainR).join(' and ')} ${r.modes.length > 1 ? 'each appear' : 'appears'} ${r.modeCount} times, more than any other value.` : 'No value shows up more often than the others.',
      answer: r.modes.length ? r.modes.map((m) => m.toString()).join(', ') : 'none',
      prompt: 'Which value shows up most often? Type “none” if nothing repeats more than the rest.',
      context: listMarkup(r.sorted),
      input: { kind: 'number', label: 'mode' },
      hints: ['Count how many times each value appears.'],
      after: r.modes.length ? `mode = ${r.modes.map(fmtR).join(', ')}` : 'no mode',
      check: (raw) => {
        const t = raw.trim().toLowerCase();
        if (/^(none|no mode|no|n\/a|-|—)$/.test(t)) return r.modes.length ? { ok: false, feedback: `Something does repeat: one value appears ${r.modeCount} times.` } : { ok: true };
        const got = (raw.replace(/[−–]/g, '-').match(/-?\d*\.?\d+(?:\/\d+)?/g) ?? []).map((x) => Rational.parse(x)).filter(Boolean) as Rational[];
        if (!got.length) return { ok: false, feedback: 'Type a number (or a few, for a tie), or “none”.' };
        if (!r.modes.length) return { ok: false, feedback: 'Every value shows up equally often, so there is no mode.' };
        const ok = got.length === r.modes.length && r.modes.every((m) => got.some((g) => g.equals(m)));
        if (ok) return { ok: true };
        if (got.every((g) => r.modes.some((m) => m.equals(g)))) return { ok: false, feedback: 'That’s one of them. There’s a tie.' };
        return { ok: false, feedback: `Count again: the mode appears ${r.modeCount} times.` };
      },
    },
    {
      id: 'range',
      teach: 'The **range** measures spread: how far it is from the smallest value to the largest.',
      why: `${plainR(r.max)} − ${r.min.isNegative() ? `(${plainR(r.min)})` : plainR(r.min)} = ${plainR(r.range)}.`,
      answer: r.range.toString(),
      optional: true,
      prompt: 'Bonus: the range is the biggest minus the smallest. What is it?',
      input: { kind: 'number', label: 'range' },
      helper: 'calculator',
      calc: `${calcNum(r.max)} − ${calcNum(r.min)}`,
      hints: [`Biggest ${plainR(r.max)}, smallest ${plainR(r.min)}.`],
      after: `range = ${fmtR(r.range)}`,
      check: (raw) => numberFeedback(checkNumber(raw, r.range.toNumber(), { places: 4 })),
    },
  ];
  return out;
}
