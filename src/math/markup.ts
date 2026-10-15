import { Rational } from './rational';

/**
 * A tiny math markup used by the engine so that steps stay UI-agnostic.
 *
 *   {num/den}   stacked fraction (nestable)
 *   x_1         subscript
 *   x^2, r^{n-1} superscript (one character, a run of digits, or a {group})
 *   √{50}       square root with a bar over the group
 *   ±           plus-or-minus
 *   "cm²"       upright text (units, words)
 *   single letters render italic; longer words render upright
 *   -           rendered as a true minus sign
 *
 * `toPlain` turns the same markup into copy-friendly text.
 */
export type Markup = string;

export function fmtR(r: Rational): Markup {
  if (r.isInteger()) return r.n.toString();
  const n = r.n < 0n ? -r.n : r.n;
  return `${r.isNegative() ? '-' : ''}{${n}/${r.d}}`;
}

/** Wraps negative values in parentheses, for substitution steps. */
export function fmtRParen(r: Rational): Markup {
  return r.isNegative() ? `(${fmtR(r)})` : fmtR(r);
}

export interface Term {
  coef: Rational;
  v?: string;
}

/** Formats a sum of terms with proper signs, hiding 1-coefficients and zero terms. */
export function fmtTerms(terms: Term[], { keepZero = false } = {}): Markup {
  const shown = terms.filter((t) => keepZero || !t.coef.isZero());
  if (shown.length === 0) return '0';
  return shown
    .map((t, i) => {
      const neg = t.coef.isNegative();
      const mag = t.coef.abs();
      let body: string;
      if (t.v) body = mag.isOne() ? t.v : `${fmtR(mag)}${t.v}`;
      else body = fmtR(mag);
      if (i === 0) return neg ? `-${body}` : body;
      return `${neg ? ' - ' : ' + '}${body}`;
    })
    .join('');
}

/** y = mx + b, collapsing zero and unit cases. */
export function fmtSlopeIntercept(m: Rational, b: Rational): Markup {
  return `y = ${fmtTerms([{ coef: m, v: 'x' }, { coef: b }])}`;
}

const SUB_DIGITS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  n: 'ₙ', i: 'ᵢ', k: 'ₖ', x: 'ₓ',
};

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺' };
const SUP_TEXT: Record<string, string> = { ...SUP, n: 'ⁿ', '(': '⁽', ')': '⁾', ' ': '' , i: 'ⁱ' };

/** Reads a `{…}` group starting at s[i] === '{'; returns its inside and the index after it. */
function readBraces(s: string, i: number): { inner: string; end: number } {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') {
      depth--;
      if (depth === 0) return { inner: s.slice(i + 1, j), end: j + 1 };
    }
  }
  return { inner: s.slice(i + 1), end: s.length };
}

/** Superscript text: real superscript characters when they all exist, else ^(…). */
function supPlain(raw: string): string {
  const plain = toPlain(raw);
  const chars = [...plain.replace(/−/g, '-')];
  return chars.every((c) => SUP_TEXT[c] != null) ? chars.map((c) => SUP_TEXT[c]).join('') : `^(${plain})`;
}
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '-': '₋', '+': '₊' };
const NUCLIDE = /\[([^|\]]*)\|([^|\]]*)\|([^\]]*)\]/g;

