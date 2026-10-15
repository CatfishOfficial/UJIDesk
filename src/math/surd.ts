import { Rational, normalizeMinus } from './rational';
import { fmtR, toPlain, type Markup } from './markup';
import { evaluate, parseExpression } from './expression';

/**
 * Exact square roots: c·√r with r square-free, so √50 shows as 5√2.
 * Plus the forgiving number reading used by lessons and practice, where
 * "5√2", "√50" and "7.07" can all be right answers.
 */
export interface Surd {
  c: Rational;
  /** Square-free radicand; 1 means the value is just c. */
  r: bigint;
}

/** n = k²·r with r square-free (n ≥ 0). */
export function squareFree(n: bigint): { k: bigint; r: bigint } {
  if (n < 0n) throw new RangeError('negative radicand');
  if (n === 0n) return { k: 0n, r: 1n };
  let k = 1n;
  let r = n;
  for (let p = 2n; p * p <= r && p < 100000n; p += p === 2n ? 1n : 2n) {
    const sq = p * p;
    while (r % sq === 0n) {
      r /= sq;
      k *= p;
    }
  }
  return { k, r };
}

/** √q for a non-negative rational, simplified: √(n/d) = √(n·d)/d. */
export function sqrtRational(q: Rational): Surd {
  if (q.isNegative()) throw new RangeError('negative');
  const { k, r } = squareFree(q.n * q.d);
  return { c: Rational.of(k, q.d), r };
}

export const isRationalSurd = (s: Surd) => s.r === 1n;
export const surdValue = (s: Surd) => s.c.toNumber() * Math.sqrt(Number(s.r));

/** 5√2, {3√2/2}, −√7, or a plain rational. */
export function fmtSurd(s: Surd): Markup {
  if (s.r === 1n || s.c.isZero()) return fmtR(s.c);
  const neg = s.c.isNegative();
  const mag = s.c.abs();
  const root = `√{${s.r}}`;
  const top = mag.n === 1n ? root : `${mag.n}${root}`;
  const body = mag.d === 1n ? top : `{${top}/${mag.d}}`;
  return neg ? `-${body}` : body;
}

export const surdPlain = (s: Surd) => toPlain(fmtSurd(s)).replace(/-/g, '−');

// ─── Reading typed numbers ──────────────────────────────────────────

export interface ReadNumber {
  value: number;
  /** Exact when it was typed as an integer, decimal or fraction. */
  exact: Rational | null;
  /** Decimal places typed, when it was a plain decimal like 7.07. */
  decimals: number | null;
}

/** Reads "3", "−2/5", "7.07", "5√2", "√50", "25π", "2.5e3". Null when it isn't a number. */
export function readNumber(raw: string): ReadNumber | null {
  let s = normalizeMinus(raw).trim().toLowerCase();
  s = s.replace(/^[a-z]\s*(_?\d)?\s*=\s*/, '').replace(/,/g, '').replace(/°$/, '').trim();
  if (!s) return null;
  const exact = Rational.parse(s);
  const dec = /^-?\d*\.(\d+)$/.exec(s);
  if (exact) return { value: exact.toNumber(), exact, decimals: dec ? dec[1].length : /^-?\d+$/.test(s) ? 0 : null };
  try {
    const v = evaluate(parseExpression(s.replace(/sqrt/g, '√').replace(/pi/g, 'π')));
    return Number.isFinite(v) ? { value: v, exact: null, decimals: null } : null;
  } catch {
    return null;
  }
}

export type NumberVerdict = 'exact' | 'rounded' | 'roundMore' | 'wrong' | 'invalid';

/**
 * Compares a typed answer with the true value. Exact forms must match exactly;
 * a typed decimal is fine when it's the true value rounded to that many places
 * (at least one place for irrational answers, unless `places` says otherwise).
 */
export function checkNumber(raw: string, target: number, opts: { places?: number } = {}): NumberVerdict {
  const r = readNumber(raw);
  if (!r) return 'invalid';
  const tol = 1e-9 * Math.max(1, Math.abs(target));
  if (Math.abs(r.value - target) <= tol) return 'exact';
  // 9.997 asked to two places is 10.00, and "10" says the same thing.
  if (opts.places != null && Math.abs(r.value - Number(target.toFixed(opts.places))) <= tol) return 'rounded';
  if (r.decimals != null) {
    const half = 0.5 * 10 ** -r.decimals + tol;
    if (Math.abs(r.value - target) <= half) {
      const need = opts.places ?? 1;
      return r.decimals >= Math.min(need, 1) || Number.isInteger(target) ? 'rounded' : 'roundMore';
    }
  }
  return 'wrong';
}

/** Rounds for display: 7.0710678 → "7.07"; trims trailing zeros; true minus sign. */
export function round(v: number, places = 2): string {
  if (!Number.isFinite(v)) return '—';
  const s = v.toFixed(places).replace(/\.?0+$/, '');
  return (s === '-0' ? '0' : s).replace('-', '−');
}

/** Splits "3, 7, 11, 15…" or "4 8 15 16 23 42" into exact numbers. */
export function parseNumberList(raw: string): { ok: true; values: Rational[] } | { ok: false; error: string } {
  const s = normalizeMinus(raw)
    .replace(/(\.\.\.|…)\s*$/, '')
    .replace(/[{}[\]()]/g, ' ')
    .trim();
  if (!s) return { ok: false, error: 'Type some numbers, separated by commas.' };
  const parts = s.split(/[,;\s]+/).filter(Boolean);
  const values: Rational[] = [];
  for (const p of parts) {
    if (p === '...' || p === '…') continue;
    const v = Rational.parse(p);
    if (!v) return { ok: false, error: `"${p}" isn't a number I can read.` };
    values.push(v);
  }
  if (!values.length) return { ok: false, error: 'Type some numbers, separated by commas.' };
  return { ok: true, values };
}

/** A rational as plain text with a true minus sign: −3/4. */
export const plainR = (r: Rational) => r.toString().replace('-', '−');

/** Exact if short, otherwise a rounded decimal: for captions. */
export function niceR(r: Rational, places = 4): string {
  if (r.isInteger() || r.d <= 1000n) return plainR(r);
  return round(r.toNumber(), places);
}
