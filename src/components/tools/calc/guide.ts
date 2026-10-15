/**
 * Lesson key guides. A lesson step can say "work out 10 × sin(35)"; this turns
 * that into the exact keys to press on the student's chosen calculator model,
 * including 2nd-function chords and the negative-vs-minus distinction that
 * trips people up on real exam calculators.
 */
export type CalcModel = 'basic' | 'scientific' | 'graphing' | 'exam';

export interface GuideKey {
  /** Key id on that model's keypad. */
  id: string;
  /** What's printed on the key, for the guide strip. */
  label: string;
}

type Tok =
  | { t: 'num'; v: string }
  | { t: 'op'; v: '+' | '−' | '×' | '÷' | '^' }
  | { t: 'neg' }
  | { t: 'paren'; v: '(' | ')' }
  | { t: 'sq' }
  | { t: 'fn'; v: Fn }
  | { t: 'pi' };

type Fn = 'sqrt' | 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan' | 'ln' | 'log';

const FN_TEXT: [string, Fn][] = [
  ['sin⁻¹(', 'asin'],
  ['cos⁻¹(', 'acos'],
  ['tan⁻¹(', 'atan'],
  ['√(', 'sqrt'],
  ['sin(', 'sin'],
  ['cos(', 'cos'],
  ['tan(', 'tan'],
  ['ln(', 'ln'],
  ['log(', 'log'],
];

/** Reads guide expressions like "(−3)² − 4 × 1 × 6" or "10 × sin(35)". */
export function tokenizeGuide(expr: string): Tok[] | null {
  const s = expr.replace(/\s+/g, '').replace(/-/g, '−').replace(/\*/g, '×').replace(/\//g, '÷');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const fn = FN_TEXT.find(([t]) => s.startsWith(t, i));
    if (fn) {
      out.push({ t: 'fn', v: fn[1] });
      i += fn[0].length;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      out.push({ t: 'num', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '−') {
      const prev = out[out.length - 1];
      const unary = !prev || prev.t === 'op' || prev.t === 'neg' || (prev.t === 'paren' && prev.v === '(') || prev.t === 'fn';
      out.push(unary ? { t: 'neg' } : { t: 'op', v: '−' });
      i++;
      continue;
    }
    if ('+×÷^'.includes(c)) {
      out.push({ t: 'op', v: c as '+' });
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      out.push({ t: 'paren', v: c });
      i++;
      continue;
    }
    if (c === '²') {
      out.push({ t: 'sq' });
      i++;
      continue;
    }
    if (c === 'π') {
      out.push({ t: 'pi' });
      i++;
      continue;
    }
    return null;
  }
  return out;
}

const K = (id: string, label: string): GuideKey => ({ id, label });
const OPS: Record<string, GuideKey> = { '+': K('add', '+'), '−': K('sub', '−'), '×': K('mul', '×'), '÷': K('div', '÷') };

/** Keys for each model. `null` means the model can't do it. */
const MAP: Record<CalcModel, (t: Tok) => GuideKey[] | null> = {
  basic: (t) => {
    if (t.t === 'num') return [...t.v].map((c) => K(c, c));
    if (t.t === 'op') return t.v === '^' ? null : [OPS[t.v]];
    if (t.t === 'neg') return [K('sub', '−')];
    if (t.t === 'paren') return [K(t.v === '(' ? 'lparen' : 'rparen', t.v)];
    if (t.t === 'sq') return [K('sq', 'x²')];
    if (t.t === 'fn') return t.v === 'sqrt' ? [K('sqrt', '√')] : null;
    return null;
  },
  scientific: (t) => {
    if (t.t === 'num') return [...t.v].map((c) => K(c, c));
    if (t.t === 'op') return t.v === '^' ? [K('pow', 'xʸ')] : [OPS[t.v]];
    if (t.t === 'neg') return [K('sub', '−')];
    if (t.t === 'paren') return [K(t.v === '(' ? 'lparen' : 'rparen', t.v)];
    if (t.t === 'sq') return [K('sq', 'x²')];
    if (t.t === 'pi') return [K('pi', 'π')];
    const L: Record<Fn, string> = { sqrt: '√', sin: 'sin', cos: 'cos', tan: 'tan', asin: 'sin⁻¹', acos: 'cos⁻¹', atan: 'tan⁻¹', ln: 'ln', log: 'log' };
    return [K(t.v, L[t.v])];
  },
  graphing: (t) => {
    if (t.t === 'num') return [...t.v].map((c) => K(c, c));
    if (t.t === 'op') return t.v === '^' ? [K('pow', '^')] : [OPS[t.v]];
    if (t.t === 'neg') return [K('neg', '(−)')];
    if (t.t === 'paren') return [K(t.v === '(' ? 'lparen' : 'rparen', t.v)];
    if (t.t === 'sq') return [K('sq', 'x²')];
    if (t.t === 'pi') return [K('2nd', '2nd'), K('pow', 'π')];
    if (t.v === 'sqrt') return [K('2nd', '2nd'), K('sq', '√')];
    if (t.v === 'asin' || t.v === 'acos' || t.v === 'atan') return [K('2nd', '2nd'), K(t.v.slice(1), `${t.v.slice(1).toUpperCase()}⁻¹`)];
    return [K(t.v, t.v.toUpperCase())];
  },
  exam: (t) => {
    if (t.t === 'num') return [...t.v].map((c) => K(c, c));
    if (t.t === 'op') return t.v === '^' ? [K('pow', '^')] : [OPS[t.v]];
    if (t.t === 'neg') return [K('neg', '(−)')];
    if (t.t === 'paren') return [K(t.v === '(' ? 'lparen' : 'rparen', t.v)];
    if (t.t === 'sq') return [K('sq', 'x²')];
    if (t.t === 'pi') return [K('pi', 'π')];
    if (t.v === 'sqrt') return [K('2nd', '2nd'), K('sq', '√')];
    if (t.v === 'asin' || t.v === 'acos' || t.v === 'atan') return [K('2nd', '2nd'), K(t.v.slice(1), `${t.v.slice(1)}⁻¹`)];
    return [K(t.v, t.v)];
  },
};

const ENTER: Record<CalcModel, GuideKey> = { basic: K('eq', '='), scientific: K('eq', '='), graphing: K('enter', 'ENTER'), exam: K('enter', 'enter') };

export type GuideResult = { ok: true; keys: GuideKey[] } | { ok: false; needs: string };

/** The full key sequence for an expression on a model, ending with = / ENTER. */
export function guideKeys(expr: string, model: CalcModel): GuideResult {
  const toks = tokenizeGuide(expr);
  if (!toks) return { ok: false, needs: 'that expression' };
  const keys: GuideKey[] = [];
  for (const t of toks) {
    const k = MAP[model](t);
    if (!k) return { ok: false, needs: t.t === 'fn' ? t.v.replace(/^a/, 'inverse ') : t.t === 'op' ? 'powers' : t.t === 'pi' ? 'π' : 'that' };
    keys.push(...k);
  }
  keys.push(ENTER[model]);
  return { ok: true, keys };
}
