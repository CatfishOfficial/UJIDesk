import type { Rational } from './rational';

/**
 * Lesson steps that use the calculator describe what to type as a plain
 * expression ("(−5)² − 4 × 1 × 6"). The calculator turns it into highlighted
 * keys for whichever model the student has picked.
 */

/** A number as calculator input: 5, (−3), 2.5, or (1 ÷ 3) when it doesn't terminate. */
export function calcNum(r: Rational): string {
  const neg = r.isNegative();
  const a = r.abs();
  let body: string;
  if (a.isInteger()) body = a.n.toString();
  else {
    let d = a.d;
    while (d % 2n === 0n) d /= 2n;
    while (d % 5n === 0n) d /= 5n;
    body = d === 1n ? String(a.toNumber()) : `(${a.n} ÷ ${a.d})`;
  }
  return neg ? `(−${body})` : body;
}

/** A plain number for guides. */
export const calcFloat = (v: number) => (v < 0 ? `(−${Math.abs(v)})` : String(v));
