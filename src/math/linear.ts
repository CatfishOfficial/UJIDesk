import { Rational, normalizeMinus } from './rational';

/** A linear expression ax + by + c with exact coefficients. */
export interface Lin {
  x: Rational;
  y: Rational;
  c: Rational;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const ZERO: Lin = { x: Rational.ZERO, y: Rational.ZERO, c: Rational.ZERO };

const isConst = (l: Lin) => l.x.isZero() && l.y.isZero();
const add = (a: Lin, b: Lin): Lin => ({ x: a.x.add(b.x), y: a.y.add(b.y), c: a.c.add(b.c) });
const scale = (a: Lin, k: Rational): Lin => ({ x: a.x.mul(k), y: a.y.mul(k), c: a.c.mul(k) });
const neg = (a: Lin) => scale(a, Rational.of(-1));

type Tok =
  | { t: 'num'; v: Rational; s: string }
  | { t: 'var'; v: 'x' | 'y' }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' | '(' | ')' | '=' };

class LinError extends Error {}

const VULGAR: Record<string, string> = { '½': '(1/2)', '⅓': '(1/3)', '⅔': '(2/3)', '¼': '(1/4)', '¾': '(3/4)', '⅕': '(1/5)', '⅛': '(1/8)' };

function tokenize(src: string): Tok[] {
  const s = normalizeMinus(src)
    .replace(/[½⅓⅔¼¾⅕⅛]/g, (c) => VULGAR[c])
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
      if (!v || (raw.match(/\./g)?.length ?? 0) > 1) throw new LinError(`"${raw}" isn't a number I can read.`);
      toks.push({ t: 'num', v, s: raw });
      i = j;
      continue;
    }
    if (c === 'x' || c === 'X' || c === 'y' || c === 'Y') {
      toks.push({ t: 'var', v: c.toLowerCase() as 'x' | 'y' });
      i++;
      continue;
    }
    if ('+-*/^()='.includes(c)) {
      toks.push({ t: 'op', v: c as never });
      i++;
      continue;
    }
    if (/[a-z]/i.test(c)) throw new LinError(`Only x and y are supported here. I don't know what "${c}" is.`);
    throw new LinError(`I can't read the "${c}".`);
  }
  return toks;
}

class Parser {
  i = 0;
  constructor(private toks: Tok[]) {}

  peek(): Tok | undefined {
    return this.toks[this.i];
  }
  isOp(v: string): boolean {
    const t = this.peek();
    return !!t && t.t === 'op' && t.v === v;
  }

  expr(): Lin {
    let acc = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.toks[this.i++] as { v: string }).v;
      const rhs = this.term();
      acc = add(acc, op === '+' ? rhs : neg(rhs));
    }
    return acc;
  }

  term(): Lin {
    let acc = this.unary();
    for (;;) {
      const t = this.peek();
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) {
        this.i++;
        const rhs = this.unary();
        acc = t.v === '*' ? mul(acc, rhs) : div(acc, rhs);
      } else if (t && (t.t === 'var' || (t.t === 'op' && t.v === '('))) {
        // implicit multiplication: 3x, 2(x + 1), (1/2)y
        acc = mul(acc, this.power());
      } else if (t && t.t === 'num' && this.i > 0 && this.toks[this.i - 1].t !== 'num') {
        // x2 or (x+1)3 — legal enough to accept as multiplication
        acc = mul(acc, this.power());
      } else return acc;
    }
  }

  unary(): Lin {
    if (this.isOp('-')) {
      this.i++;
      return neg(this.unary());
    }
    if (this.isOp('+')) {
      this.i++;
      return this.unary();
    }
    return this.power();
  }

  power(): Lin {
    const base = this.primary();
    if (!this.isOp('^')) return base;
    this.i++;
    const expTok = this.peek();
    let sign = 1n;
    if (expTok && expTok.t === 'op' && expTok.v === '-') {
      sign = -1n;
      this.i++;
    }
    const e = this.peek();
    if (!e || e.t !== 'num' || !e.v.isInteger()) throw new LinError('Exponents need to be whole numbers.');
    this.i++;
    const k = e.v.n * sign;
    if (!isConst(base)) {
      if (k === 1n) return base;
      throw new LinError("That has a squared (or higher) term, so it isn't a straight line.");
    }
    if (k < 0n && base.c.isZero()) throw new LinError('That divides by zero.');
    let r = Rational.ONE;
    const mag = k < 0n ? -k : k;
    if (mag > 64n) throw new LinError('That exponent is a bit enthusiastic.');
    for (let j = 0n; j < mag; j++) r = r.mul(base.c);
    return { ...ZERO, c: k < 0n ? r.recip() : r };
  }

  primary(): Lin {
    const t = this.peek();
    if (!t) throw new LinError('Looks like something is missing at the end.');
    if (t.t === 'num') {
      this.i++;
      return { ...ZERO, c: t.v };
    }
    if (t.t === 'var') {
      this.i++;
      return t.v === 'x' ? { ...ZERO, x: Rational.ONE } : { ...ZERO, y: Rational.ONE };
    }
    if (t.v === '(') {
      this.i++;
      const inner = this.expr();
      if (!this.isOp(')')) throw new LinError('A parenthesis was opened but never closed.');
      this.i++;
      return inner;
    }
    if (t.v === ')') throw new LinError('There is a closing parenthesis without an opening one.');
    if (t.v === '=') throw new LinError('One side of the equals sign is empty.');
    throw new LinError(`Didn't expect "${t.v}" there.`);
  }
}

