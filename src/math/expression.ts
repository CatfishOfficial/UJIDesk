import { normalizeMinus } from './rational';
import { parseLinearEquation, toStandard } from './linear';

/**
 * Safe floating-point expression evaluation for the calculator and graph.
 * Parses to an AST once, then evaluates many times (graphs sample hundreds of x values).
 * No eval, no Function constructor.
 */
export type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; name: 'x' }
  | { t: 'const'; name: 'pi' | 'e' }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { t: 'pct'; a: Node }
  | { t: 'fact'; a: Node }
  | { t: 'fn'; name: FnName; a: Node };

type FnName = 'sqrt' | 'cbrt' | 'abs' | 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan' | 'ln' | 'log' | 'floor' | 'ipart' | 'fpart';
const TRIG = new Set<FnName>(['sin', 'cos', 'tan']);
const INVERSE = new Set<FnName>(['asin', 'acos', 'atan']);
const FNS: Record<FnName, (v: number) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  floor: Math.floor,
  ipart: Math.trunc,
  fpart: (v) => v - Math.trunc(v),
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  ln: Math.log,
  log: Math.log10,
};

export type AngleMode = 'rad' | 'deg';

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

type Tok = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string };

export class ExprError extends Error {}

function tokenize(src: string): Tok[] {
  const s = normalizeMinus(src).replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/√/g, 'sqrt');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      if (s[j] === 'e' && /[0-9+-]/.test(s[j + 1] ?? '') && !/[a-z]/i.test(s[j + 2] ?? '')) {
        // scientific notation such as 1.2e-5
        j++;
        if (s[j] === '+' || s[j] === '-') j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      const raw = s.slice(i, j);
      const v = Number(raw);
      if (!Number.isFinite(v)) throw new ExprError(`"${raw}" isn't a number.`);
      out.push({ k: 'num', v });
      i = j;
      continue;
    }
    if (/[a-z]/i.test(c)) {
      let j = i;
      while (j < s.length && /[a-z]/i.test(s[j])) j++;
      out.push(...splitIdent(s.slice(i, j).toLowerCase()));
      i = j;
      continue;
    }
    if ('+-*/^()%!'.includes(c)) { out.push({ k: 'op', v: c }); i++; continue; }
    throw new ExprError(`I can't read "${c}".`);
  }
  return out;
}

/** Splits glued identifiers like "2pix" or "xsin" into known names. */
function splitIdent(word: string): Tok[] {
  const names = ['sqrt', 'cbrt', 'floor', 'ipart', 'fpart', 'asin', 'acos', 'atan', 'abs', 'sin', 'cos', 'tan', 'ln', 'log', 'pi', 'e', 'x'];
  const out: Tok[] = [];
  let i = 0;
  outer: while (i < word.length) {
    for (const n of names) {
      if (word.startsWith(n, i)) {
        out.push({ k: 'id', v: n });
        i += n.length;
        continue outer;
      }
    }
    throw new ExprError(`I don't know "${word}".`);
  }
  return out;
}

class Parser {
  i = 0;
  constructor(private toks: Tok[], private allowX: boolean) {}
  peek() { return this.toks[this.i]; }
  isOp(v: string) { const t = this.peek(); return !!t && t.k === 'op' && t.v === v; }

  parse(): Node {
    const n = this.expr();
    if (this.i < this.toks.length) throw new ExprError('Something extra is at the end.');
    return n;
  }
  expr(): Node {
    let a = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.toks[this.i++] as { v: '+' | '-' }).v;
      a = { t: 'bin', op, a, b: this.term() };
    }
    return a;
  }
  term(): Node {
    let a = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.toks[this.i++] as { v: '*' | '/' }).v;
        a = { t: 'bin', op, a, b: this.unary() };
        continue;
      }
      const t = this.peek();
      if (t && (t.k === 'id' || t.k === 'num' || (t.k === 'op' && t.v === '('))) {
        a = { t: 'bin', op: '*', a, b: this.power() };
        continue;
      }
      return a;
    }
  }
  unary(): Node {
    if (this.isOp('-')) { this.i++; return { t: 'neg', a: this.unary() }; }
    if (this.isOp('+')) { this.i++; return this.unary(); }
    return this.power();
  }
  power(): Node {
    let base = this.postfix();
    if (this.isOp('^')) {
      this.i++;
      base = { t: 'bin', op: '^', a: base, b: this.unary() };
    }
    return base;
  }
  postfix(): Node {
    let n = this.primary();
    for (;;) {
      if (this.isOp('%')) { this.i++; n = { t: 'pct', a: n }; continue; }
      if (this.isOp('!')) { this.i++; n = { t: 'fact', a: n }; continue; }
      break;
    }
    return n;
  }
  primary(): Node {
    const t = this.peek();
    if (!t) throw new ExprError('Something is missing at the end.');
    this.i++;
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'id') {
      if (t.v === 'x') {
        if (!this.allowX) throw new ExprError('x only works on the graph.');
        return { t: 'var', name: 'x' };
      }
      if (t.v === 'pi' || t.v === 'e') return { t: 'const', name: t.v };
      const arg = this.isOp('(') ? this.primary() : this.power();
      return { t: 'fn', name: t.v as FnName, a: arg };
    }
    if (t.v === '(') {
      const inner = this.expr();
      if (!this.isOp(')')) throw new ExprError('A parenthesis is never closed.');
      this.i++;
      return inner;
    }
    throw new ExprError(`Didn't expect "${t.v}" there.`);
  }
}

