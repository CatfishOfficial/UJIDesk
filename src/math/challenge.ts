import { Rational } from './rational';
import { fmtR, fmtTerms, type Markup } from './markup';
import { parseAnswer } from './answers';
import { solveSlopeFromPoints } from './slopeFromPoints';
import { solveStandardToSlope } from './standardToSlope';
import { fmtPlain } from './lessons';
import { NEW_TOPICS, TOPICS, type NewTopic, type Spec } from './challengeTopics';

export type ChallengeTopic = 'slope' | 'standard' | NewTopic;
export type ChallengeMix = ChallengeTopic | 'mixed';
export type Difficulty = 'gentle' | 'regular' | 'spicy';

export type ChallengeProblem =
  | { id: string; topic: 'slope'; x1: string; y1: string; x2: string; y2: string }
  | { id: string; topic: 'standard'; equation: string }
  | { id: string; topic: NewTopic; spec: Spec };

export const ALL_TOPICS: ChallengeTopic[] = ['slope', 'standard', ...NEW_TOPICS];
export const TOPIC_LABEL: Record<ChallengeTopic, string> = {
  slope: 'Slope',
  standard: 'Standard form',
  ...(Object.fromEntries(NEW_TOPICS.map((t) => [t, TOPICS[t].label])) as Record<NewTopic, string>),
};
const isNew = (p: ChallengeProblem): p is Extract<ChallengeProblem, { spec: Spec }> => 'spec' in p;

export interface ChallengeField {
  key: string;
  label: string;
}

