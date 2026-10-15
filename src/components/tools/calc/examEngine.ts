import { evaluate, parseExpression } from '../../../math/expression';
import { parseLinearExpression } from '../../../math/linear';
import { fmtR, type Markup } from '../../../math/markup';
import type { Rational } from '../../../math/rational';

/**
 * A two-line scientific calculator like the ones allowed on standardized
 * tests: the entry on top, the answer underneath. A fraction key (n/d)
 * builds stacked fractions, answers stay as fractions until you toggle to
 * a decimal, and the negative key is its own key.
 */
export interface EState {
  entry: string[];
  /** The last evaluated entry and its answer, shown until you type again. */
  shown: { in: string[]; v: number; exact: string | null } | null;
  ans: number;
  ansExact: string | null;
  lastEntry: string[];
  second: boolean;
  angle: 'deg' | 'rad';
  /** f◄►d: show the answer as a decimal instead of a fraction. */
  asDec: boolean;
  err: string | null;
}

export const initialE = (): EState => ({ entry: [], shown: null, ans: 0, ansExact: null, lastEntry: [], second: false, angle: 'deg', asDec: false, err: null });

const TYPE: Record<string, string> = {
  add: '+',
  sub: '-',
  mul: '×',
  div: '÷',
  pow: '^',
  sq: '²',
  recip: '⁻¹',
  lparen: '(',
  rparen: ')',
  neg: '⁻',
  pi: 'π',
  sin: 'sin(',
  cos: 'cos(',
  tan: 'tan(',
  log: 'log(',
  ln: 'ln(',
  frac: '⁄',
  ans: 'Ans',
  '.': '.',
};
for (let d = 0; d <= 9; d++) TYPE[String(d)] = String(d);
const SECOND: Record<string, string> = { sq: '√(', sin: 'sin⁻¹(', cos: 'cos⁻¹(', tan: 'tan⁻¹(', log: '10^(', ln: 'e^(', pi: 'e', neg: 'Ans' };

const BIN = new Set(['+', '-', '×', '÷', '^', '⁄']);
const OPENS = new Set(['(', 'sin(', 'cos(', 'tan(', 'sin⁻¹(', 'cos⁻¹(', 'tan⁻¹(', 'log(', 'ln(', '10^(', 'e^(', '√(']);

class EError extends Error {}

function toExpr(tokens: string[], ans: number): string {
  let out = '';
  tokens.forEach((t, i) => {
    const prev = tokens[i - 1];
    if (t === '-' && (i === 0 || BIN.has(prev) || OPENS.has(prev) || prev === '⁻')) throw new EError('SYNTAX');
    if (BIN.has(t) && t !== '-' && (i === 0 || BIN.has(prev) || OPENS.has(prev))) throw new EError('SYNTAX');
    const map: Record<string, string> = {
      '×': '*',
      '÷': '/',
      '⁄': '⁄',
      '²': '^2',
      '⁻¹': '^(-1)',
      '⁻': '-',
      π: 'pi',
      'sin⁻¹(': 'asin(',
      'cos⁻¹(': 'acos(',
      'tan⁻¹(': 'atan(',
      '√(': 'sqrt(',
      Ans: `(${ans})`,
    };
    out += map[t] ?? t;
  });
  // n/d binds tightly: 6 ÷ 1⁄2 is 6 ÷ (1/2).
  return out.replace(/(\d*\.?\d+)⁄(\d*\.?\d+)/g, '($1/$2)').replace(/⁄/g, '/');
}

/** Exact value for answers that are rational, as fraction markup. */
function exactOf(expr: string): Rational | null {
  if (/[a-z]/i.test(expr)) return null;
  const lin = parseLinearExpression(expr);
  return lin.ok && lin.value.x.isZero() && lin.value.y.isZero() ? lin.value.c : null;
}

export function pressE(prev: EState, key: string): EState {
  const s: EState = { ...prev };
  if (s.err) {
    if (['clear', 'enter', 'del'].includes(key) || TYPE[key]) return { ...s, err: null, entry: key === 'del' ? s.entry : [] };
    return s;
  }
  if (key === '2nd') return { ...s, second: !s.second };
  const second = s.second;
  s.second = false;
  if (key === 'mode') return { ...s, angle: s.angle === 'deg' ? 'rad' : 'deg' };
  if (key === 'fd') return s.shown?.exact ? { ...s, asDec: !s.asDec } : s;
  if (key === 'clear') return s.entry.length ? { ...s, entry: [] } : { ...s, shown: null };
  if (key === 'del') return { ...s, entry: s.entry.slice(0, -1) };
  if (key === 'enter' && second) return { ...s, entry: [...s.lastEntry], shown: null };
  if (key === 'enter') {
    const tokens = s.entry.length ? s.entry : s.lastEntry;
    if (!tokens.length) return s;
    try {
      const expr = toExpr(tokens, s.ans);
      let v: number;
      try {
        v = evaluate(parseExpression(expr), 0, s.angle);
      } catch {
        throw new EError('SYNTAX');
      }
      if (Number.isNaN(v)) throw new EError('DOMAIN');
      if (!Number.isFinite(v)) throw new EError(/\//.test(expr) ? 'DIVIDE BY 0' : 'OVERFLOW');
      const ex = exactOf(expr.replace(/\(([-\d.]+)\)/g, '$1'));
      const exact = ex && !ex.isInteger() && ex.d <= 100000n ? fmtR(ex) : null;
      return { ...s, entry: [], shown: { in: tokens, v, exact }, ans: v, ansExact: exact, lastEntry: tokens, asDec: false };
    } catch (e) {
      if (e instanceof EError) return { ...s, err: e.message, lastEntry: tokens };
      throw e;
    }
  }
  const t = second ? (SECOND[key] ?? TYPE[key]) : TYPE[key];
  if (t == null) return s;
  // After an answer, an operator keeps going from it.
  if (!s.entry.length && ['+', '-', '×', '÷', '^', '²', '⁻¹'].includes(t)) return { ...s, entry: ['Ans', t], shown: null };
  return { ...s, entry: [...s.entry, t], shown: s.entry.length ? s.shown : null };
}

/** The entry line as math markup, with n/d drawn as a stacked fraction. */
export function entryMarkup(tokens: string[]): Markup {
  const text = tokens.join('').replace(/-/g, '−');
  return text.replace(/(\d*\.?\d+)⁄(\d*\.?\d*)/g, (_, a: string, b: string) => `{${a}/${b || '□'}}`).replace(/⁄/g, '/');
}

export function answerText(s: EState): { markup: Markup | null; plain: string } {
  if (!s.shown) return { markup: null, plain: '' };
  if (s.shown.exact && !s.asDec) return { markup: s.shown.exact, plain: s.shown.exact };
  const v = s.shown.v;
  const a = Math.abs(v);
  let str = a !== 0 && (a >= 1e10 || a < 1e-4) ? a.toExponential(7).replace(/\.?0+e/, 'e').replace('e+', '×10^').replace('e-', '×10^-') : String(Number(a.toPrecision(10)));
  str = (v < 0 ? '−' : '') + str;
  return { markup: null, plain: str };
}