export function toPlain(m: Markup): string {
  // Nuclides [A|Z|Sym] become ²¹⁰₈₄Po; positrons get an explicit +.
  m = m.replace(NUCLIDE, (_, a: string, z: string, sym: string) => {
    const zz = sym === 'e' && /^\d/.test(z) && z !== '0' ? `+${z}` : z;
    return [...a].map((c) => SUP[c] ?? c).join('') + [...zz].map((c) => SUB[c] ?? c).join('') + sym;
  });
  let out = '';
  let i = 0;
  const readGroup = (): string => {
    // assumes m[i] === '{'
    let depth = 0;
    let num = '';
    let den = '';
    let inDen = false;
    i++;
    for (; i < m.length; i++) {
      const c = m[i];
      if (c === '{') depth++;
      if (c === '}') {
        if (depth === 0) break;
        depth--;
      }
      if (c === '/' && depth === 0 && !inDen) {
        inDen = true;
        continue;
      }
      if (inDen) den += c;
      else num += c;
    }
    i++;
    const pn = toPlain(num);
    const pd = toPlain(den);
    const wrap = (s: string) => (/[\s+\-]/.test(s.replace(/^-/, '')) ? `(${s})` : s);
    return `${wrap(pn)}/${wrap(pd)}`;
  };
  while (i < m.length) {
    const c = m[i];
    if (c === '"') {
      const close = m.indexOf('"', i + 1);
      if (close > i) {
        out += m.slice(i + 1, close);
        i = close + 1;
        continue;
      }
    }
    if (c === '^' && i + 1 < m.length) {
      if (m[i + 1] === '{') {
        const g = readBraces(m, i + 1);
        out += supPlain(g.inner);
        i = g.end;
      } else {
        let j = i + 1;
        if (/\d/.test(m[j])) while (j < m.length && /\d/.test(m[j])) j++;
        else j++;
        out += supPlain(m.slice(i + 1, j));
        i = j;
      }
      continue;
    }
    if (c === '√' && m[i + 1] === '{') {
      const g = readBraces(m, i + 1);
      const inner = toPlain(g.inner);
      out += /^[\w.]+$/.test(inner) ? `√${inner}` : `√(${inner})`;
      i = g.end;
      continue;
    }
    if (c === '{') {
      out += readGroup();
      continue;
    }
    if (c === '_' && i + 1 < m.length) {
      out += SUB_DIGITS[m[i + 1]] ?? m[i + 1];
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const UPRIGHT = new Set([
  'sin', 'cos', 'tan', 'log', 'ln', 'is', 'or', 'and', 'of', 'to', 'in', 'the', 'opp', 'adj', 'hyp', 'run', 'max', 'min', 'lim',
  'sum', 'no', 'all', 'any', 'one', 'two', 'cm', 'mm', 'km', 'ft', 'yd', 'mi', 'deg', 'not', 'odd', 'so', 'by', 'mod',
]);

export type MathNode =
  | { k: 'text'; s: string }
  | { k: 'var'; s: string }
  | { k: 'op'; s: string }
  | { k: 'sub'; base: MathNode; sub: string }
  | { k: 'sup'; base: MathNode; sup: MathNode[] }
  | { k: 'sqrt'; inner: MathNode[] }
  | { k: 'frac'; num: MathNode[]; den: MathNode[] }
  | { k: 'nuc'; a: string; z: string; sym: string };

/** Parses markup into nodes for rendering. Never throws; unmatched braces become text. */
export function parseMarkup(m: Markup): MathNode[] {
  let i = 0;
  const parseSeq = (stopAtSlash: boolean): MathNode[] => {
    const nodes: MathNode[] = [];
    while (i < m.length) {
      const c = m[i];
      if (c === '}') return nodes;
      if (c === '/' && stopAtSlash) return nodes;
      if (c === '[') {
        const close = m.indexOf(']', i);
        const parts = close > i ? m.slice(i + 1, close).split('|') : [];
        if (parts.length === 3) {
          const [a, z, sym] = parts;
          nodes.push({ k: 'nuc', a, z: sym === 'e' && /^\d/.test(z) && z !== '0' ? `+${z}` : z, sym });
          i = close + 1;
          continue;
        }
      }
      if (c === '"') {
        const close = m.indexOf('"', i + 1);
        if (close > i) {
          nodes.push({ k: 'text', s: m.slice(i + 1, close) });
          i = close + 1;
          continue;
        }
      }
      if (c === '√' && m[i + 1] === '{') {
        i += 2;
        const inner = parseSeq(false);
        if (m[i] === '}') i++;
        nodes.push({ k: 'sqrt', inner });
        continue;
      }
      if (c === '^' && i + 1 < m.length) {
        const base: MathNode = nodes.pop() ?? { k: 'text', s: '' };
        let sup: MathNode[];
        if (m[i + 1] === '{') {
          i += 2;
          sup = parseSeq(false);
          if (m[i] === '}') i++;
        } else {
          let j = i + 1;
          if (/\d/.test(m[j])) while (j < m.length && /\d/.test(m[j])) j++;
          else j++;
          sup = parseMarkup(m.slice(i + 1, j));
          i = j;
        }
        nodes.push({ k: 'sup', base, sup });
        continue;
      }
      if (c === '{') {
        const start = i;
        i++;
        const num = parseSeq(true);
        if (m[i] !== '/') {
          i = start + 1;
          nodes.push({ k: 'text', s: '{' });
          continue;
        }
        i++;
        const den = parseSeq(false);
        if (m[i] === '}') i++;
        nodes.push({ k: 'frac', num, den });
        continue;
      }
      if (c === '_' && i + 1 < m.length && nodes.length) {
        const base = nodes.pop()!;
        nodes.push({ k: 'sub', base, sub: m[i + 1] });
        i += 2;
        continue;
      }
      if (/[A-Za-z]/.test(c)) {
        let j = i;
        while (j < m.length && /[A-Za-z]/.test(m[j])) j++;
        const word = m.slice(i, j);
        // Short unknown words are products of variables (ab, bh); real words stay upright.
        const isVar = word.length === 1 || (word.length <= 3 && !UPRIGHT.has(word));
        nodes.push(isVar ? { k: 'var', s: word } : { k: 'text', s: word });
        i = j;
        continue;
      }
      if (c === '-') {
        // Unary minus (start, after "(", "=" or another operator) hugs its number.
        let j = i - 1;
        while (j >= 0 && m[j] === ' ') j--;
        const unary = j < 0 || '(=+-·×÷±≈,{/^'.includes(m[j]);
        nodes.push(unary ? { k: 'text', s: '−' } : { k: 'op', s: '−' });
        i++;
        continue;
      }
      if (c === '=' || c === '+' || c === '·' || c === '×' || c === '÷' || c === '±' || c === '≈' || c === '≠' || c === '≤' || c === '≥' || c === '<' || c === '>') {
        nodes.push({ k: 'op', s: c });
        i++;
        continue;
      }
      let j = i;
      while (j < m.length && !/[{}_^√"A-Za-z\-=+·×÷±≈≠≤≥<>/[]/.test(m[j])) j++;
      if (j === i) j = i + 1;
      nodes.push({ k: 'text', s: m.slice(i, j) });
      i = j;
    }
    return nodes;
  };
  const out: MathNode[] = [];
  while (i < m.length) {
    out.push(...parseSeq(false));
    if (i < m.length) {
      out.push({ k: 'text', s: m[i] });
      i++;
    }
  }
  return out;
}
