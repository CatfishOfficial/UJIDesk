import { Rational } from './rational';
import { checkNumber, round } from './surd';
import type { Markup } from './markup';
import type { Step } from './steps';
import type { LessonDecision } from './lessons';
import { numberFeedback } from './geometry';
import { calcFloat } from './calcExpr';

/**
 * Right-triangle trigonometry with SOH CAH TOA. Sides are named relative to
 * angle A: opposite, adjacent and hypotenuse. Give an angle and a side, or
 * two sides, and everything else is worked out.
 */
export type TrigSide = 'opp' | 'adj' | 'hyp';
export type Ratio = 'sin' | 'cos' | 'tan';

export const SIDE_NAME: Record<TrigSide, string> = { opp: 'opposite', adj: 'adjacent', hyp: 'hypotenuse' };
export const RATIO: Record<Ratio, { sides: [TrigSide, TrigSide]; mnemonic: string; word: string }> = {
  sin: { sides: ['opp', 'hyp'], mnemonic: 'SOH', word: 'sine' },
  cos: { sides: ['adj', 'hyp'], mnemonic: 'CAH', word: 'cosine' },
  tan: { sides: ['opp', 'adj'], mnemonic: 'TOA', word: 'tangent' },
};

/** The ratio that links two sides. */
export const ratioFor = (x: TrigSide, y: TrigSide): Ratio => (['sin', 'cos', 'tan'] as Ratio[]).find((r) => RATIO[r].sides.includes(x) && RATIO[r].sides.includes(y))!;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const fn: Record<Ratio, (x: number) => number> = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
const inv: Record<Ratio, (x: number) => number> = { sin: Math.asin, cos: Math.acos, tan: Math.atan };

/** One unknown worked out: which ratio, and the equation that gave it. */
export interface TrigFind {
  what: TrigSide | 'A';
  ratio: Ratio | 'pythag';
  value: number;
  /** The equation set up, e.g. sin(35°) = opp / 10. */
  setup: Markup;
  solve: Markup;
  from: TrigSide[];
}

export type TrigResult =
  | {
      kind: 'ok';
      A: number;
      B: number;
      sides: Record<TrigSide, number>;
      given: { angle: boolean; sides: TrigSide[] };
      finds: TrigFind[];
      steps: Step[];
      answer: Markup;
      answerPlain: string;
    }
  | { kind: 'error'; message: string; field?: string };

const r2 = (v: number) => round(v, 2).replace('−', '-');
const r1 = (v: number) => round(v, 1).replace('−', '-');

