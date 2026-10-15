import { Rational } from './rational';
import { fmtR, fmtSlopeIntercept, fmtTerms, type Markup } from './markup';
import { parseAnswer } from './answers';
import { checkNumber, plainR, round, type NumberVerdict } from './surd';
import { fmtPoly, mulPoly, parsePoly, type Poly } from './poly';
import { solvePointSlope } from './pointSlope';
import { solveSystem } from './systems';
import { readQuadratic, solveQuadratic } from './quadratic';
import { checkFactoredAnswer, solveFactoring } from './factoring';
import { measureValue, solveArea, solvePythag, SHAPES, type Shape } from './geometry';
import { SIDE_NAME, solveTrig, type TrigSide } from './trig';
import { solveStats } from './stats';
import { aSub, solveSequence } from './sequences';

/**
 * Practice topics for the newer tools. Each problem is stored as the same
 * inputs its tool takes (a "spec"), so checking reuses the real solver and
 * a student's own problem works exactly like a generated one.
 */
export type NewTopic = 'pointSlope' | 'systems' | 'quadratic' | 'factoring' | 'pythag' | 'area' | 'trig' | 'stats' | 'sequences';
export type Spec = Record<string, string>;
type Difficulty = 'gentle' | 'regular' | 'spicy';

export interface FieldCheck {
  ok: boolean;
  note?: string;
}

export interface TopicDef {
  label: string;
  generate: (r: () => number, d: Difficulty) => Spec;
  prompt: (s: Spec) => { text: string; math: Markup };
  fields: (s: Spec) => { key: string; label: string }[];
  check: (s: Spec, answers: Record<string, string>) => Partial<Record<string, FieldCheck>>;
  hints: (s: Spec) => string[];
  /** The expected answers, as a student might type them. */
  answers: (s: Spec) => Partial<Record<string, string>>;
}

const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)];
const nonZero = (r: () => number, lo: number, hi: number) => {
  for (;;) {
    const v = int(r, lo, hi);
    if (v !== 0) return v;
  }
};
const R = (n: number | bigint, d: number | bigint = 1) => Rational.of(n, d);
const txt = (s: string) => s.replace(/-/g, '−');

/** Exact-or-rounded numbers: right, close-but-round-more, or wrong. */
function numeric(raw: string, target: number, places = 2, wrongNote?: string): FieldCheck {
  const v: NumberVerdict = checkNumber(raw, target, { places });
  if (v === 'exact' || v === 'rounded') return { ok: true };
  if (v === 'roundMore') return { ok: false, note: `Close. Give ${places} decimal place${places === 1 ? '' : 's'}.` };
  if (v === 'invalid') return { ok: false, note: 'Type a number.' };
  return { ok: false, note: wrongNote };
}

function exactValue(raw: string, want: Rational, extra?: (v: Rational) => string | undefined): FieldCheck {
  const a = parseAnswer(raw);
  if (!a || a.kind !== 'value') return { ok: false, note: 'Type a number or fraction.' };
  if (a.v.equals(want)) return { ok: true };
  return { ok: false, note: extra?.(a.v) ?? (a.v.equals(want.neg()) ? 'Right size, check the sign.' : undefined) };
}

// ─── Point-slope ────────────────────────────────────────────────────

