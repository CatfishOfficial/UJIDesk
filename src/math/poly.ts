import { Rational, normalizeMinus } from './rational';
import { fmtTerms, type Markup } from './markup';
import type { ParseResult } from './linear';

/**
 * Polynomials in one variable with exact coefficients, for quadratics and
 * factoring. `p[k]` is the coefficient of x^k; trailing zeros are trimmed.
 */
export type Poly = Rational[];

const ZERO = Rational.ZERO;
const MAX_DEGREE = 12;

export function trimPoly(p: Poly): Poly {
  const q = [...p];
  while (q.length > 1 && q[q.length - 1].isZero()) q.pop();
  return q.length ? q : [ZERO];
}

/** Degree, with −1 for the zero polynomial. */
export function degree(p: Poly): number {
  const t = trimPoly(p);
  return t.length === 1 && t[0].isZero() ? -1 : t.length - 1;
}

export const coef = (p: Poly, k: number): Rational => p[k] ?? ZERO;

export function addPoly(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  return trimPoly(Array.from({ length: n }, (_, k) => coef(a, k).add(coef(b, k))));
}

export function scalePoly(a: Poly, k: Rational): Poly {
  return trimPoly(a.map((c) => c.mul(k)));
}

export const subPoly = (a: Poly, b: Poly) => addPoly(a, scalePoly(b, Rational.of(-1)));

export function mulPoly(a: Poly, b: Poly): Poly {
  const out: Rational[] = Array.from({ length: a.length + b.length - 1 }, () => ZERO);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] = out[i + j].add(x.mul(y)))));
  return trimPoly(out);
}

export function evalPoly(p: Poly, x: number): number {
  return p.reduceRight((acc, c) => acc * x + c.toNumber(), 0);
}

export function evalPolyExact(p: Poly, x: Rational): Rational {
  return p.reduceRight((acc, c) => acc.mul(x).add(c), ZERO);
}

export const polyEquals = (a: Poly, b: Poly) => {
  const x = trimPoly(a);
  const y = trimPoly(b);
  return x.length === y.length && x.every((c, i) => c.equals(y[i]));
};

/** 2x^2 - 3x + 1 as markup, highest power first. */
export function fmtPoly(p: Poly, v = 'x'): Markup {
  const terms = [];
  for (let k = p.length - 1; k >= 0; k--) terms.push({ coef: coef(p, k), v: k === 0 ? undefined : k === 1 ? v : `${v}^${k}` });
  return fmtTerms(terms);
}

/** Copy-friendly text with real superscripts: 2x² − 3x + 1. */
export function polyPlain(p: Poly, v = 'x'): string {
  return fmtPoly(p, v)
    .replace(/\{(\d+)\/(\d+)\}/g, '$1/$2')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\^(\d+)/g, '^$1')
    .replace(/-/g, '−');
}

// ─── Parsing ────────────────────────────────────────────────────────

type Tok = { t: 'num'; v: Rational } | { t: 'var'; v: string } | { t: 'op'; v: string };

class PolyError extends Error {}

const VULGAR: Record<string, string> = { '½': '(1/2)', '⅓': '(1/3)', '⅔': '(2/3)', '¼': '(1/4)', '¾': '(3/4)', '⅕': '(1/5)', '⅛': '(1/8)' };
const SUPER: Record<string, string> = { '²': '^2', '³': '^3', '⁴': '^4', '⁵': '^5', '⁶': '^6' };

function tokenize(src: string): Tok[] {
  const s = normalizeMinus(src)
    .replace(/[½⅓⅔¼¾⅕⅛]/g, (c) => VULGAR[c])
    .replace(/[²³⁴⁵⁶]/g, (c) => SUPER[c])
    .replace(/\*\*/g, '^')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[\[{]/g, '(')
    .replace(/[\]}]/g, ')');
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const raw = s.slice(i, j);
      const v = Rational.parse(raw);
      if (!v || (raw.match(/\./g)?.length ?? 0) > 1) throw new PolyError(`"${raw}" isn't a number I can read.`);
      toks.push({ t: 'num', v });
      i = j;
      continue;
    }
    if (/[a-z]/i.test(c)) {
      // Words like "solve" or "factor" aren't variables.
      let j = i;
      while (j < s.length && /[a-z]/i.test(s[j])) j++;
      if (j - i > 1) throw new PolyError(`I don't know "${s.slice(i, j)}". Use one letter for the variable, like x.`);
      toks.push({ t: 'var', v: c.toLowerCase() });
      i++;
      continue;
    }
    if ('+-*/^()='.includes(c)) {
      toks.push({ t: 'op', v: c });
      i++;
      continue;
    }
    throw new PolyError(`I can't read the "${c}".`);
  }
  const vars = new Set(toks.filter((t) => t.t === 'var').map((t) => t.v));
  if (vars.size > 1) throw new PolyError(`This works with one variable at a time, and I see ${[...vars].join(' and ')}.`);
  return toks;
}