function mul(a: Lin, b: Lin): Lin {
  if (isConst(a)) return scale(b, a.c);
  if (isConst(b)) return scale(a, b.c);
  throw new LinError("Multiplying two variable terms makes it non-linear, so it isn't a straight line.");
}

function div(a: Lin, b: Lin): Lin {
  if (!isConst(b)) throw new LinError("Dividing by a variable makes it non-linear, so it isn't a straight line.");
  if (b.c.isZero()) throw new LinError('That divides by zero.');
  return scale(a, b.c.recip());
}

export function parseLinearExpression(src: string): ParseResult<Lin> {
  try {
    const toks = tokenize(src);
    if (toks.length === 0) return { ok: false, error: 'Type an expression first.' };
    const p = new Parser(toks);
    const value = p.expr();
    if (p.i < toks.length) {
      const t = toks[p.i];
      throw new LinError(t.t === 'op' && t.v === '=' ? "That's an equation, not an expression." : 'Something extra is hanging off the end.');
    }
    return { ok: true, value };
  } catch (e) {
    if (e instanceof LinError) return { ok: false, error: e.message };
    throw e;
  }
}

export interface LinearEquation {
  left: Lin;
  right: Lin;
}

export function parseLinearEquation(src: string): ParseResult<LinearEquation> {
  try {
    const toks = tokenize(src);
    if (toks.length === 0) return { ok: false, error: 'Type an equation first, like 3x + 4y = 12.' };
    const eqCount = toks.filter((t) => t.t === 'op' && t.v === '=').length;
    if (eqCount === 0) return { ok: false, error: 'It needs an equals sign, like 3x + 4y = 12.' };
    if (eqCount > 1) return { ok: false, error: 'There is more than one equals sign.' };
    const p = new Parser(toks);
    const left = p.expr();
    if (!p.isOp('=')) throw new LinError('Something odd is right before the equals sign.');
    p.i++;
    const right = p.expr();
    if (p.i < toks.length) throw new LinError('Something extra is hanging off the end.');
    return { ok: true, value: { left, right } };
  } catch (e) {
    if (e instanceof LinError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Collects an equation into Ax + By = C. */
export function toStandard(eq: LinearEquation): { A: Rational; B: Rational; C: Rational } {
  return {
    A: eq.left.x.sub(eq.right.x),
    B: eq.left.y.sub(eq.right.y),
    C: eq.right.c.sub(eq.left.c),
  };
}

/** True when the equation was typed as (something)x + (something)y = constant. */
export function isAlreadyStandard(eq: LinearEquation): boolean {
  return eq.right.x.isZero() && eq.right.y.isZero() && eq.left.c.isZero();
}