const pointSlope: TopicDef = {
  label: 'Point-slope',
  generate: (r, d) => {
    const x1 = int(r, -6, 6);
    const y1 = int(r, -6, 6);
    const m = d === 'gentle' ? R(nonZero(r, -4, 4)) : R(nonZero(r, -6, 6), pick(r, d === 'spicy' ? [2, 3, 4, 5] : [1, 2, 3]));
    return { x1: String(x1), y1: String(y1), m: m.toString() };
  },
  prompt: (s) => ({ text: 'The line through this point with this slope. Write it as y = mx + b:', math: `(${fmtR(R(+s.x1))}, ${fmtR(R(+s.y1))}),  m = ${fmtR(Rational.parse(s.m)!)}` }),
  fields: () => [
    { key: 'm', label: 'm' },
    { key: 'b', label: 'b' },
  ],
  check: (s, a) => {
    const r = solvePointSlope({ x1: Rational.parse(s.x1)!, y1: Rational.parse(s.y1)!, m: Rational.parse(s.m) });
    if (r.kind !== 'line') return {};
    const x1 = Rational.parse(s.x1)!;
    const y1 = Rational.parse(s.y1)!;
    return {
      m: exactValue(a.m ?? '', r.m),
      b: exactValue(a.b ?? '', r.b, (v) => (v.equals(y1.add(r.m.mul(x1))) ? 'Distributing gives −m·x₁, so subtract it.' : v.equals(y1) ? "That's y₁. Solve for y first." : undefined)),
    };
  },
  hints: (s) => {
    const r = solvePointSlope({ x1: Rational.parse(s.x1)!, y1: Rational.parse(s.y1)!, m: Rational.parse(s.m) });
    if (r.kind !== 'line') return [];
    return ['Start with $y - y_1 = m(x - x_1)$. The slope is already m.', `So $${r.pointSlope}$. Distribute, then move y₁ across: b = y₁ − m·x₁.`, `Answer: $${r.slopeIntercept}$.`];
  },
  answers: (s) => {
    const r = solvePointSlope({ x1: Rational.parse(s.x1)!, y1: Rational.parse(s.y1)!, m: Rational.parse(s.m) });
    return r.kind === 'line' ? { m: r.m.toString(), b: r.b.toString() } : {};
  },
};

// ─── Systems ────────────────────────────────────────────────────────

function eqText(a: number, b: number, c: number): string {
  return txt(`${fmtTerms([{ coef: R(a), v: 'x' }, { coef: R(b), v: 'y' }])} = ${c}`);
}

const systems: TopicDef = {
  label: 'Systems',
  generate: (r, d) => {
    for (;;) {
      const x = int(r, -5, 6);
      const y = int(r, -5, 6);
      if (d === 'gentle') {
        // y = mx + b with x + y or x − y.
        const m = nonZero(r, -3, 3);
        const b = y - m * x;
        const s = pick(r, [1, -1]);
        if (m * s === -1) continue; // that would be the same line or parallel
        return { eq1: txt(fmtSlopeIntercept(R(m), R(b))), eq2: eqText(1, s, x + s * y) };
      }
      const span = d === 'regular' ? 4 : 7;
      const a1 = nonZero(r, -span, span);
      const b1 = nonZero(r, -span, span);
      const a2 = nonZero(r, -span, span);
      const b2 = nonZero(r, -span, span);
      if (a1 * b2 - a2 * b1 === 0) continue;
      if (a1 < 0 && b1 < 0) continue;
      return { eq1: eqText(a1, b1, a1 * x + b1 * y), eq2: eqText(a2, b2, a2 * x + b2 * y) };
    }
  },
  prompt: (s) => ({ text: 'Solve the system:', math: `${s.eq1},  ${s.eq2}` }),
  fields: () => [
    { key: 'x', label: 'x' },
    { key: 'y', label: 'y' },
  ],
  check: (s, a) => {
    const r = solveSystem(s.eq1, s.eq2);
    if (r.kind !== 'one') return {};
    const swapped = (v: Rational, other: Rational) => (v.equals(other) && !v.equals(r.x!.equals(other) ? r.x! : r.y!) ? 'That’s the other variable’s value.' : undefined);
    return { x: exactValue(a.x ?? '', r.x!, (v) => swapped(v, r.y!)), y: exactValue(a.y ?? '', r.y!, (v) => swapped(v, r.x!)) };
  },
  hints: (s) => {
    const r = solveSystem(s.eq1, s.eq2);
    if (r.kind !== 'one') return [];
    const first = r.steps.find((st) => st.id === 'first');
    return [
      r.method === 'substitution' ? 'One equation already says what y is. Substitute it into the other.' : 'Make one variable cancel: multiply so its coefficients match, then add or subtract.',
      first ? `That leaves $${first.eq}$. Put it back into either equation.` : 'Solve for one variable, then the other.',
      `Answer: $x = ${fmtR(r.x!)}$, $y = ${fmtR(r.y!)}$.`,
    ];
  },
  answers: (s) => {
    const r = solveSystem(s.eq1, s.eq2);
    return r.kind === 'one' ? { x: r.x!.toString(), y: r.y!.toString() } : {};
  },
};