export function solveTrig(inputs: Record<string, string>): TrigResult {
  const read = (k: string): number | null | 'bad' => {
    const t = (inputs[k] ?? '').replace(/°/g, '').trim();
    if (!t || t === '?') return null;
    const q = Rational.parse(t);
    return q && q.sign() > 0 ? q.toNumber() : 'bad';
  };
  const Araw = read('angle');
  if (Araw === 'bad') return { kind: 'error', message: 'The angle should be a positive number of degrees, like 35.', field: 'angle' };
  if (Araw != null && Araw >= 90) return { kind: 'error', message: 'In a right triangle the other two angles are each less than 90°.', field: 'angle' };
  const known: Partial<Record<TrigSide, number>> = {};
  for (const s of ['opp', 'adj', 'hyp'] as TrigSide[]) {
    const v = read(s);
    if (v === 'bad') return { kind: 'error', message: `The ${SIDE_NAME[s]} should be a positive length.`, field: s };
    if (v != null) known[s] = v;
  }
  const ks = Object.keys(known) as TrigSide[];
  const count = ks.length + (Araw != null ? 1 : 0);
  if (count < 2) return { kind: 'error', message: 'Give two things: an angle and a side, or two sides.', field: Araw == null ? 'angle' : 'opp' };
  if (count > 2) return { kind: 'error', message: 'Two is enough: an angle and a side, or two sides. Clear one so nothing disagrees.' };
  if (known.hyp != null && ((known.opp != null && known.opp >= known.hyp) || (known.adj != null && known.adj >= known.hyp)))
    return { kind: 'error', message: 'The hypotenuse is always the longest side.', field: 'hyp' };

  const finds: TrigFind[] = [];
  const steps: Step[] = [];
  let A: number;
  const sides = { ...known } as Record<TrigSide, number>;

  if (Araw != null) {
    A = Araw;
    const s = ks[0];
    steps.push({ id: 'label', title: `Name the sides from angle A = ${r1(A)}°`, eq: `${SIDE_NAME[s]} = ${r2(known[s]!)}`, note: 'Opposite is across from A, adjacent touches A, hypotenuse is across from the right angle.' });
    for (const t of (['opp', 'adj', 'hyp'] as TrigSide[]).filter((x) => x !== s)) {
      const ratio = ratioFor(s, t);
      const [top, bottom] = RATIO[ratio].sides;
      const f = fn[ratio](rad(A));
      // ratio(A) = top / bottom; one of top/bottom is known.
      const value = t === top ? f * known[s]! : known[s]! / f;
      sides[t] = value;
      const setup = `${ratio}(${r1(A)}°) = {${top === s ? r2(known[s]!) : top}/${bottom === s ? r2(known[s]!) : bottom}}`;
      const solve = t === top ? `${t} = ${r2(known[s]!)} × ${ratio}(${r1(A)}°) ≈ ${r2(value)}` : `${t} = {${r2(known[s]!)}/${ratio}(${r1(A)}°)} ≈ ${r2(value)}`;
      finds.push({ what: t, ratio, value, setup, solve, from: [s] });
      steps.push({ id: `ratio-${t}`, title: `${SIDE_NAME[s][0].toUpperCase() + SIDE_NAME[s].slice(1)} and ${SIDE_NAME[t]}: use ${RATIO[ratio].mnemonic}`, eq: setup, lesson: `ratio-${t}` });
      steps.push({ id: `solve-${t}`, title: t === top ? 'Multiply both sides' : 'Rearrange and divide', eq: solve, lesson: `value-${t}` });
    }
  } else {
    const [s1, s2] = ks;
    const ratio = ratioFor(s1, s2);
    const [top, bottom] = RATIO[ratio].sides;
    const q = known[top]! / known[bottom]!;
    A = deg(inv[ratio](q));
    const setup = `${ratio}(A) = {${r2(known[top]!)}/${r2(known[bottom]!)}}`;
    const solve = `A = ${ratio}^{-1}(${round(q, 4).replace('−', '-')}) ≈ ${r1(A)}°`;
    finds.push({ what: 'A', ratio, value: A, setup, solve, from: [s1, s2] });
    steps.push({ id: 'ratio-A', title: `You know the ${SIDE_NAME[top]} and ${SIDE_NAME[bottom]}: use ${RATIO[ratio].mnemonic}`, eq: setup, lesson: 'ratio-A' });
    steps.push({ id: 'solve-A', title: `Undo ${RATIO[ratio].word} with the inverse (${ratio}⁻¹)`, eq: solve, note: 'Make sure the calculator is in degrees.', lesson: 'value-A' });
    const t = (['opp', 'adj', 'hyp'] as TrigSide[]).find((x) => !ks.includes(x))!;
    const value = t === 'hyp' ? Math.hypot(known[s1]!, known[s2]!) : Math.sqrt(Math.abs(known.hyp! ** 2 - known[t === 'opp' ? 'adj' : 'opp']! ** 2));
    sides[t] = value;
    const pyth = t === 'hyp' ? `hyp = √{${r2(known[s1]!)}^2 + ${r2(known[s2]!)}^2} ≈ ${r2(value)}` : `${t} = √{${r2(known.hyp!)}^2 - ${r2(known[t === 'opp' ? 'adj' : 'opp']!)}^2} ≈ ${r2(value)}`;
    finds.push({ what: t, ratio: 'pythag', value, setup: pyth, solve: pyth, from: [s1, s2] });
    steps.push({ id: `solve-${t}`, title: `The ${SIDE_NAME[t]} from the Pythagorean theorem`, eq: pyth, lesson: `value-${t}` });
  }
  const B = 90 - A;
  steps.push({ id: 'B', title: 'The angles add to 180°, so the other acute angle is', eq: `B = 90° - ${r1(A)}° = ${r1(B)}°`, lesson: 'B' });

  const unknownSides = finds.filter((f) => f.what !== 'A');
  const answer = [
    ...(Araw == null ? [`A ≈ ${r1(A)}°`] : []),
    ...unknownSides.map((f) => `${f.what} ≈ ${r2(f.value)}`),
  ].join(',  ');
  const answerPlain = [
    ...(Araw == null ? [`A ≈ ${round(A, 1)}°`] : []),
    ...unknownSides.map((f) => `${SIDE_NAME[f.what as TrigSide]} ≈ ${round(f.value, 2)}`),
    `B ≈ ${round(B, 1)}°`,
  ].join(', ');
  return { kind: 'ok', A, B, sides, given: { angle: Araw != null, sides: ks }, finds, steps, answer, answerPlain };
}

