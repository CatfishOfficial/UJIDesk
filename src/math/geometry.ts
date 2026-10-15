import { Rational } from './rational';
import { fmtR, type Markup } from './markup';
import { checkNumber, fmtSurd, isRationalSurd, plainR, round, sqrtRational, surdPlain, surdValue, type NumberVerdict, type Surd } from './surd';
import type { Step } from './steps';
import type { LessonDecision, CheckResult } from './lessons';
import { calcNum } from './calcExpr';

/** Shared feedback for answers that may be exact or rounded. */
export function numberFeedback(v: NumberVerdict, exactHint?: string): CheckResult {
  if (v === 'exact') return { ok: true };
  if (v === 'rounded') return { ok: true, feedback: 'Rounded is fine.' };
  if (v === 'roundMore') return { ok: false, feedback: 'Close. Give it to at least one decimal place.' };
  if (v === 'invalid') return { ok: false, feedback: 'Type a number, like 12, 7.07 or 5√2.' };
  return { ok: false, feedback: exactHint ?? 'Not quite. Check the arithmetic.' };
}

// ─── Pythagorean theorem ────────────────────────────────────────────

export type Side = 'a' | 'b' | 'c';

export type PythagResult =
  | {
      kind: 'side';
      missing: Side;
      a: Rational | Surd;
      b: Rational | Surd;
      c: Rational | Surd;
      value: Surd;
      squared: Rational;
      decimal: number;
      steps: Step[];
      answer: Markup;
      answerPlain: string;
    }
  | { kind: 'check'; right: boolean; sides: [Rational, Rational, Rational]; steps: Step[]; answer: Markup; answerPlain: string }
  | { kind: 'error'; message: string; field?: Side };