class Parser {
  i = 0;
  constructor(private toks: Tok[]) {}
  peek() {
    return this.toks[this.i];
  }
  isOp(v: string) {
    const t = this.peek();
    return !!t && t.t === 'op' && t.v === v;
  }
  expr(): Poly {
    let acc = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.toks[this.i++] as { v: string }).v;
      const rhs = this.term();
      acc = op === '+' ? addPoly(acc, rhs) : subPoly(acc, rhs);
    }
    return acc;
  }
  term(): Poly {
    let acc = this.unary();
    for (;;) {
      const t = this.peek();
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) {
        this.i++;
        const rhs = this.unary();
        if (t.v === '*') acc = this.checked(mulPoly(acc, rhs));
        else {
          if (degree(rhs) > 0) throw new PolyError("Dividing by the variable isn't a polynomial anymore.");
          if (rhs[0].isZero()) throw new PolyError('That divides by zero.');
          acc = scalePoly(acc, rhs[0].recip());
        }
      } else if (t && (t.t === 'var' || (t.t === 'op' && t.v === '('))) {
        acc = this.checked(mulPoly(acc, this.power()));
      } else if (t && t.t === 'num' && this.i > 0 && this.toks[this.i - 1].t !== 'num') {
        acc = this.checked(mulPoly(acc, this.power()));
      } else return acc;
    }
  }
  unary(): Poly {
    if (this.isOp('-')) {
      this.i++;
      return scalePoly(this.unary(), Rational.of(-1));
    }
    if (this.isOp('+')) {
      this.i++;
      return this.unary();
    }
    return this.power();
  }
  power(): Poly {
    const base = this.primary();
    if (!this.isOp('^')) return base;
    this.i++;
    const e = this.primary();
    if (degree(e) > 0 || !e[0].isInteger() || e[0].isNegative()) throw new PolyError('Exponents need to be whole numbers, like x^2.');
    const k = Number(e[0].n);
    if (k > MAX_DEGREE) throw new PolyError('That exponent is a bit enthusiastic.');
    let r: Poly = [Rational.ONE];
    for (let j = 0; j < k; j++) r = this.checked(mulPoly(r, base));
    return r;
  }
  primary(): Poly {
    const t = this.peek();
    if (!t) throw new PolyError('Looks like something is missing at the end.');
    this.i++;
    if (t.t === 'num') return [t.v];
    if (t.t === 'var') return [ZERO, Rational.ONE];
    if (t.v === '(') {
      const inner = this.expr();
      if (!this.isOp(')')) throw new PolyError('A parenthesis was opened but never closed.');
      this.i++;
      return inner;
    }
    if (t.v === ')') throw new PolyError('There is a closing parenthesis without an opening one.');
    if (t.v === '=') throw new PolyError('One side of the equals sign is empty.');
    throw new PolyError(`Didn't expect "${t.v}" there.`);
  }
  checked(p: Poly): Poly {
    if (degree(p) > MAX_DEGREE) throw new PolyError('That degree is higher than this tool goes.');
    return p;
  }
}

export interface ParsedPoly {
  /** For an equation, left − right. */
  poly: Poly;
  variable: string;
  isEquation: boolean;
  left: Poly;
  right: Poly;
}

/** Parses "2x^2 - 3x + 1", "x² = 5x − 6", "(x − 2)(x + 3)" and the like. */
export function parsePoly(src: string): ParseResult<ParsedPoly> {
  try {
    const toks = tokenize(src);
    if (!toks.length) return { ok: false, error: 'Type something first, like x² − 5x + 6.' };
    const variable = (toks.find((t) => t.t === 'var')?.v as string | undefined) ?? 'x';
    const eqs = toks.filter((t) => t.t === 'op' && t.v === '=').length;
    if (eqs > 1) return { ok: false, error: 'There is more than one equals sign.' };
    const p = new Parser(toks);
    const left = p.expr();
    let right: Poly = [ZERO];
    if (eqs === 1) {
      if (!p.isOp('=')) throw new PolyError('Something odd is right before the equals sign.');
      p.i++;
      right = p.expr();
    }
    if (p.i < toks.length) throw new PolyError('Something extra is hanging off the end.');
    return { ok: true, value: { poly: subPoly(left, right), variable, isEquation: eqs === 1, left, right } };
  } catch (e) {
    if (e instanceof PolyError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Smallest positive integer that clears every denominator. */
export function lcmDenominators(p: Poly): bigint {
  let l = 1n;
  for (const c of p) l = (l * c.d) / gcdBig(l, c.d);
  return l;
}

export function gcdBig(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}