// ─── Quadratics ─────────────────────────────────────────────────────

const quadratic: TopicDef = {
  label: 'Quadratics',
  generate: (r, d) => {
    // a(x − p)(x − q) with friendly roots; spicy allows a fraction.
    const p = int(r, -7, 7);
    let q = int(r, -7, 7);
    if (d === 'gentle' && r() < 0.15) q = p;
    const a = d === 'gentle' ? 1 : pick(r, d === 'regular' ? [1, 1, 2, 3] : [2, 3, 4]);
    let poly: Poly = mulPoly([R(-p), R(1)], [R(-q), R(1)]);
    if (d === 'spicy') poly = mulPoly([R(-p), R(1)], [R(-q), R(a)]);
    else poly = poly.map((c) => c.mul(R(a)));
    return { eq: txt(`${fmtPoly(poly)} = 0`).replace(/\{(\d+)\/(\d+)\}/g, '$1/$2') };
  },
  prompt: (s) => ({ text: 'Solve:', math: s.eq.replace(/−/g, '-') }),
  fields: (s) => {
    const r = quad(s);
    return r && r.roots.type === 'rational' && r.roots.r.length === 1
      ? [{ key: 'r1', label: 'x' }]
      : [
          { key: 'r1', label: 'x_1' },
          { key: 'r2', label: 'x_2' },
        ];
  },
  check: (s, a) => {
    const r = quad(s);
    if (!r || r.roots.type !== 'rational') return {};
    const want = r.roots.r;
    if (want.length === 1) return { r1: exactValue(a.r1 ?? '', want[0]) };
    // Either order is fine.
    const g1 = parseAnswer(a.r1 ?? '');
    const g2 = parseAnswer(a.r2 ?? '');
    const v1 = g1?.kind === 'value' ? g1.v : null;
    const v2 = g2?.kind === 'value' ? g2.v : null;
    const ok1 = !!v1 && want.some((w) => w.equals(v1));
    const ok2 = !!v2 && want.some((w) => w.equals(v2)) && !(v1 && v2 && v1.equals(v2));
    const signNote = (v: Rational | null) => (v && want.some((w) => w.equals(v.neg())) ? 'Check the sign: it’s −b in the formula.' : undefined);
    return { r1: { ok: ok1, note: ok1 ? undefined : signNote(v1) }, r2: { ok: ok2, note: ok2 ? undefined : v1 && v2 && v1.equals(v2) ? 'That’s the same one twice. The ± gives a second.' : signNote(v2) } };
  },
  hints: (s) => {
    const r = quad(s);
    if (!r) return [];
    return [
      `Find the discriminant: $b^2 - 4ac = ${r.D}$.`,
      r.roots.type === 'rational' ? `√${r.D} is a whole number, so it factors. Or use $x = {-b ± √{b^2 - 4ac}/2a}$.` : 'Use the quadratic formula.',
      `Answer: $${r.answer}$.`,
    ];
  },
  answers: (s) => {
    const r = quad(s);
    if (!r || r.roots.type !== 'rational') return {};
    return r.roots.r.length === 1 ? { r1: r.roots.r[0].toString() } : { r1: r.roots.r[1].toString(), r2: r.roots.r[0].toString() };
  },
};

function quad(s: Spec) {
  const q = readQuadratic(s.eq);
  if (!q.ok) return null;
  const r = solveQuadratic(q.value);
  return r.kind === 'ok' ? r : null;
}