export function solvePythag(raw: { a: string; b: string; c: string }): PythagResult {
  const vals: Partial<Record<Side, Rational>> = {};
  for (const k of ['a', 'b', 'c'] as Side[]) {
    const t = (raw[k] ?? '').trim();
    if (!t || t === '?' || t === 'x') continue;
    const r = Rational.parse(t);
    if (!r) return { kind: 'error', message: `${k === 'c' ? 'The hypotenuse' : `Leg ${k}`} should be a number, like 5 or 2.5.`, field: k };
    if (r.sign() <= 0) return { kind: 'error', message: 'Side lengths have to be positive.', field: k };
    vals[k] = r;
  }
  const given = (Object.keys(vals) as Side[]).length;
  if (given < 2) return { kind: 'error', message: 'Fill in two sides and leave the one you want blank.', field: !vals.a ? 'a' : !vals.b ? 'b' : 'c' };

  if (given === 3) {
    const s = [vals.a!, vals.b!, vals.c!].sort((x, y) => x.sub(y).sign()) as [Rational, Rational, Rational];
    const lhs = s[0].mul(s[0]).add(s[1].mul(s[1]));
    const rhs = s[2].mul(s[2]);
    const right = lhs.equals(rhs);
    return {
      kind: 'check',
      right,
      sides: s,
      answer: right ? 'Yes, a right triangle' : 'Not a right triangle',
      answerPlain: right ? 'Yes, it is a right triangle.' : 'No, it is not a right triangle.',
      steps: [
        { id: 'longest', title: 'The longest side would have to be the hypotenuse', eq: `c = ${fmtR(s[2])}` },
        { id: 'test', title: 'Test a² + b² = c²', eq: `${fmtR(s[0])}^2 + ${fmtR(s[1])}^2 = ${fmtR(s[0].mul(s[0]))} + ${fmtR(s[1].mul(s[1]))} = ${fmtR(lhs)}` },
        { id: 'compare', title: right ? 'It matches, so it is a right triangle' : "It doesn't match, so it isn't a right triangle", eq: `${fmtR(s[2])}^2 = ${fmtR(rhs)} ${right ? '=' : '≠'} ${fmtR(lhs)}` },
      ],
    };
  }

  const missing = (['a', 'b', 'c'] as Side[]).find((k) => !vals[k])!;
  const steps: Step[] = [{ id: 'formula', title: 'Pythagorean theorem: legs squared add up to the hypotenuse squared', eq: 'a^2 + b^2 = c^2', lesson: 'which' }];
  let squared: Rational;
  if (missing === 'c') {
    const { a, b } = vals as Record<'a' | 'b', Rational>;
    squared = a.mul(a).add(b.mul(b));
    steps.push({ id: 'sub', title: 'Put in the legs', eq: `${fmtR(a)}^2 + ${fmtR(b)}^2 = c^2`, lesson: 'square' });
    steps.push({ id: 'square', title: 'Square and add', eq: `${fmtR(a.mul(a))} + ${fmtR(b.mul(b))} = c^2  →  c^2 = ${fmtR(squared)}`, lesson: 'square' });
  } else {
    const leg = missing === 'a' ? vals.b! : vals.a!;
    const c = vals.c!;
    if (c.sub(leg).sign() <= 0) return { kind: 'error', message: 'The hypotenuse is always the longest side, so c has to be bigger than the leg.', field: 'c' };
    squared = c.mul(c).sub(leg.mul(leg));
    steps.push({ id: 'rearrange', title: `Looking for a leg, so subtract: ${missing}² = c² − ${missing === 'a' ? 'b' : 'a'}²`, eq: `${missing}^2 = c^2 - ${missing === 'a' ? 'b' : 'a'}^2`, lesson: 'which' });
    steps.push({ id: 'sub', title: 'Put in the numbers', eq: `${missing}^2 = ${fmtR(c)}^2 - ${fmtR(leg)}^2 = ${fmtR(c.mul(c))} - ${fmtR(leg.mul(leg))} = ${fmtR(squared)}`, lesson: 'square' });
  }
  const value = sqrtRational(squared);
  const decimal = surdValue(value);
  steps.push({
    id: 'root',
    title: 'Take the square root',
    eq: `${missing} = √{${fmtR(squared)}} = ${fmtSurd(value)}${isRationalSurd(value) ? '' : ` ≈ ${round(decimal, 2).replace('−', '-')}`}`,
    note: !isRationalSurd(value) && value.c.isInteger() && value.c.n > 1n ? `√${plainR(squared)} = √(${value.c.n * value.c.n} × ${value.r}) = ${surdPlain(value)}.` : undefined,
    lesson: 'root',
  });
  const out = { a: vals.a ?? value, b: vals.b ?? value, c: vals.c ?? value };
  const exact = fmtSurd(value);
  return {
    kind: 'side',
    missing,
    ...out,
    value,
    squared,
    decimal,
    steps,
    answer: isRationalSurd(value) ? `${missing} = ${exact}` : `${missing} = ${exact} ≈ ${round(decimal, 2).replace('−', '-')}`,
    answerPlain: isRationalSurd(value) ? `${missing} = ${surdPlain(value)}` : `${missing} = ${surdPlain(value)} ≈ ${round(decimal, 2)}`,
  };
}

