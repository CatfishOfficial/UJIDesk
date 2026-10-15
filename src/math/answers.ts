import { Rational, gcd, normalizeMinus } from './rational';

export type Answer = { kind: 'value'; v: Rational; unreduced: boolean } | { kind: 'undefined' } | null;

const UNDEFINED_WORDS = /^(undefined|undef|und|none|no slope|dne|infinite|infinity|∞|vertical)$/i;

/** Reads a student's typed answer: integers, decimals, fractions, "m = 3", or "undefined". */
export function parseAnswer(raw: string): Answer {
  let s = normalizeMinus(raw).trim().toLowerCase();
  s = s.replace(/^[a-z]\s*=\s*/, '');
  if (!s) return null;
  if (UNDEFINED_WORDS.test(s)) return { kind: 'undefined' };
  const v = Rational.parse(s);
  if (!v) return null;
  let unreduced = false;
  const frac = /^-?\s*(\d+)\s*\/\s*-?\s*(\d+)$/.exec(s);
  if (frac) {
    const n = BigInt(frac[1]);
    const d = BigInt(frac[2]);
    unreduced = d === 1n || gcd(n, d) !== 1n || (s.match(/-/g)?.length ?? 0) === 2 || /\/\s*-/.test(s);
  }
  return { kind: 'value', v, unreduced };
}

export function sameValue(a: Answer, r: Rational): boolean {
  return !!a && a.kind === 'value' && a.v.equals(r);
}