// ─── Factoring ──────────────────────────────────────────────────────

const factoring: TopicDef = {
  label: 'Factoring',
  generate: (r, d) => {
    for (;;) {
      const p = nonZero(r, -7, 7);
      const q = nonZero(r, -7, 7);
      const m1 = d === 'gentle' ? 1 : pick(r, [1, 2, 3]);
      const m2 = d === 'gentle' ? 1 : pick(r, [1, 1, 2]);
      const k = d === 'spicy' && r() < 0.5 ? pick(r, [2, 3, -1]) : 1;
      const poly = mulPoly([R(p), R(m1)], [R(q), R(m2)]).map((c) => c.mul(R(k)));
      // Skip ones whose binomials share a factor, e.g. (2x + 4).
      if ((m1 > 1 && p % m1 === 0) || (m2 > 1 && q % m2 === 0)) continue;
      return { expr: txt(fmtPoly(poly)) };
    }
  },
  prompt: (s) => ({ text: 'Factor completely:', math: s.expr.replace(/−/g, '-') }),
  fields: () => [{ key: 'f', label: '' }],
  check: (s, a) => {
    const p = parsePoly(s.expr);
    if (!p.ok) return {};
    const v = checkFactoredAnswer(a.f ?? '', p.value.poly);
    if (v === 'right') {
      // Fully factored means no common factor left inside a bracket.
      const r = solveFactoring(s.expr);
      const want = r.kind === 'factored' ? r.content : null;
      const lead = /^\s*(-?\d+)/.exec((a.f ?? '').replace(/−/g, '-'))?.[1];
      if (want && !want.abs().isOne() && (!lead || Math.abs(Number(lead)) !== Math.abs(Number(want.n)))) return { f: { ok: false, note: 'Equal, but a common factor is still hiding in a bracket. Take it out front.' } };
      return { f: { ok: true } };
    }
    return { f: { ok: false, note: v === 'notFactored' ? 'That’s the same expression, just not factored yet.' : v === 'invalid' ? 'Type it with brackets, like (x + 2)(x + 3).' : 'Multiply it back out: it doesn’t match yet.' } };
  },
  hints: (s) => {
    const r = solveFactoring(s.expr);
    if (r.kind !== 'factored') return [];
    const a = r.prim[2];
    const target = a === 1n ? r.prim[0] : a * r.prim[0];
    return [
      !r.content.abs().isOne() ? `First take out the common factor, $${fmtR(r.content)}$.` : 'Look for a common factor first. (There isn’t one.)',
      `Find two numbers that multiply to ${target} and add to ${r.prim[1]}: ${r.pair![0]} and ${r.pair![1]}.`,
      `Answer: $${r.answer}$.`,
    ];
  },
  answers: (s) => {
    const r = solveFactoring(s.expr);
    return r.kind === 'factored' ? { f: r.answerPlain.replace(/−/g, '-') } : {};
  },
};

// ─── Pythagorean ────────────────────────────────────────────────────

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
];