export function buildPythagLesson(r: Extract<PythagResult, { kind: 'side' }>): LessonDecision[] {
  const legMissing = r.missing !== 'c';
  return [
    {
      id: 'which',
      teach: 'In a right triangle, the two sides that form the right angle are the **legs** (a and b), and the longest side, across from the right angle, is the **hypotenuse** (c). The theorem says $a^2 + b^2 = c^2$.',
      why: legMissing ? `c is known, so solve for a leg: ${r.missing}² = c² − ${r.missing === 'a' ? 'b' : 'a'}².` : 'Both legs are known, so add their squares to get c².',
      answer: legMissing ? 'leg' : 'hyp',
      prompt: 'First: is the missing side a **leg** or the **hypotenuse** (the long side across from the right angle)?',
      input: {
        kind: 'choice',
        options: [
          { id: 'hyp', label: 'The hypotenuse: add the squares' },
          { id: 'leg', label: 'A leg: subtract the squares' },
        ],
      },
      hints: ['c is always the hypotenuse, across from the square corner.'],
      after: legMissing ? `${r.missing}^2 = c^2 - ${r.missing === 'a' ? 'b' : 'a'}^2` : 'c^2 = a^2 + b^2',
      check: (id) =>
        id === (legMissing ? 'leg' : 'hyp')
          ? { ok: true }
          : { ok: false, feedback: legMissing ? 'c is given, so the missing one is a leg. Legs come from c² minus the other leg².' : 'Both legs are given, so we want c, the hypotenuse.' },
    },
    {
      id: 'square',
      teach: 'Square each known side (multiply it by itself), then add or subtract as the theorem says.',
      why: legMissing ? `${plainR(r.c as Rational)}² − ${plainR((r.missing === 'a' ? r.b : r.a) as Rational)}² = ${plainR((r.c as Rational).mul(r.c as Rational))} − ${plainR(((r.missing === 'a' ? r.b : r.a) as Rational).mul((r.missing === 'a' ? r.b : r.a) as Rational))} = ${plainR(r.squared)}.` : `${plainR(r.a as Rational)}² + ${plainR(r.b as Rational)}² = ${plainR((r.a as Rational).mul(r.a as Rational))} + ${plainR((r.b as Rational).mul(r.b as Rational))} = ${plainR(r.squared)}.`,
      answer: r.squared.toString(),
      prompt: `What does $${r.missing}^2$ come out to?`,
      context: legMissing ? `${r.missing}^2 = ${fmtR(r.c as Rational)}^2 - ${fmtR((r.missing === 'a' ? r.b : r.a) as Rational)}^2` : `c^2 = ${fmtR(r.a as Rational)}^2 + ${fmtR(r.b as Rational)}^2`,
      input: { kind: 'number', label: `${r.missing}²` },
      helper: 'calculator',
      calc: legMissing
        ? `${calcNum(r.c as Rational)}² − ${calcNum((r.missing === 'a' ? r.b : r.a) as Rational)}²`
        : `${calcNum(r.a as Rational)}² + ${calcNum(r.b as Rational)}²`,
      hints: ['Square each number first, then add or subtract.'],
      after: `${r.missing}^2 = ${fmtR(r.squared)}`,
      check: (raw) => {
        const v = checkNumber(raw, r.squared.toNumber());
        if (v === 'exact') return { ok: true };
        const a = r.a as Rational;
        const b = r.b as Rational;
        if (!legMissing && checkNumber(raw, a.add(b).toNumber()) === 'exact') return { ok: false, feedback: 'Square each leg before adding.' };
        return numberFeedback(v === 'rounded' ? 'wrong' : v, 'Square each side, then combine.');
      },
    },
    {
      id: 'root',
      teach: `That’s ${r.missing} squared, so undo the squaring with a square root. If it isn’t a perfect square, simplify the root or round it.`,
      why: `${r.missing} = √${plainR(r.squared)}${isRationalSurd(r.value) ? ` = ${plainR(r.value.c)}` : ` = ${surdPlain(r.value)} ≈ ${round(r.decimal, 2)}`}.`,
      answer: isRationalSurd(r.value) ? fmtR(r.value.c) : round(r.decimal, 2),
      prompt: `Undo the square. What is $${r.missing}$? (An exact root like 5√2 or a decimal both count.)`,
      context: `${r.missing}^2 = ${fmtR(r.squared)}`,
      input: { kind: 'number', label: r.missing },
      helper: 'calculator',
      calc: `√(${calcNum(r.squared)})`,
      hints: [`Take √${plainR(r.squared)}.`],
      after: r.answer,
      check: (raw) => {
        const v = checkNumber(raw, r.decimal, { places: 2 });
        if (checkNumber(raw, r.squared.toNumber()) === 'exact' && !r.squared.equals(Rational.ONE)) return { ok: false, feedback: "That's still squared. Take the square root." };
        return numberFeedback(v);
      },
    },
  ];
}

// ─── Area & perimeter ───────────────────────────────────────────────

export type Shape = 'rectangle' | 'square' | 'triangle' | 'parallelogram' | 'trapezoid' | 'circle';