export function buildTrigLesson(r: Extract<TrigResult, { kind: 'ok' }>): LessonDecision[] {
  const out: LessonDecision[] = [];
  const ratioOptions = (['sin', 'cos', 'tan'] as Ratio[]).map((x) => ({
    id: x,
    label: `${RATIO[x].mnemonic}: $${x} = {${RATIO[x].sides[0]}/${RATIO[x].sides[1]}}$`,
  }));
  for (const f of r.finds) {
    if (f.ratio === 'pythag') {
      out.push({
        id: `value-${f.what}`,
        teach: 'With two sides known, the Pythagorean theorem, $a^2 + b^2 = c^2$, gives the third. The hypotenuse plays the part of c.',
        why: `$${f.solve}$`,
        answer: round(f.value, 2),
        prompt: `Two sides are known, so the third comes from the Pythagorean theorem. What is the ${SIDE_NAME[f.what as TrigSide]}?`,
        context: f.setup.split(' ≈ ')[0],
        input: { kind: 'number', label: f.what },
        helper: 'calculator',
        calc:
          f.what === 'hyp'
            ? `√(${calcFloat(r.sides[f.from[0]])}² + ${calcFloat(r.sides[f.from[1]])}²)`
            : `√(${calcFloat(r.sides.hyp)}² − ${calcFloat(r.sides[f.from.find((s) => s !== 'hyp')!])}²)`,
        hints: ['a² + b² = c², where c is the hypotenuse.'],
        after: f.solve,
        check: (raw) => numberFeedback(checkNumber(raw, f.value, { places: 2 })),
      });
      continue;
    }
    const target = f.what === 'A' ? 'the angle' : `the ${SIDE_NAME[f.what]}`;
    const knownNames = f.what === 'A' ? f.from.map((s) => SIDE_NAME[s]).join(' and ') : `angle A and the ${SIDE_NAME[f.from[0]]}`;
    const right = f.ratio;
    out.push({
      id: `ratio-${f.what}`,
      teach: 'Name the sides **from angle A**: the **opposite** side is across from A, the **adjacent** side touches A (and isn’t the hypotenuse), and the **hypotenuse** is the longest side, across from the right angle. SOH CAH TOA then says which ratio uses which two sides.',
      why: `${RATIO[right].mnemonic}: ${right} uses the ${SIDE_NAME[RATIO[right].sides[0]]} and the ${SIDE_NAME[RATIO[right].sides[1]]}, exactly the two sides in play here.`,
      answer: right,
      prompt: `You know ${knownNames}, and you want ${target}. Which ratio connects them?`,
      input: { kind: 'choice', options: ratioOptions },
      hints: ['SOH CAH TOA: Sine = Opposite/Hypotenuse, Cosine = Adjacent/Hypotenuse, Tangent = Opposite/Adjacent.', `Look for the ratio that uses ${f.what === 'A' ? f.from.map((s) => SIDE_NAME[s]).join(' and ') : `the ${SIDE_NAME[f.from[0]]} and the ${SIDE_NAME[f.what]}`}.`],
      after: f.setup,
      check: (id) => {
        if (id === right) return { ok: true };
        const uses = RATIO[id as Ratio].sides.map((s) => SIDE_NAME[s]).join(' and ');
        return { ok: false, feedback: `${RATIO[id as Ratio].mnemonic} uses the ${uses}. Which pair do you actually have?` };
      },
    });
    out.push({
      id: `value-${f.what}`,
      teach:
        f.what === 'A'
          ? `To turn a ratio back into an angle, use the inverse function, ${right}⁻¹. It answers the question “which angle has this ${RATIO[right].word}?” Make sure the calculator is in **degrees**.`
          : f.solve.includes('×')
            ? 'The unknown is on top of the fraction, so multiply both sides by the bottom. Make sure the calculator is in **degrees**.'
            : 'The unknown is on the bottom of the fraction, so it swaps places: unknown = known ÷ ratio. Make sure the calculator is in **degrees**.',
      why: `$${f.solve}$`,
      answer: f.what === 'A' ? round(f.value, 1) : round(f.value, 2),
      prompt: f.what === 'A' ? `Use the inverse, ${right}⁻¹, to get the angle. What is A, in degrees?` : `Solve for the ${SIDE_NAME[f.what]}. Round to two decimal places.`,
      context: f.setup,
      input: { kind: 'number', label: f.what === 'A' ? 'A' : f.what },
      helper: 'calculator',
      calc: trigCalc(r, f),
      hints: [
        f.what === 'A' ? `Divide first, then press ${right}⁻¹ (in degree mode).` : f.solve.includes('×') ? 'The unknown is on top, so multiply.' : 'The unknown is on the bottom, so divide.',
        f.solve.split(' ≈ ')[0].replace(/[{}]/g, ''),
      ],
      after: f.solve,
      check: (raw) => {
        const v = checkNumber(raw, f.value, { places: 1 });
        if (v === 'wrong' && f.what === 'A' && checkNumber(raw, rad(f.value), { places: 1 }) !== 'wrong') return { ok: false, feedback: 'That’s the angle in radians. Switch the calculator to degrees.' };
        if (v === 'wrong' && f.what !== 'A') {
          const other = f.solve.includes('×') ? r.sides[f.from[0]] / fn[right](rad(r.A)) : r.sides[f.from[0]] * fn[right](rad(r.A));
          if (checkNumber(raw, other, { places: 1 }) !== 'wrong') return { ok: false, feedback: f.solve.includes('×') ? 'That divided. The unknown is on top here, so multiply.' : 'That multiplied. The unknown is on the bottom, so divide.' };
          const radians = f.solve.includes('×') ? r.sides[f.from[0]] * fn[right](r.A) : r.sides[f.from[0]] / fn[right](r.A);
          if (checkNumber(raw, radians, { places: 1 }) !== 'wrong') return { ok: false, feedback: 'Looks like the calculator is in radians. Switch it to degrees.' };
        }
        return numberFeedback(v);
      },
    });
  }
  out.push({
    id: 'B',
    teach: 'The three angles of a triangle add to 180°. One is the 90° right angle, so the other two add to 90°.',
    why: `B = 90° − ${round(r.A, 1)}° = ${round(r.B, 1)}°.`,
    answer: round(r.B, 1),
    optional: true,
    prompt: 'Bonus: what is the other acute angle, B?',
    input: { kind: 'number', label: 'B' },
    helper: 'calculator',
    calc: `90 − ${calcFloat(+r.A.toFixed(1))}`,
    hints: ['The three angles add to 180°, and one of them is 90°.'],
    after: `B = ${r1(r.B)}°`,
    check: (raw) => numberFeedback(checkNumber(raw, r.B, { places: 1 })),
  });
  return out;
}

/** What to type: 10 × sin(35), 7 ÷ tan(35), or tan⁻¹(3 ÷ 4). */
function trigCalc(r: Extract<TrigResult, { kind: 'ok' }>, f: TrigFind): string {
  if (f.ratio === 'pythag') return '';
  const [top, bottom] = RATIO[f.ratio].sides;
  if (f.what === 'A') return `${f.ratio}⁻¹(${calcFloat(r.sides[top])} ÷ ${calcFloat(r.sides[bottom])})`;
  const known = calcFloat(r.sides[f.from[0]]);
  return f.what === top ? `${known} × ${f.ratio}(${calcFloat(r.A)})` : `${known} ÷ ${f.ratio}(${calcFloat(r.A)})`;
}