const pythag: TopicDef = {
  label: 'Pythagorean',
  generate: (r, d) => {
    if (d === 'spicy') {
      const a = int(r, 2, 9);
      const b = int(r, 2, 9);
      return { a: String(a), b: String(b), c: '' };
    }
    const [a0, b0, c0] = pick(r, TRIPLES);
    const k = pick(r, d === 'gentle' ? [1, 1, 2] : [1, 2, 3]);
    const [a, b, c] = [a0 * k, b0 * k, c0 * k];
    if (d === 'gentle') return { a: String(a), b: String(b), c: '' };
    return r() < 0.5 ? { a: String(a), b: '', c: String(c) } : { a: '', b: String(b), c: String(c) };
  },
  prompt: (s) => {
    const missing = !s.c ? 'c' : !s.a ? 'a' : 'b';
    return {
      text: missing === 'c' ? 'A right triangle has these legs. Find the hypotenuse:' : 'A right triangle has this leg and hypotenuse. Find the other leg:',
      math: `a = ${s.a || '?'},  b = ${s.b || '?'},  c = ${s.c || '?'}`,
    };
  },
  fields: (s) => [{ key: 'x', label: !s.c ? 'c' : !s.a ? 'a' : 'b' }],
  check: (s, a) => {
    const r = solvePythag({ a: s.a, b: s.b, c: s.c });
    if (r.kind !== 'side') return {};
    const sum = (+s.a || 0) + (+s.b || 0);
    return { x: numeric(a.x ?? '', r.decimal, 2, checkNumber(a.x ?? '', sum) === 'exact' ? 'Square the sides before adding.' : checkNumber(a.x ?? '', r.squared.toNumber()) === 'exact' ? 'That’s still squared. Take the square root.' : undefined) };
  },
  hints: (s) => {
    const r = solvePythag({ a: s.a, b: s.b, c: s.c });
    if (r.kind !== 'side') return [];
    return [r.missing === 'c' ? '$c^2 = a^2 + b^2$.' : `$${r.missing}^2 = c^2 - ${r.missing === 'a' ? 'b' : 'a'}^2$.`, `$${r.missing}^2 = ${fmtR(r.squared)}$. Take the square root.`, `Answer: $${r.answer}$.`];
  },
  answers: (s) => {
    const r = solvePythag({ a: s.a, b: s.b, c: s.c });
    return r.kind === 'side' ? { x: round(r.decimal, 2) } : {};
  },
};

// ─── Area ───────────────────────────────────────────────────────────

const area: TopicDef = {
  label: 'Area',
  generate: (r, d) => {
    const unit = pick(r, ['cm', 'm', 'in', 'ft']);
    const shape: Shape = d === 'gentle' ? pick(r, ['rectangle', 'square', 'triangle']) : d === 'regular' ? pick(r, ['triangle', 'parallelogram', 'trapezoid']) : pick(r, ['circle', 'trapezoid', 'circle']);
    const n = () => String(int(r, 2, d === 'gentle' ? 12 : 15));
    const base: Spec = { shape, unit };
    if (shape === 'rectangle') return { ...base, l: n(), w: n() };
    if (shape === 'square') return { ...base, s: n() };
    if (shape === 'triangle' || shape === 'parallelogram') return { ...base, b: String(2 * int(r, 1, 8)), h: n() };
    if (shape === 'trapezoid') return { ...base, b1: n(), b2: n(), h: String(2 * int(r, 1, 6)) };
    return r() < 0.5 ? { ...base, r: String(int(r, 1, 10)) } : { ...base, d: String(2 * int(r, 1, 10)) };
  },
  prompt: (s) => {
    const def = SHAPES.find((x) => x.id === s.shape)!;
    const SYM: Record<string, string> = { l: 'l', w: 'w', s: 's', b: 'b', h: 'h', b1: 'b_1', b2: 'b_2', r: 'r', d: 'd' };
    const dims = def.fields.filter((f) => s[f.key] && SYM[f.key]).map((f) => `${SYM[f.key]} = ${s[f.key]}`).join(',  ');
    const unit = s.unit ? ` in ${s.unit}²` : '';
    return { text: `Find the area of the ${def.label.toLowerCase()}${unit}${s.shape === 'circle' ? ' (leave π in, or round to 2 places)' : ''}:`, math: dims };
  },
  fields: () => [{ key: 'A', label: 'A' }],
  check: (s, a) => {
    const r = solveArea(s);
    if (r.kind !== 'ok') return {};
    const half = r.area.c.mul(R(2)).toNumber();
    return { A: numeric(a.A ?? '', measureValue(r.area), 2, s.shape === 'triangle' && checkNumber(a.A ?? '', half) === 'exact' ? 'Don’t forget the ½.' : r.perimeter && checkNumber(a.A ?? '', measureValue(r.perimeter)) === 'exact' ? 'That’s the distance around. Area is the space inside.' : undefined) };
  },
  hints: (s) => {
    const r = solveArea(s);
    if (r.kind !== 'ok') return [];
    const f = r.steps.find((x) => x.id === 'formula')!;
    const work = r.steps.find((x) => x.id === 'area')!;
    return [`$${f.eq}$.`, `$${work.eq.split(' = ').slice(0, 2).join(' = ')}$.`, `Answer: $${work.eq.split(' = ').slice(1).join(' = ')}$.`];
  },
  answers: (s) => {
    const r = solveArea(s);
    return r.kind === 'ok' ? { A: r.area.pi ? `${r.area.c}π` : r.area.c.toString() } : {};
  },
};