export const SHAPES: { id: Shape; label: string; fields: { key: string; label: string; optional?: boolean }[] }[] = [
  { id: 'rectangle', label: 'Rectangle', fields: [{ key: 'l', label: 'Length' }, { key: 'w', label: 'Width' }] },
  { id: 'square', label: 'Square', fields: [{ key: 's', label: 'Side' }] },
  {
    id: 'triangle',
    label: 'Triangle',
    fields: [
      { key: 'b', label: 'Base' },
      { key: 'h', label: 'Height' },
      { key: 's1', label: 'Side 2', optional: true },
      { key: 's2', label: 'Side 3', optional: true },
    ],
  },
  { id: 'parallelogram', label: 'Parallelogram', fields: [{ key: 'b', label: 'Base' }, { key: 'h', label: 'Height' }, { key: 's1', label: 'Slanted side', optional: true }] },
  {
    id: 'trapezoid',
    label: 'Trapezoid',
    fields: [
      { key: 'b1', label: 'Base 1' },
      { key: 'b2', label: 'Base 2' },
      { key: 'h', label: 'Height' },
      { key: 's1', label: 'Leg 1', optional: true },
      { key: 's2', label: 'Leg 2', optional: true },
    ],
  },
  { id: 'circle', label: 'Circle', fields: [{ key: 'r', label: 'Radius' }, { key: 'd', label: 'or diameter', optional: true }] },
];

export const UNITS = ['', 'mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'] as const;

/** An exact length or area, possibly a multiple of π. */
export interface Measure {
  c: Rational;
  pi: boolean;
}

export const measureValue = (m: Measure) => m.c.toNumber() * (m.pi ? Math.PI : 1);

export function fmtMeasure(m: Measure, unit = '', power: 1 | 2 = 1): Markup {
  const u = unit ? ` "${unit}${power === 2 ? '²' : ''}"` : '';
  if (!m.pi) return `${fmtR(m.c)}${u}`;
  const coef = m.c.isOne() ? '' : fmtR(m.c);
  return `${coef}π${u} ≈ ${round(measureValue(m), 2).replace('−', '-')}${u}`;
}

export function plainMeasure(m: Measure, unit = '', power: 1 | 2 = 1): string {
  const u = unit ? ` ${unit}${power === 2 ? '²' : ''}` : '';
  if (!m.pi) return `${plainR(m.c)}${u}`;
  return `${m.c.isOne() ? '' : plainR(m.c)}π${u} ≈ ${round(measureValue(m), 2)}${u}`;
}

export type AreaResult =
  | {
      kind: 'ok';
      shape: Shape;
      unit: string;
      dims: Record<string, Rational>;
      area: Measure;
      perimeter: Measure | null;
      /** Why the perimeter is missing, if it is. */
      perimeterNote?: string;
      steps: Step[];
      answer: Markup;
      answerPlain: string;
    }
  | { kind: 'error'; message: string; field?: string };

const HALF = Rational.of(1, 2);
const TWO = Rational.of(2);