export function parseExpression(src: string, { allowX = false } = {}): Node {
  const toks = tokenize(src);
  if (!toks.length) throw new ExprError('Empty expression.');
  // Friendly: auto-close trailing parentheses, like most calculators do.
  let depth = 0;
  for (const t of toks) if (t.k === 'op') depth += t.v === '(' ? 1 : t.v === ')' ? -1 : 0;
  for (; depth > 0; depth--) toks.push({ k: 'op', v: ')' });
  return new Parser(toks, allowX).parse();
}

export function evaluate(n: Node, x = 0, angle: AngleMode = 'rad'): number {
  const ev = (m: Node) => evaluate(m, x, angle);
  switch (n.t) {
    case 'num': return n.v;
    case 'var': return x;
    case 'const': return n.name === 'pi' ? Math.PI : Math.E;
    case 'neg': return -ev(n.a);
    case 'pct': return ev(n.a) / 100;
    case 'fact': return factorial(ev(n.a));
    case 'fn': {
      let v = ev(n.a);
      if (TRIG.has(n.name) && angle === 'deg') v = (v * Math.PI) / 180;
      let r = FNS[n.name](v);
      if (INVERSE.has(n.name) && angle === 'deg') r = (r * 180) / Math.PI;
      // sin(180°) should be 0, not 1.2e-16
      if (TRIG.has(n.name) && Math.abs(r) < 1e-12) r = 0;
      if (n.name === 'tan' && Math.abs(r) > 1e15) r = NaN;
      return r;
    }
    case 'bin': {
      const a = ev(n.a);
      const b = ev(n.b);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '^': return Math.pow(a, b);
      }
    }
  }
}

/** Formats calculator output: trims float noise, uses exponent form for extremes. */
export function formatNumber(v: number): string {
  if (Number.isNaN(v)) return 'Not a number';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  if (Object.is(v, -0)) v = 0;
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) {
    return v.toExponential(8).replace(/\.?0+e/, 'e').replace('-', '−');
  }
  const s = Number(v.toPrecision(12)).toString();
  return s.replace('-', '−');
}

export interface GraphFunction {
  kind: 'function';
  node: Node;
}
export interface GraphVertical {
  kind: 'vertical';
  x: number;
}

/**
 * Accepts "y = 2x + 1", "2x + 1", "f(x) = x^2", or "x = 3" (vertical line).
 */
export function parseGraphable(src: string): GraphFunction | GraphVertical {
  let s = normalizeMinus(src).trim();
  if (!s) throw new ExprError('Type something to graph, like y = 2x + 1.');
  s = s.replace(/^f\s*\(\s*x\s*\)\s*=/i, 'y =');
  const vert = /^x\s*=\s*(.+)$/i.exec(s);
  if (vert) {
    const v = evaluate(parseExpression(vert[1]));
    if (!Number.isFinite(v)) throw new ExprError('That x value is not finite.');
    return { kind: 'vertical', x: v };
  }
  const yEq = /^y\s*=\s*(.+)$/i.exec(s);
  if (yEq) s = yEq[1];
  else if (s.includes('=')) {
    // Any other linear equation, such as 3x + 4y = 12: rearrange it exactly.
    const lin = parseLinearEquation(s);
    if (!lin.ok) throw new ExprError(lin.error);
    const { A, B, C } = toStandard(lin.value);
    if (B.isZero()) {
      if (A.isZero()) throw new ExprError("That isn't a line.");
      return { kind: 'vertical', x: C.div(A).toNumber() };
    }
    const m = A.neg().div(B).toNumber();
    const b = C.div(B).toNumber();
    return { kind: 'function', node: { t: 'bin', op: '+', a: { t: 'bin', op: '*', a: { t: 'num', v: m }, b: { t: 'var', name: 'x' } }, b: { t: 'num', v: b } } };
  }
  return { kind: 'function', node: parseExpression(s, { allowX: true }) };
}