// ─── Trig ───────────────────────────────────────────────────────────

const trig: TopicDef = {
  label: 'Trig',
  generate: (r, d) => {
    if (d === 'spicy' && r() < 0.6) {
      const [x, y] = pick(r, [
        ['opp', 'adj'],
        ['opp', 'hyp'],
        ['adj', 'hyp'],
      ] as [TrigSide, TrigSide][]);
      const small = int(r, 3, 9);
      const big = y === 'hyp' ? small + int(r, 2, 8) : int(r, 3, 12);
      return { angle: '', [x]: String(small), [y]: String(big), want: 'A' };
    }
    const angle = String(pick(r, d === 'gentle' ? [30, 45, 60, 20, 40, 50] : [25, 35, 42, 53, 58, 67, 72]));
    const known = pick(r, ['opp', 'adj', 'hyp'] as TrigSide[]);
    const want = pick(r, (['opp', 'adj', 'hyp'] as TrigSide[]).filter((x) => x !== known));
    return { angle, [known]: String(int(r, 4, 20)), want };
  },
  prompt: (s) => {
    const parts = [s.angle && `A = ${s.angle}°`, ...(['opp', 'adj', 'hyp'] as TrigSide[]).filter((k) => s[k]).map((k) => `${k} = ${s[k]}`)].filter(Boolean).join(',  ');
    return { text: s.want === 'A' ? 'Find angle A, to one decimal place:' : `Find the ${SIDE_NAME[s.want as TrigSide]} side, to two decimal places:`, math: parts };
  },
  fields: (s) => [{ key: 'x', label: s.want === 'A' ? 'A' : s.want }],
  check: (s, a) => {
    const r = solveTrig(s);
    if (r.kind !== 'ok') return {};
    const target = s.want === 'A' ? r.A : r.sides[s.want as TrigSide];
    const v = numeric(a.x ?? '', target, s.want === 'A' ? 1 : 2);
    if (!v.ok && !v.note && s.want === 'A' && checkNumber(a.x ?? '', (r.A * Math.PI) / 180) !== 'wrong') v.note = 'That’s radians. Switch the calculator to degrees.';
    return { x: v };
  },
  hints: (s) => {
    const r = solveTrig(s);
    if (r.kind !== 'ok') return [];
    const f = r.finds.find((x) => x.what === s.want) ?? r.finds[0];
    return ['SOH CAH TOA: pick the ratio that uses what you know and what you want.', `$${f.setup}$.`, `Answer: $${f.solve}$.`];
  },
  answers: (s) => {
    const r = solveTrig(s);
    if (r.kind !== 'ok') return {};
    return { x: s.want === 'A' ? r.A.toFixed(1) : r.sides[s.want as TrigSide].toFixed(2) };
  },
};

// ─── Statistics ─────────────────────────────────────────────────────