export function solveArea(inputs: Record<string, string>): AreaResult {
  const shape = (inputs.shape as Shape) || 'rectangle';
  const def = SHAPES.find((s) => s.id === shape);
  if (!def) return { kind: 'error', message: 'Pick a shape.' };
  const unit = inputs.unit ?? '';
  const dims: Record<string, Rational> = {};
  for (const f of def.fields) {
    const t = (inputs[f.key] ?? '').trim();
    if (!t) continue;
    const r = Rational.parse(t);
    if (!r) return { kind: 'error', message: `${f.label.replace(/^or /, '')} should be a number.`, field: f.key };
    if (r.sign() <= 0) return { kind: 'error', message: 'Lengths have to be positive.', field: f.key };
    dims[f.key] = r;
  }
  if (shape === 'circle') {
    if (!dims.r && dims.d) dims.r = dims.d.mul(HALF);
    if (!dims.r) return { kind: 'error', message: 'Give the radius (or the diameter).', field: 'r' };
  } else {
    const need = def.fields.find((f) => !f.optional && !dims[f.key]);
    if (need) return { kind: 'error', message: `${need.label} is missing.`, field: need.key };
  }

  const steps: Step[] = [];
  const u = unit ? ` "${unit}"` : '';
  const u2 = unit ? ` "${unit}²"` : '';
  const P = (c: Rational): Measure => ({ c, pi: false });
  let area: Measure;
  let perimeter: Measure | null = null;
  let perimeterNote: string | undefined;
  const d = dims;

  switch (shape) {
    case 'rectangle':
      area = P(d.l.mul(d.w));
      perimeter = P(TWO.mul(d.l).add(TWO.mul(d.w)));
      steps.push({ id: 'formula', title: 'Area of a rectangle: length times width', eq: 'A = lw', lesson: 'formula' });
      steps.push({ id: 'area', title: 'Multiply', eq: `A = ${fmtR(d.l)} × ${fmtR(d.w)} = ${fmtR(area.c)}${u2}`, lesson: 'area' });
      steps.push({ id: 'perim', title: 'Perimeter: all the way around', eq: `P = 2l + 2w = 2(${fmtR(d.l)}) + 2(${fmtR(d.w)}) = ${fmtR(perimeter.c)}${u}`, lesson: 'perimeter' });
      break;
    case 'square':
      area = P(d.s.mul(d.s));
      perimeter = P(Rational.of(4).mul(d.s));
      steps.push({ id: 'formula', title: 'Area of a square: side squared', eq: 'A = s^2', lesson: 'formula' });
      steps.push({ id: 'area', title: 'Square the side', eq: `A = ${fmtR(d.s)}^2 = ${fmtR(area.c)}${u2}`, lesson: 'area' });
      steps.push({ id: 'perim', title: 'Perimeter: four equal sides', eq: `P = 4s = 4(${fmtR(d.s)}) = ${fmtR(perimeter.c)}${u}`, lesson: 'perimeter' });
      break;
    case 'triangle':
      area = P(HALF.mul(d.b).mul(d.h));
      steps.push({ id: 'formula', title: 'Area of a triangle: half of base times height', eq: 'A = {1/2}bh', note: 'The height is measured straight up from the base, at a right angle.', lesson: 'formula' });
      steps.push({ id: 'area', title: 'Multiply, then halve', eq: `A = {1/2}(${fmtR(d.b)})(${fmtR(d.h)}) = ${fmtR(area.c)}${u2}`, lesson: 'area' });
      if (d.s1 && d.s2) {
        perimeter = P(d.b.add(d.s1).add(d.s2));
        steps.push({ id: 'perim', title: 'Perimeter: add the three sides', eq: `P = ${fmtR(d.b)} + ${fmtR(d.s1)} + ${fmtR(d.s2)} = ${fmtR(perimeter.c)}${u}`, lesson: 'perimeter' });
      } else perimeterNote = 'Add the other two sides to get the perimeter too.';
      break;
    case 'parallelogram':
      area = P(d.b.mul(d.h));
      steps.push({ id: 'formula', title: 'Area of a parallelogram: base times height', eq: 'A = bh', note: 'Use the straight-up height, not the slanted side.', lesson: 'formula' });
      steps.push({ id: 'area', title: 'Multiply', eq: `A = ${fmtR(d.b)} × ${fmtR(d.h)} = ${fmtR(area.c)}${u2}`, lesson: 'area' });
      if (d.s1) {
        perimeter = P(TWO.mul(d.b).add(TWO.mul(d.s1)));
        steps.push({ id: 'perim', title: 'Perimeter: two bases and two slanted sides', eq: `P = 2(${fmtR(d.b)}) + 2(${fmtR(d.s1)}) = ${fmtR(perimeter.c)}${u}`, lesson: 'perimeter' });
      } else perimeterNote = 'Add the slanted side to get the perimeter too.';
      break;
    case 'trapezoid':
      area = P(HALF.mul(d.b1.add(d.b2)).mul(d.h));
      steps.push({ id: 'formula', title: 'Area of a trapezoid: average the bases, times the height', eq: 'A = {1/2}(b_1 + b_2)h', lesson: 'formula' });
      steps.push({ id: 'area', title: 'Add the bases, multiply by the height, halve', eq: `A = {1/2}(${fmtR(d.b1)} + ${fmtR(d.b2)})(${fmtR(d.h)}) = ${fmtR(area.c)}${u2}`, lesson: 'area' });
      if (d.s1 && d.s2) {
        perimeter = P(d.b1.add(d.b2).add(d.s1).add(d.s2));
        steps.push({ id: 'perim', title: 'Perimeter: add all four sides', eq: `P = ${fmtR(d.b1)} + ${fmtR(d.b2)} + ${fmtR(d.s1)} + ${fmtR(d.s2)} = ${fmtR(perimeter.c)}${u}`, lesson: 'perimeter' });
      } else perimeterNote = 'Add both legs to get the perimeter too.';
      break;
    case 'circle': {
      const r = d.r;
      if (d.d && !inputs.r?.trim()) steps.push({ id: 'radius', title: 'The radius is half the diameter', eq: `r = {${fmtR(d.d)}/2} = ${fmtR(r)}${u}` });
      area = { c: r.mul(r), pi: true };
      perimeter = { c: TWO.mul(r), pi: true };
      steps.push({ id: 'formula', title: 'Area of a circle: π times the radius squared', eq: 'A = πr^2', lesson: 'formula' });
      steps.push({ id: 'area', title: 'Square the radius, keep the π', eq: `A = π(${fmtR(r)})^2 = ${fmtMeasure(area, unit, 2)}`, note: 'Leaving π in the answer keeps it exact.', lesson: 'area' });
      steps.push({ id: 'perim', title: 'Circumference: 2πr (or πd)', eq: `C = 2π(${fmtR(r)}) = ${fmtMeasure(perimeter, unit, 1)}`, lesson: 'perimeter' });
      break;
    }
  }
  const pLabel = shape === 'circle' ? 'C' : 'P';
  const answer = `A = ${fmtMeasure(area!, unit, 2)}${perimeter ? `,  ${pLabel} = ${fmtMeasure(perimeter, unit, 1)}` : ''}`;
  const answerPlain = `Area ${plainMeasure(area!, unit, 2)}${perimeter ? `, ${shape === 'circle' ? 'circumference' : 'perimeter'} ${plainMeasure(perimeter, unit, 1)}` : ''}`;
  return { kind: 'ok', shape, unit, dims, area: area!, perimeter, perimeterNote, steps, answer, answerPlain };
}