/** Small seeded PRNG (mulberry32) so a set can be regenerated from its seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

export function generateSet(mix: ChallengeMix, difficulty: Difficulty, count: number, seed: number): ChallengeProblem[] {
  const r = rng(seed);
  const out: ChallengeProblem[] = [];
  // Mixed sets deal topics like cards, so a set of 10 doesn't repeat one topic three times.
  let deck: ChallengeTopic[] = [];
  for (let i = 0; i < count; i++) {
    if (!deck.length) deck = [...ALL_TOPICS].sort(() => r() - 0.5);
    const topic: ChallengeTopic = mix === 'mixed' ? deck.pop()! : mix;
    const id = `${seed}-${i}`;
    if (topic === 'slope') out.push(genSlope(r, difficulty, id));
    else if (topic === 'standard') out.push(genStandard(r, difficulty, id));
    else out.push({ id, topic, spec: TOPICS[topic].generate(r, difficulty) });
  }
  return out;
}

export function genSlope(r: () => number, d: Difficulty, id: string): ChallengeProblem {
  const span = d === 'gentle' ? 6 : d === 'regular' ? 9 : 12;
  for (;;) {
    const x1 = int(r, -span, span);
    const y1 = int(r, -span, span);
    let x2 = int(r, -span, span);
    let y2 = int(r, -span, span);
    // Rare special cases keep things honest: one horizontal, one vertical now and then.
    const roll = r();
    if (d !== 'gentle' && roll < 0.08) x2 = x1;
    else if (roll < 0.14) y2 = y1;
    if (x1 === x2 && y1 === y2) continue;
    if (d === 'gentle' && x1 !== x2 && (y2 - y1) % (x2 - x1) !== 0) continue;
    if (d === 'gentle' && (x1 < 0 || x2 < 0) && r() < 0.6) continue;
    return { id, topic: 'slope', x1: `${x1}`, y1: `${y1}`, x2: `${x2}`, y2: `${y2}` };
  }
}

export function genStandard(r: () => number, d: Difficulty, id: string): ChallengeProblem {
  for (;;) {
    const q = d === 'gentle' ? int(r, 1, 3) : int(r, 1, d === 'regular' ? 5 : 7);
    const pNum = int(r, d === 'gentle' ? -4 : -7, d === 'gentle' ? 4 : 7);
    const bInt = int(r, -6, 6);
    // y = (p/q)x + b  →  -p x + q y = q b
    let A = -pNum;
    let B = q;
    let C = q * bInt;
    if (d === 'spicy' && r() < 0.5) {
      const k = int(r, 2, 3);
      A *= k; B *= k; C *= k;
    }
    if (A < 0 || (A === 0 && r() < 0.5)) { A = -A; B = -B; C = -C; }
    if (A === 0 && B === 0) continue;
    const eq = `${fmtTerms([{ coef: Rational.of(A), v: 'x' }, { coef: Rational.of(B), v: 'y' }])} = ${C}`.replace(/-/g, '−');
    if (d === 'gentle' && B < 0) continue;
    return { id, topic: 'standard', equation: eq };
  }
}

export function problemPrompt(p: ChallengeProblem): { text: string; math: Markup } {
  if (isNew(p)) return TOPICS[p.topic].prompt(p.spec);
  if (p.topic === 'slope') {
    return {
      text: 'Find the slope of the line through',
      math: `(${fmtR(Rational.parse(p.x1)!)}, ${fmtR(Rational.parse(p.y1)!)}) and (${fmtR(Rational.parse(p.x2)!)}, ${fmtR(Rational.parse(p.y2)!)})`,
    };
  }
  return { text: 'Write in slope-intercept form, y = mx + b:', math: p.equation.replace(/−/g, '-') };
}

export function challengeFields(p: ChallengeProblem): ChallengeField[] {
  if (isNew(p)) return TOPICS[p.topic].fields(p.spec);
  if (p.topic === 'slope') return [{ key: 'm', label: 'm' }];
  const res = solveStandardToSlope(p.equation);
  if (res.kind === 'vertical') return [{ key: 'x', label: 'x' }];
  return [
    { key: 'm', label: 'm' },
    { key: 'b', label: 'b' },
  ];
}

export interface ChallengeCheck {
  correct: boolean;
  fields: Record<string, { ok: boolean; note?: string }>;
}

export function checkChallenge(p: ChallengeProblem, answers: Record<string, string>): ChallengeCheck {
  if (isNew(p)) {
    const raw = TOPICS[p.topic].check(p.spec, answers);
    const fields: ChallengeCheck['fields'] = {};
    for (const [k, v] of Object.entries(raw)) if (v) fields[k] = v;
    const keys = challengeFields(p).map((f) => f.key);
    return { correct: keys.length > 0 && keys.every((k) => fields[k]?.ok), fields };
  }
  if (p.topic === 'slope') {
    const res = solveSlopeFromPoints({
      x1: Rational.parse(p.x1)!, y1: Rational.parse(p.y1)!, x2: Rational.parse(p.x2)!, y2: Rational.parse(p.y2)!,
    });
    const a = parseAnswer(answers.m ?? '');
    if (res.kind === 'vertical') {
      const ok = !!a && a.kind === 'undefined';
      return {
        correct: ok,
        fields: { m: { ok, note: ok ? undefined : a && a.kind === 'value' && a.v.isZero() ? 'Zero slope is a flat line. Look at the x-values.' : 'Look closely at the x-values.' } },
      };
    }
    if (res.kind !== 'slope') return { correct: false, fields: {} };
    if (!a) return { correct: false, fields: { m: { ok: false, note: 'Type a number, fraction, or "undefined".' } } };
    if (a.kind === 'undefined') return { correct: false, fields: { m: { ok: false, note: 'The x-values differ, so the slope exists.' } } };
    if (a.v.equals(res.m)) return { correct: true, fields: { m: { ok: true } } };
    let note = 'Not yet. Rise over run, and keep the order consistent.';
    if (!res.m.isZero() && a.v.equals(res.m.recip())) note = "That's run over rise. Flip it.";
    else if (!res.m.isZero() && a.v.equals(res.m.neg())) note = 'Right size, check the sign.';
    return { correct: false, fields: { m: { ok: false, note } } };
  }

  const res = solveStandardToSlope(p.equation);
  if (res.kind === 'vertical') {
    const a = parseAnswer(answers.x ?? '');
    const ok = !!a && a.kind === 'value' && a.v.equals(res.xValue);
    return { correct: ok, fields: { x: { ok } } };
  }
  if (res.kind !== 'slope') return { correct: false, fields: {} };
  const am = parseAnswer(answers.m ?? '');
  const ab = parseAnswer(answers.b ?? '');
  const mOk = !!am && am.kind === 'value' && am.v.equals(res.m);
  const bOk = !!ab && ab.kind === 'value' && ab.v.equals(res.b);
  const fields: ChallengeCheck['fields'] = { m: { ok: mOk }, b: { ok: bOk } };
  if (!mOk && am && am.kind === 'value') {
    if (!res.m.isZero() && am.v.equals(res.m.neg())) fields.m.note = 'Sign flip: moving the x-term across the equals sign changes its sign.';
    else if (!res.m.isZero() && am.v.equals(res.m.recip().neg())) fields.m.note = "Upside down: y's coefficient goes on the bottom.";
    else if (am.v.equals(res.A)) fields.m.note = "That's A. Remember to divide by B.";
  }
  if (!bOk && ab && ab.kind === 'value') {
    if (ab.v.equals(res.C) && !res.B.isOne()) fields.b.note = `Divide C by ${fmtPlain(res.B)} too.`;
    else if (!res.b.isZero() && ab.v.equals(res.b.neg())) fields.b.note = 'Check the sign.';
  }
  return { correct: mOk && bOk, fields };
}

/** Progressive hints. The last one always gives the answer: nobody gets stuck. */
export function challengeHints(p: ChallengeProblem): string[] {
  if (isNew(p)) return TOPICS[p.topic].hints(p.spec);
  if (p.topic === 'slope') {
    const res = solveSlopeFromPoints({
      x1: Rational.parse(p.x1)!, y1: Rational.parse(p.y1)!, x2: Rational.parse(p.x2)!, y2: Rational.parse(p.y2)!,
    });
    if (res.kind === 'error') return [];
    return [
      'Slope is rise over run: $m = {y_2 - y_1/x_2 - x_1}$.',
      `rise = $${fmtR(res.rise)}$, run = $${fmtR(res.run)}$.`,
      res.kind === 'vertical' ? 'The run is 0, so the slope is **undefined** (a vertical line).' : `So $${res.answer}$.`,
    ];
  }
  const res = solveStandardToSlope(p.equation);
  if (res.kind === 'error') return [];
  if (res.kind === 'vertical') return ['There is no y-term, so this is a vertical line.', `Divide: $${res.answer}$.`];
  return [
    'Move the x-term to the right side, then divide everything by the number on y.',
    res.B.isOne()
      ? `There's no number on y, so only the x-term moves. Its sign flips: $m = ${fmtR(res.m)}$.`
      : `Divide every term by $${fmtR(res.B)}$, so $m = {${fmtR(res.A.neg())}/${fmtR(res.B)}}$${`{${fmtR(res.A.neg())}/${fmtR(res.B)}}` !== fmtR(res.m) ? ` $= ${fmtR(res.m)}$` : ''}.`,
    `Answer: $${res.answer}$.`,
  ];
}

export function pointsFor(hintsUsed: number, attempts: number): number {
  if (hintsUsed === 0 && attempts <= 1) return 10;
  if (hintsUsed <= 1) return 6;
  if (hintsUsed === 2) return 3;
  return 1;
}