const stats: TopicDef = {
  label: 'Statistics',
  generate: (r, d) => {
    for (;;) {
      const n = d === 'gentle' ? pick(r, [5, 5, 7]) : int(r, 5, 8);
      const xs = Array.from({ length: n }, () => int(r, d === 'spicy' ? -10 : 1, d === 'gentle' ? 12 : 30));
      const sum = xs.reduce((a, b) => a + b, 0);
      if (d === 'gentle' && sum % n !== 0) continue;
      return { list: txt(xs.join(', ')) };
    }
  },
  prompt: (s) => ({ text: 'Find the mean and the median:', math: s.list.replace(/−/g, '-') }),
  fields: () => [
    { key: 'mean', label: 'mean' },
    { key: 'median', label: 'median' },
  ],
  check: (s, a) => {
    const r = solveStats(s.list);
    if (r.kind !== 'ok') return {};
    const mean = numeric(a.mean ?? '', r.mean.toNumber(), 2);
    if (!mean.ok && !mean.note && checkNumber(a.mean ?? '', r.median.toNumber()) === 'exact') mean.note = 'That’s the median. The mean is the sum divided by the count.';
    const median = numeric(a.median ?? '', r.median.toNumber(), 2);
    const mid = r.values[Math.floor(r.n / 2)];
    if (!median.ok && !median.note && checkNumber(a.median ?? '', mid.toNumber()) === 'exact') median.note = 'Sort the numbers first.';
    return { mean, median };
  },
  hints: (s) => {
    const r = solveStats(s.list);
    if (r.kind !== 'ok') return [];
    return [`Sum ${plainR(r.sum)}, count ${r.n}.`, `In order: ${r.sorted.map(plainR).join(', ')}.`, `Mean ${r.mean.isInteger() ? plainR(r.mean) : `≈ ${round(r.mean.toNumber(), 2)}`}, median ${plainR(r.median)}.`];
  },
  answers: (s) => {
    const r = solveStats(s.list);
    return r.kind === 'ok' ? { mean: round(r.mean.toNumber(), 2), median: r.median.toString() } : {};
  },
};

// ─── Sequences ──────────────────────────────────────────────────────

const sequences: TopicDef = {
  label: 'Sequences',
  generate: (r, d) => {
    const geo = d !== 'gentle' && r() < 0.5;
    const a1 = geo ? nonZero(r, -4, 6) : int(r, -10, 20);
    const step = geo ? pick(r, [2, 3, -2, 2]) : nonZero(r, -9, 9);
    const terms = Array.from({ length: 4 }, (_, i) => (geo ? a1 * step ** i : a1 + step * i));
    return { terms: txt(terms.join(', ')), n: d === 'spicy' ? String(geo ? int(r, 6, 9) : int(r, 10, 30)) : '' };
  },
  prompt: (s) => ({ text: s.n ? `Find term ${s.n}:` : 'What comes next?', math: `${s.terms.replace(/−/g, '-')}, …` }),
  fields: (s) => [{ key: 'x', label: s.n ? aSub(s.n) : 'next' }],
  check: (s, a) => {
    const r = solveSequence(s.terms, s.n);
    if (r.kind === 'error') return {};
    const want = s.n ? r.an : r.next;
    return { x: exactValue(a.x ?? '', want, () => (s.n && r.kind === 'arithmetic' && checkNumber(a.x ?? '', r.a1.add(r.step.mul(R(r.n))).toNumber()) === 'exact' ? 'Off by one: term n is n − 1 steps after the first.' : undefined)) };
  },
  hints: (s) => {
    const r = solveSequence(s.terms, s.n);
    if (r.kind === 'error') return [];
    return [
      r.kind === 'arithmetic' ? `It goes up by the same amount: d = ${plainR(r.step)}.` : `It multiplies by the same amount: r = ${plainR(r.step)}.`,
      s.n ? `$${r.formula}$.` : r.kind === 'arithmetic' ? 'Add d to the last term.' : 'Multiply the last term by r.',
      `Answer: ${plainR(s.n ? r.an : r.next)}.`,
    ];
  },
  answers: (s) => {
    const r = solveSequence(s.terms, s.n);
    return r.kind === 'error' ? {} : { x: (s.n ? r.an : r.next).toString() };
  },
};

export const TOPICS: Record<NewTopic, TopicDef> = { pointSlope, systems, quadratic, factoring, pythag, area, trig, stats, sequences };
export const NEW_TOPICS = Object.keys(TOPICS) as NewTopic[];