/** Why each area formula is what it is, after the student picks it. */
const AREA_WHY: Record<Shape, string> = {
  rectangle: 'A rectangle is rows of unit squares: length of them in each row, width rows. So multiply.',
  square: 'All four sides are equal, so it’s side × side: the side squared.',
  triangle: 'A triangle is exactly half of a parallelogram with the same base and height, hence the ½.',
  parallelogram: 'Slide the slanted end across and it becomes a rectangle with the same base and height.',
  trapezoid: 'Average the two parallel sides, then use that like a rectangle’s width.',
  circle: 'π times the radius squared. (2πr is the distance around, not the area.)',
};

const FORMULAS: Record<Shape, { right: string; wrong: string[] }> = {
  rectangle: { right: 'A = lw', wrong: ['A = l + w', 'A = 2l + 2w'] },
  square: { right: 'A = s^2', wrong: ['A = 4s', 'A = 2s'] },
  triangle: { right: 'A = {1/2}bh', wrong: ['A = bh', 'A = b + h'] },
  parallelogram: { right: 'A = bh', wrong: ['A = {1/2}bh', 'A = b × slanted side'] },
  trapezoid: { right: 'A = {1/2}(b_1 + b_2)h', wrong: ['A = b_1 b_2 h', 'A = (b_1 + b_2)h'] },
  circle: { right: 'A = πr^2', wrong: ['A = 2πr', 'A = πd'] },
};

export function buildAreaLesson(r: Extract<AreaResult, { kind: 'ok' }>): LessonDecision[] {
  const f = FORMULAS[r.shape];
  const opts = [f.right, ...f.wrong].map((m, i) => ({ id: i === 0 ? 'right' : `w${i}`, label: `$${m}$` }));
  const rot = r.shape.length % 3;
  const out: LessonDecision[] = [
    {
      id: 'formula',
      teach: '**Area** is the space inside a shape, measured in unit squares. Each shape has its own formula for counting them quickly.',
      why: AREA_WHY[r.shape],
      answer: 'right',
      prompt: `Which formula gives the **area** of a ${r.shape}?`,
      input: { kind: 'choice', options: [...opts.slice(rot), ...opts.slice(0, rot)] },
      hints: ['Area counts the squares inside; perimeter is the distance around the edge.'],
      after: f.right,
      check: (id) =>
        id === 'right'
          ? { ok: true }
          : { ok: false, feedback: r.shape === 'triangle' ? 'A triangle is half of a rectangle with the same base and height.' : r.shape === 'circle' ? "That's the circumference, the distance around. Area uses r²." : "That one measures something else. Area multiplies two lengths." },
    },
    {
      id: 'area',
      teach: `Put the measurements into the formula and work it out. Area is in square units${r.unit ? ` (${r.unit}²)` : ''}.${r.shape === 'circle' ? ' Square the radius first, then multiply by π.' : ''}`,
      why: `Substitute, then calculate: $${r.steps.find((s) => s.id === 'area')!.eq.split(' = ').slice(0, 2).join(' = ')}$.`,
      answer: r.area.pi ? `${plainR(r.area.c)}π` : plainR(r.area.c),
      prompt: `Now the area${r.unit ? ` in ${r.unit}²` : ''}.${r.area.pi ? ' Leave π in it, or give a decimal.' : ''}`,
      context: r.steps.find((s) => s.id === 'area')?.eq.split(' = ').slice(0, 2).join(' = '),
      input: { kind: 'number', label: 'A' },
      helper: 'calculator',
      calc: areaCalc(r),
      hints: [r.area.pi ? 'Square the radius first, then put π after it.' : 'Multiply the lengths in the formula.'],
      after: `A = ${fmtMeasure(r.area, r.unit, 2)}`,
      check: (raw) => {
        const v = checkNumber(raw, measureValue(r.area), { places: 2 });
        if (r.shape === 'triangle' && checkNumber(raw, r.area.c.toNumber() * 2) === 'exact') return { ok: false, feedback: 'Don’t forget the ½.' };
        if (r.shape === 'circle' && checkNumber(raw, r.dims.r.toNumber() * 2 * Math.PI) === 'exact') return { ok: false, feedback: "That's 2πr, the circumference. Area squares the radius." };
        return numberFeedback(v);
      },
    },
  ];
  if (r.perimeter) {
    const pm = r.perimeter;
    out.push({
      id: 'perimeter',
      teach: r.shape === 'circle' ? 'The distance around a circle is its **circumference**: $C = 2πr$.' : '**Perimeter** is the distance all the way around: add up every side.',
      why: `Substitute, then add: $${r.steps.find((s) => s.id === 'perim')!.eq.split(' = ').slice(0, -1).join(' = ')}$.`,
      answer: pm.pi ? `${plainR(pm.c)}π` : plainR(pm.c),
      optional: true,
      prompt: `Bonus: the ${r.shape === 'circle' ? 'circumference' : 'perimeter'}, the distance all the way around.`,
      input: { kind: 'number', label: r.shape === 'circle' ? 'C' : 'P' },
      helper: 'calculator',
      calc: perimeterCalc(r),
      hints: [r.shape === 'circle' ? 'C = 2πr.' : 'Add up every side.'],
      after: `${r.shape === 'circle' ? 'C' : 'P'} = ${fmtMeasure(pm, r.unit, 1)}`,
      check: (raw) => numberFeedback(checkNumber(raw, measureValue(pm), { places: 2 })),
    });
  }
  return out;
}


/** What to type for the area, shape by shape. */
function areaCalc(r: Extract<AreaResult, { kind: 'ok' }>): string {
  const d = Object.fromEntries(Object.entries(r.dims).map(([k, v]) => [k, calcNum(v)]));
  switch (r.shape) {
    case 'rectangle':
      return `${d.l} × ${d.w}`;
    case 'square':
      return `${d.s}²`;
    case 'triangle':
      return `${d.b} × ${d.h} ÷ 2`;
    case 'parallelogram':
      return `${d.b} × ${d.h}`;
    case 'trapezoid':
      return `(${d.b1} + ${d.b2}) × ${d.h} ÷ 2`;
    case 'circle':
      return `π × ${d.r}²`;
  }
}

function perimeterCalc(r: Extract<AreaResult, { kind: 'ok' }>): string | undefined {
  const d = Object.fromEntries(Object.entries(r.dims).map(([k, v]) => [k, calcNum(v)]));
  switch (r.shape) {
    case 'rectangle':
      return `2 × ${d.l} + 2 × ${d.w}`;
    case 'square':
      return `4 × ${d.s}`;
    case 'triangle':
      return `${d.b} + ${d.s1} + ${d.s2}`;
    case 'parallelogram':
      return `2 × ${d.b} + 2 × ${d.s1}`;
    case 'trapezoid':
      return `${d.b1} + ${d.b2} + ${d.s1} + ${d.s2}`;
    case 'circle':
      return `2 × π × ${d.r}`;
  }
}
