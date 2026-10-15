import { evaluate, parseExpression, type Node } from '../../../math/expression';

/**
 * A small, unbranded classroom graphing calculator: the home screen, MODE,
 * Y=, WINDOW, ZOOM, GRAPH, TRACE, TABLE (and TBLSET) and the MATH menus.
 * Pure state machine: `pressG(state, key)` returns the next state, and the
 * render helpers turn a state into an 8 × 16 character screen or a 95 × 63
 * pixel graph. It copies the habits worth practising: (−) versus −, a
 * leading operator meaning "Ans", radians by default, ERR:SYNTAX screens.
 */

export type Screen = 'home' | 'mode' | 'yeq' | 'window' | 'tblset' | 'zoom' | 'graph' | 'trace' | 'table' | 'math' | 'err';

export interface GWindow {
  xmin: number;
  xmax: number;
  xscl: number;
  ymin: number;
  ymax: number;
  yscl: number;
}

export interface GState {
  screen: Screen;
  entry: string[];
  hist: { in: string[]; out: string }[];
  ans: number;
  lastEntry: string[];
  /** The X variable on the home screen (set by TRACE). */
  xVal: number;
  second: boolean;
  ys: string[][];
  row: number;
  col: number;
  win: GWindow;
  tbl: { start: number; step: number };
  /** Typing buffer on WINDOW / TBLSET rows, or TRACE's "X=" prompt. */
  edit: string[] | null;
  angle: 'rad' | 'deg';
  /** null = FLOAT, otherwise fixed decimal places. */
  fix: number | null;
  sci: boolean;
  dot: boolean;
  trace: { fn: number; px: number };
  tableTop: number;
  err: { kind: string; from: Screen; pick: number } | null;
  /** Which screen MATH inserts into. */
  menuFrom: Screen;
  /** Shown under the screen, outside the device. */
  note: string | null;
}

export const COLS = 16;
export const ROWS = 8;
export const GW = 95;
export const GH = 63;
const NFUN = 7;

export const STANDARD: GWindow = { xmin: -10, xmax: 10, xscl: 1, ymin: -10, ymax: 10, yscl: 1 };

export function initialG(): GState {
  return {
    screen: 'home',
    entry: [],
    hist: [],
    ans: 0,
    lastEntry: [],
    xVal: 0,
    second: false,
    ys: Array.from({ length: NFUN }, () => []),
    row: 0,
    col: 0,
    win: { ...STANDARD },
    tbl: { start: 0, step: 1 },
    edit: null,
    angle: 'rad',
    fix: null,
    sci: false,
    dot: false,
    trace: { fn: 0, px: 47 },
    tableTop: 0,
    err: null,
    menuFrom: 'home',
    note: null,
  };
}

// ─── Tokens and evaluation ──────────────────────────────────────────

/** Keys that type something, and the token they type. */
const TYPE: Record<string, string> = {
  add: '+',
  sub: '-',
  mul: '*',
  div: '/',
  pow: '^',
  sq: '²',
  recip: '⁻¹',
  lparen: '(',
  rparen: ')',
  neg: '⁻',
  comma: ',',
  sin: 'sin(',
  cos: 'cos(',
  tan: 'tan(',
  log: 'log(',
  ln: 'ln(',
  xt: 'X',
  '.': '.',
};
const SECOND_TYPE: Record<string, string> = {
  sq: '√(',
  pow: 'π',
  sin: 'sin⁻¹(',
  cos: 'cos⁻¹(',
  tan: 'tan⁻¹(',
  log: '10^(',
  ln: 'e^(',
  div: 'e',
  comma: 'ᴇ',
  neg: 'Ans',
};
for (let d = 0; d <= 9; d++) TYPE[String(d)] = String(d);

const TO_EXPR: Record<string, string> = {
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  '^': '^',
  '²': '^2',
  '³': '^3',
  '⁻¹': '^(-1)',
  '(': '(',
  ')': ')',
  '⁻': '-',
  π: 'pi',
  e: 'e',
  ᴇ: '*10^',
  'sin(': 'sin(',
  'cos(': 'cos(',
  'tan(': 'tan(',
  'sin⁻¹(': 'asin(',
  'cos⁻¹(': 'acos(',
  'tan⁻¹(': 'atan(',
  'log(': 'log(',
  'ln(': 'ln(',
  '10^(': '10^(',
  'e^(': 'e^(',
  '√(': 'sqrt(',
  '³√(': 'cbrt(',
  'abs(': 'abs(',
  'int(': 'floor(',
  'iPart(': 'ipart(',
  'fPart(': 'fpart(',
};

const OPENS = new Set(['(', 'sin(', 'cos(', 'tan(', 'sin⁻¹(', 'cos⁻¹(', 'tan⁻¹(', 'log(', 'ln(', '10^(', 'e^(', '√(', '³√(', 'abs(', 'int(', 'iPart(', 'fPart(']);
const BINARY = new Set(['+', '-', '*', '/', '^']);

export class GError extends Error {}

/** Tokens → parser text. Throws GError('SYNTAX') the way the real thing would. */
export function toExpr(tokens: string[], s: Pick<GState, 'ans' | 'xVal'>, graphing = false): string {
  let out = '';
  tokens.forEach((t, i) => {
    const prev = tokens[i - 1];
    if (t === ',') throw new GError('SYNTAX');
    // The subtraction key where a negative belongs: the classic mistake.
    if (t === '-' && (i === 0 || BINARY.has(prev) || OPENS.has(prev) || prev === '⁻' || prev === 'ᴇ')) throw new GError('SYNTAX');
    if (BINARY.has(t) && t !== '-' && (i === 0 || BINARY.has(prev) || OPENS.has(prev))) throw new GError('SYNTAX');
    if (/^\d$|^\.$/.test(t)) out += t;
    else if (t === 'X') out += graphing ? 'x' : `(${s.xVal})`;
    else if (t === 'Ans') out += `(${s.ans})`;
    else if (TO_EXPR[t] != null) out += TO_EXPR[t];
    else throw new GError('SYNTAX');
  });
  return out;
}

export function compile(tokens: string[], s: Pick<GState, 'ans' | 'xVal'>, graphing = false): Node {
  const text = toExpr(tokens, s, graphing);
  if (!text) throw new GError('SYNTAX');
  try {
    return parseExpression(text, { allowX: graphing });
  } catch {
    throw new GError('SYNTAX');
  }
}

export function evalTokens(tokens: string[], s: GState): number {
  const node = compile(tokens, s);
  const v = evaluate(node, 0, s.angle);
  if (Number.isNaN(v)) throw new GError(tokens.some((t) => ['√(', 'log(', 'ln(', 'sin⁻¹(', 'cos⁻¹('].includes(t)) || tokens.includes('^') ? 'NONREAL ANS' : 'DOMAIN');
  if (!Number.isFinite(v)) throw new GError(tokens.includes('/') || tokens.includes('⁻¹') ? 'DIVIDE BY 0' : 'OVERFLOW');
  return v;
}

/** Results the way the screen shows them: 10 significant digits, ᴇ notation, ⁻ for negatives. */
export function fmtNum(v: number, s: Pick<GState, 'fix' | 'sci'>, width = 16): string {
  if (Object.is(v, -0) || Math.abs(v) < 1e-13) v = 0;
  const neg = v < 0;
  const a = Math.abs(v);
  let str: string;
  if (s.sci || (a !== 0 && (a >= 1e10 || a < 1e-3))) {
    const [m, e] = a.toExponential(s.fix ?? 9).split('e');
    str = `${s.fix != null ? m : trim(m)}ᴇ${Number(e) < 0 ? '⁻' : ''}${Math.abs(Number(e))}`;
  } else if (s.fix != null) str = a.toFixed(s.fix);
  else str = trim(a.toPrecision(10));
  // The screen drops the leading zero: .5, not 0.5.
  if (str.startsWith('0.')) str = str.slice(1);
  str = (neg ? '⁻' : '') + str;
  return str.length > width ? str.slice(0, width) : str;
}
const trim = (m: string) => (m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m);

/** Best fraction with a denominator under 10 000, or null. */
export function toFrac(v: number): [number, number] | null {
  if (!Number.isFinite(v)) return null;
  const sign = v < 0 ? -1 : 1;
  const a0 = Math.abs(v);
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let x = a0;
  for (let i = 0; i < 32; i++) {
    const a = Math.floor(x);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > 9999) break;
    [h0, h1, k0, k1] = [h1, h2, k1, k2];
    if (Math.abs(a0 - h1 / k1) < 1e-10 * Math.max(1, a0)) return [sign * h1, k1];
    const f = x - a;
    if (f < 1e-12) break;
    x = 1 / f;
  }
  return null;
}

// ─── Menus ──────────────────────────────────────────────────────────

export const MATH_TABS: { name: string; items: { label: string; insert?: string; act?: 'frac' | 'dec' }[] }[] = [
  {
    name: 'MATH',
    items: [
      { label: '▶Frac', act: 'frac' },
      { label: '▶Dec', act: 'dec' },
      { label: '³', insert: '³' },
      { label: '³√(', insert: '³√(' },
    ],
  },
  {
    name: 'NUM',
    items: [
      { label: 'abs(', insert: 'abs(' },
      { label: 'iPart(', insert: 'iPart(' },
      { label: 'fPart(', insert: 'fPart(' },
      { label: 'int(', insert: 'int(' },
    ],
  },
];

export const ZOOM_ITEMS = ['ZBox', 'Zoom In', 'Zoom Out', 'ZDecimal', 'ZSquare', 'ZStandard', 'ZTrig'];

/** MODE rows: options, and whether the row can change in this model. */
export const MODE_ROWS: { opts: string[]; live: boolean }[] = [
  { opts: ['NORMAL', 'SCI'], live: true },
  { opts: ['FLOAT', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], live: true },
  { opts: ['RADIAN', 'DEGREE'], live: true },
  { opts: ['FUNC', 'PAR', 'POL', 'SEQ'], live: false },
  { opts: ['CONNECTED', 'DOT'], live: true },
];

function modeValue(s: GState, row: number): number {
  if (row === 0) return s.sci ? 1 : 0;
  if (row === 1) return s.fix == null ? 0 : s.fix + 1;
  if (row === 2) return s.angle === 'deg' ? 1 : 0;
  if (row === 4) return s.dot ? 1 : 0;
  return 0;
}

const WIN_KEYS: (keyof GWindow)[] = ['xmin', 'xmax', 'xscl', 'ymin', 'ymax', 'yscl'];
const WIN_LABEL: Record<keyof GWindow, string> = { xmin: 'Xmin=', xmax: 'Xmax=', xscl: 'Xscl=', ymin: 'Ymin=', ymax: 'Ymax=', yscl: 'Yscl=' };

const UNSUPPORTED: Record<string, string> = {
  alpha: 'ALPHA',
  stat: 'STAT',
  apps: 'APPS',
  prgm: 'PRGM',
  vars: 'VARS',
  sto: 'STO→',
  on: 'ON',
  calc: 'CALC',
  format: 'FORMAT',
  statplot: 'STAT PLOT',
  ins: 'INS',
};

// ─── The reducer ────────────────────────────────────────────────────

/** The second-function meaning of each key that has one here. */
const SECOND_ACTION: Record<string, string> = {
  mode: 'quit',
  graph: 'table',
  window: 'tblset',
  trace: 'calc',
  zoom: 'format',
  yeq: 'statplot',
  enter: 'entry',
  del: 'ins',
};

export function definedFns(s: GState): number[] {
  return s.ys.map((y, i) => (y.length ? i : -1)).filter((i) => i >= 0);
}

export function pressG(prev: GState, key: string): GState {
  let s: GState = { ...prev, note: null };
  if (key === '2nd') return { ...s, second: !s.second };
  let k = key;
  if (s.second) {
    s.second = false;
    if (SECOND_ACTION[key]) k = SECOND_ACTION[key];
    else if (SECOND_TYPE[key]) k = `type:${SECOND_TYPE[key]}`;
  }
  if (UNSUPPORTED[k]) return { ...s, note: `${UNSUPPORTED[k]} isn't in this practice model.` };

  // Error screen: 1:Quit, 2:Goto.
  if (s.screen === 'err' && s.err) {
    const quit = k === '1' || (k === 'enter' && s.err.pick === 0);
    const goto = k === '2' || (k === 'enter' && s.err.pick === 1);
    if (k === 'up' || k === 'down') return { ...s, err: { ...s.err, pick: 1 - s.err.pick } };
    if (quit) return { ...s, screen: 'home', entry: [], err: null };
    if (goto) return { ...s, screen: s.err.from, err: null };
    if (k === 'clear' || k === 'quit') return { ...s, screen: 'home', entry: [], err: null };
    return s;
  }

  // Screen keys work from anywhere.
  switch (k) {
    case 'quit':
      return { ...s, screen: 'home', edit: null };
    case 'mode':
      return { ...s, screen: 'mode', row: 0, col: modeValue(s, 0) };
    case 'yeq':
      return { ...s, screen: 'yeq', row: 0, edit: null };
    case 'window':
      return { ...s, screen: 'window', row: 0, edit: null };
    case 'tblset':
      return { ...s, screen: 'tblset', row: 0, edit: null };
    case 'zoom':
      return { ...s, screen: 'zoom', row: 0, col: 0, menuFrom: s.screen === 'zoom' ? s.menuFrom : s.screen };
    case 'graph':
      return { ...s, screen: 'graph', edit: null };
    case 'trace': {
      const fns = definedFns(s);
      if (!fns.length) return { ...s, screen: 'graph', note: 'Nothing to trace yet. Type a function in Y= first.' };
      return { ...s, screen: 'trace', trace: { fn: fns.includes(s.trace.fn) ? s.trace.fn : fns[0], px: s.trace.px }, edit: null };
    }
    case 'table':
      return { ...s, screen: 'table', row: 0, tableTop: 0 };
    case 'math':
      if (s.screen === 'home' || s.screen === 'yeq') return { ...s, screen: 'math', row: 0, col: 0, menuFrom: s.screen };
      return s;
  }

  switch (s.screen) {
    case 'home':
      return home(s, k);
    case 'yeq':
      return yeq(s, k);
    case 'window':
    case 'tblset':
      return windowEdit(s, k);
    case 'mode':
      return mode(s, k);
    case 'zoom':
      return zoomMenu(s, k);
    case 'math':
      return mathMenu(s, k);
    case 'graph':
      if (k === 'clear') return { ...s, screen: 'home' };
      if (['left', 'right', 'up', 'down'].includes(k)) return pressG({ ...s }, 'trace');
      return s;
    case 'trace':
      return trace(s, k);
    case 'table':
      if (k === 'clear') return { ...s, screen: 'home' };
      if (k === 'down') return s.row < 5 ? { ...s, row: s.row + 1 } : { ...s, tableTop: s.tableTop + 1 };
      if (k === 'up') return s.row > 0 ? { ...s, row: s.row - 1 } : { ...s, tableTop: s.tableTop - 1 };
      return s;
  }
  return s;
}

function typed(k: string): string | null {
  if (k.startsWith('type:')) return k.slice(5);
  return TYPE[k] ?? null;
}

function home(s: GState, k: string): GState {
  const t = typed(k);
  if (t != null) {
    // An operator first means "Ans <operator>", like the real thing.
    if (!s.entry.length && (['+', '-', '*', '/', '^', '²', '⁻¹'].includes(t) || t === '³')) return { ...s, entry: ['Ans', t] };
    return { ...s, entry: [...s.entry, t] };
  }
  if (k === 'del') return { ...s, entry: s.entry.slice(0, -1) };
  if (k === 'clear') return s.entry.length ? { ...s, entry: [] } : { ...s, hist: [] };
  if (k === 'entry') return { ...s, entry: [...s.lastEntry] };
  if (k === 'enter') {
    const entry = s.entry.length ? s.entry : s.lastEntry;
    if (!entry.length) return s;
    let tokens = entry;
    let as: 'frac' | 'dec' | null = null;
    const last = tokens[tokens.length - 1];
    if (last === '▶Frac' || last === '▶Dec') {
      as = last === '▶Frac' ? 'frac' : 'dec';
      tokens = tokens.slice(0, -1);
    }
    if (tokens.some((x) => x === '▶Frac' || x === '▶Dec')) return { ...s, screen: 'err', err: { kind: 'SYNTAX', from: 'home', pick: 0 } };
    try {
      const v = evalTokens(tokens, s);
      let out = fmtNum(v, s);
      if (as === 'frac') {
        const f = toFrac(v);
        if (f && f[1] !== 1) out = `${f[0] < 0 ? '⁻' : ''}${Math.abs(f[0])}/${f[1]}`;
      }
      return { ...s, entry: [], lastEntry: entry, ans: v, hist: [...s.hist, { in: entry, out }].slice(-30) };
    } catch (e) {
      if (e instanceof GError) return { ...s, screen: 'err', err: { kind: e.message, from: 'home', pick: 0 }, lastEntry: entry };
      throw e;
    }
  }
  return s;
}

function yeq(s: GState, k: string): GState {
  const row = s.row;
  const t = typed(k);
  if (t != null) return { ...s, ys: s.ys.map((y, i) => (i === row ? [...y, t] : y)) };
  if (k === 'del') return { ...s, ys: s.ys.map((y, i) => (i === row ? y.slice(0, -1) : y)) };
  if (k === 'clear') return { ...s, ys: s.ys.map((y, i) => (i === row ? [] : y)) };
  if (k === 'down' || k === 'enter') return { ...s, row: Math.min(NFUN - 1, row + 1) };
  if (k === 'up') return { ...s, row: Math.max(0, row - 1) };
  return s;
}

function windowEdit(s: GState, k: string): GState {
  const isTbl = s.screen === 'tblset';
  const nRows = isTbl ? 2 : WIN_KEYS.length;
  const commit = (st: GState): GState | null => {
    if (!st.edit) return st;
    if (!st.edit.length) return { ...st, edit: null };
    try {
      const v = evalTokens(st.edit, st);
      if (isTbl) return { ...st, edit: null, tbl: st.row === 0 ? { ...st.tbl, start: v } : { ...st.tbl, step: v } };
      return { ...st, edit: null, win: { ...st.win, [WIN_KEYS[st.row]]: v } };
    } catch (e) {
      if (e instanceof GError) return { ...st, edit: null, screen: 'err', err: { kind: e.message, from: st.screen, pick: 0 } };
      throw e;
    }
  };
  const t = typed(k);
  if (t != null) return { ...s, edit: [...(s.edit ?? []), t] };
  if (k === 'del') return { ...s, edit: (s.edit ?? []).slice(0, -1) };
  if (k === 'clear') return { ...s, edit: [] };
  if (k === 'down' || k === 'enter' || k === 'up') {
    const c = commit(s);
    if (!c || c.screen === 'err') return c ?? s;
    const row = k === 'up' ? Math.max(0, s.row - 1) : Math.min(nRows - 1, s.row + 1);
    return { ...c, row };
  }
  return s;
}

function mode(s: GState, k: string): GState {
  const live = MODE_ROWS.map((r, i) => (r.live ? i : -1)).filter((i) => i >= 0);
  if (k === 'down' || k === 'up') {
    const at = live.indexOf(s.row);
    const next = live[Math.min(live.length - 1, Math.max(0, at + (k === 'down' ? 1 : -1)))];
    return { ...s, row: next, col: modeValue(s, next) };
  }
  if (k === 'left' || k === 'right') {
    const n = MODE_ROWS[s.row].opts.length;
    return { ...s, col: Math.min(n - 1, Math.max(0, s.col + (k === 'right' ? 1 : -1))) };
  }
  if (k === 'enter') {
    const c = s.col;
    if (s.row === 0) return { ...s, sci: c === 1 };
    if (s.row === 1) return { ...s, fix: c === 0 ? null : c - 1 };
    if (s.row === 2) return { ...s, angle: c === 1 ? 'deg' : 'rad' };
    if (s.row === 4) return { ...s, dot: c === 1 };
  }
  if (k === 'clear') return { ...s, screen: 'home' };
  return s;
}

function zoomMenu(s: GState, k: string): GState {
  let pick = -1;
  if (/^[1-7]$/.test(k)) pick = Number(k) - 1;
  else if (k === 'enter') pick = s.row;
  else if (k === 'down') return { ...s, row: Math.min(ZOOM_ITEMS.length - 1, s.row + 1) };
  else if (k === 'up') return { ...s, row: Math.max(0, s.row - 1) };
  else if (k === 'clear') return { ...s, screen: s.menuFrom === 'zoom' ? 'home' : s.menuFrom };
  if (pick < 0) return s;
  const w = s.win;
  const cx = (w.xmin + w.xmax) / 2;
  const cy = (w.ymin + w.ymax) / 2;
  let win: GWindow = w;
  switch (pick) {
    case 0:
      return { ...s, note: 'ZBox needs a moving cursor box. Try Zoom In instead.' };
    case 1:
    case 2: {
      const f = pick === 1 ? 0.25 : 4;
      const hx = ((w.xmax - w.xmin) / 2) * f;
      const hy = ((w.ymax - w.ymin) / 2) * f;
      win = { ...w, xmin: cx - hx, xmax: cx + hx, ymin: cy - hy, ymax: cy + hy };
      break;
    }
    case 3:
      win = { xmin: -4.7, xmax: 4.7, xscl: 1, ymin: -3.1, ymax: 3.1, yscl: 1 };
      break;
    case 4: {
      const hx = (((w.ymax - w.ymin) / (GH - 1)) * (GW - 1)) / 2;
      win = { ...w, xmin: cx - hx, xmax: cx + hx };
      break;
    }
    case 5:
      win = { ...STANDARD };
      break;
    case 6:
      win = s.angle === 'deg' ? { xmin: -352.5, xmax: 352.5, xscl: 90, ymin: -4, ymax: 4, yscl: 1 } : { xmin: -6.152285613, xmax: 6.152285613, xscl: Math.PI / 2, ymin: -4, ymax: 4, yscl: 1 };
      break;
  }
  return { ...s, win, screen: 'graph' };
}

function mathMenu(s: GState, k: string): GState {
  const tab = MATH_TABS[s.col];
  let pick = -1;
  if (/^[1-9]$/.test(k)) pick = Number(k) - 1;
  else if (k === 'enter') pick = s.row;
  else if (k === 'down') return { ...s, row: Math.min(tab.items.length - 1, s.row + 1) };
  else if (k === 'up') return { ...s, row: Math.max(0, s.row - 1) };
  else if (k === 'right') return { ...s, col: Math.min(MATH_TABS.length - 1, s.col + 1), row: 0 };
  else if (k === 'left') return { ...s, col: Math.max(0, s.col - 1), row: 0 };
  else if (k === 'clear') return { ...s, screen: s.menuFrom };
  const item = tab.items[pick];
  if (!item) return s;
  const insert = item.insert ?? (item.act === 'frac' ? '▶Frac' : '▶Dec');
  if (s.menuFrom === 'yeq') {
    if (item.act) return { ...s, screen: 'yeq', note: `${item.label} works on the home screen.` };
    return { ...s, screen: 'yeq', ys: s.ys.map((y, i) => (i === s.row ? [...y, insert] : y)) };
  }
  // ▶Frac on an empty line converts the last answer.
  const entry = !s.entry.length && item.act ? ['Ans', insert] : [...s.entry, insert];
  return { ...s, screen: 'home', entry };
}

function trace(s: GState, k: string): GState {
  const fns = definedFns(s);
  if (s.edit) {
    // Typing a number in TRACE jumps to that X.
    const t = typed(k);
    if (t != null) return { ...s, edit: [...s.edit, t] };
    if (k === 'del') return { ...s, edit: s.edit.slice(0, -1) };
    if (k === 'clear') return { ...s, edit: null };
    if (k === 'enter') {
      try {
        const x = evalTokens(s.edit, s);
        if (x < s.win.xmin || x > s.win.xmax) return { ...s, edit: null, screen: 'err', err: { kind: 'INVALID', from: 'trace', pick: 0 } };
        const px = Math.round(((x - s.win.xmin) / (s.win.xmax - s.win.xmin)) * (GW - 1));
        return { ...s, edit: null, trace: { ...s.trace, px }, xVal: x };
      } catch {
        return { ...s, edit: null };
      }
    }
    return s;
  }
  if (typed(k) != null && /^[\d.]$|^⁻$/.test(typed(k)!)) return { ...s, edit: [typed(k)!] };
  if (k === 'left' || k === 'right') {
    let px = s.trace.px + (k === 'right' ? 1 : -1);
    let win = s.win;
    // Walking off the edge pans the window, like the real thing.
    if (px < 0 || px > GW - 1) {
      const dx = ((win.xmax - win.xmin) / (GW - 1)) * (px < 0 ? -1 : 1);
      win = { ...win, xmin: win.xmin + dx, xmax: win.xmax + dx };
      px = Math.min(GW - 1, Math.max(0, px));
    }
    return { ...s, win, trace: { ...s.trace, px }, xVal: traceX(s.win, px) };
  }
  if (k === 'up' || k === 'down') {
    const i = fns.indexOf(s.trace.fn);
    const next = fns[(i + (k === 'down' ? 1 : -1) + fns.length) % fns.length];
    return { ...s, trace: { ...s.trace, fn: next } };
  }
  if (k === 'enter') {
    // ENTER re-centres the window on the cursor.
    const x = traceX(s.win, s.trace.px);
    const y = fnValue(s, s.trace.fn, x);
    const hx = (s.win.xmax - s.win.xmin) / 2;
    const hy = (s.win.ymax - s.win.ymin) / 2;
    const win = Number.isFinite(y) ? { ...s.win, xmin: x - hx, xmax: x + hx, ymin: y - hy, ymax: y + hy } : s.win;
    return { ...s, win, trace: { ...s.trace, px: (GW - 1) / 2 } };
  }
  if (k === 'clear') return { ...s, screen: 'graph' };
  return s;
}

export const traceX = (w: GWindow, px: number) => w.xmin + (px * (w.xmax - w.xmin)) / (GW - 1);

const nodeCache = new Map<string, Node | null>();
function fnNode(tokens: string[]): Node | null {
  const key = tokens.join('\u0001');
  if (!nodeCache.has(key)) {
    try {
      nodeCache.set(key, compile(tokens, { ans: 0, xVal: 0 }, true));
    } catch {
      nodeCache.set(key, null);
    }
    if (nodeCache.size > 200) nodeCache.delete(nodeCache.keys().next().value!);
  }
  return nodeCache.get(key)!;
}

/** Y_n(x) with the current Ans and angle mode. */
export function fnValue(s: GState, fn: number, x: number): number {
  const tokens = s.ys[fn];
  if (!tokens?.length) return NaN;
  // Ans inside a function needs the live value, so skip the cache for it.
  const node = tokens.includes('Ans') ? (() => { try { return compile(tokens, s, true); } catch { return null; } })() : fnNode(tokens);
  if (!node) return NaN;
  return evaluate(node, x, s.angle);
}

// ─── Rendering ──────────────────────────────────────────────────────

export interface Cell {
  ch: string;
  inv?: boolean;
  blink?: boolean;
  /** Small text, for the "2nd" cursor. */
  dim?: boolean;
}
type Row = Cell[];

const cells = (text: string, opts: Partial<Cell> = {}): Cell[] => [...text].map((ch) => ({ ch, ...opts }));
const pad = (r: Cell[]): Row => [...r, ...cells(' '.repeat(Math.max(0, COLS - r.length)))].slice(0, COLS);
const right = (text: string): Row => pad([...cells(' '.repeat(Math.max(0, COLS - [...text].length))), ...cells(text)]);

/** Wraps a token list into screen lines, with the cursor at the end. */
function wrapTokens(tokens: string[], cursor: Cell | null, prefix = ''): Row[] {
  const chars: Cell[] = [...cells(prefix), ...cells(tokens.join(''))];
  if (cursor) chars.push(cursor);
  const out: Row[] = [];
  for (let i = 0; i < Math.max(1, chars.length); i += COLS) out.push(pad(chars.slice(i, i + COLS)));
  return out;
}

const cursorCell = (s: GState): Cell => ({ ch: s.second ? '↑' : ' ', inv: true, blink: true });

export function screenRows(s: GState): Row[] {
  switch (s.screen) {
    case 'err': {
      const e = s.err!;
      return [
        pad(cells(`ERR:${e.kind}`)),
        pad([...cells('1', { inv: e.pick === 0 }), ...cells(':Quit')]),
        pad([...cells('2', { inv: e.pick === 1 }), ...cells(':Goto')]),
        ...Array.from({ length: ROWS - 3 }, () => pad([])),
      ];
    }
    case 'home': {
      const lines: Row[] = [];
      for (const h of s.hist) {
        lines.push(...wrapTokens(h.in, null));
        lines.push(right(h.out));
      }
      lines.push(...wrapTokens(s.entry, cursorCell(s)));
      const shown = lines.slice(-ROWS);
      while (shown.length < ROWS) shown.push(pad([]));
      return shown;
    }
    case 'mode':
      return [
        ...MODE_ROWS.map((r, ri) => {
          const val = modeValue(s, ri);
          const out: Cell[] = [];
          r.opts.forEach((o, oi) => {
            const sep = ri === 1 ? (oi === 0 ? 0 : oi === 1 ? 1 : 0) : oi > 0 ? 1 : 0;
            if (sep) out.push({ ch: ' ' });
            const sel = oi === val;
            const cur = ri === s.row && oi === s.col;
            out.push(...cells(o, { inv: sel, blink: cur && !sel, dim: !r.live && !sel }));
          });
          return pad(out);
        }),
        ...Array.from({ length: ROWS - MODE_ROWS.length }, () => pad([])),
      ];
    case 'yeq': {
      const rows: Row[] = [pad(cells('Plt1 Plt2 Plt3', { dim: true }))];
      s.ys.forEach((y, i) => {
        const label = cells(`\\Y${i + 1}`);
        const eq: Cell = { ch: '=', inv: y.length > 0 };
        const body = cells(y.join(''));
        const cur = i === s.row ? [cursorCell(s)] : [];
        let line = [...label, eq, ...body, ...cur];
        if (line.length > COLS) line = [...label, eq, { ch: '…' }, ...line.slice(line.length - (COLS - label.length - 2))];
        rows.push(pad(line));
      });
      return rows.slice(0, ROWS);
    }
    case 'window':
    case 'tblset': {
      const tbl = s.screen === 'tblset';
      const rows: Row[] = [pad(cells(tbl ? 'TABLE SETUP' : 'WINDOW'))];
      const items: [string, number][] = tbl
        ? [
            ['TblStart=', s.tbl.start],
            ['ΔTbl=', s.tbl.step],
          ]
        : WIN_KEYS.map((k) => [WIN_LABEL[k], s.win[k]]);
      items.forEach(([label, v], i) => {
        const editing = i === s.row && s.edit;
        const value = editing ? cells(s.edit!.join('')) : cells(fmtNum(v, { fix: null, sci: false }, COLS - label.length));
        const cur = i === s.row ? (editing ? [cursorCell(s)] : value.map((c, j) => (j === 0 ? { ...c, inv: true, blink: true } : c))) : null;
        rows.push(pad([...cells(label), ...(editing ? value : cur ?? value), ...(editing ? cur! : [])]));
      });
      if (tbl) {
        rows.push(pad([...cells('Indpnt: '), ...cells('Auto', { inv: true }), ...cells(' Ask')]));
        rows.push(pad([...cells('Depend: '), ...cells('Auto', { inv: true }), ...cells(' Ask')]));
      } else rows.push(pad(cells('Xres=1', { dim: true })));
      while (rows.length < ROWS) rows.push(pad([]));
      return rows;
    }
    case 'zoom':
      return [
        pad([...cells('ZOOM', { inv: true }), ...cells(' MEMORY', { dim: true })]),
        ...ZOOM_ITEMS.map((z, i) => pad([...cells(`${i + 1}`, { inv: i === s.row }), ...cells(`${i === ZOOM_ITEMS.length - 1 ? '↓' : ':'}${z}`)])),
      ];
    case 'math': {
      const head: Cell[] = [];
      MATH_TABS.forEach((t, i) => {
        if (i) head.push({ ch: ' ' });
        head.push(...cells(t.name, { inv: i === s.col }));
      });
      head.push(...cells(' CPX PRB', { dim: true }));
      const items = MATH_TABS[s.col].items.map((it, i) => pad([...cells(`${i + 1}`, { inv: i === s.row }), ...cells(`:${it.label}`)]));
      const rows = [pad(head), ...items];
      while (rows.length < ROWS) rows.push(pad([]));
      return rows;
    }
    case 'table': {
      const fns = definedFns(s).slice(0, 2);
      const col = (text: string, w: number) => [...text].slice(0, w).join('').padStart(w, ' ');
      const head = `${col('X', 5)}│${col(fns[0] != null ? `Y${fns[0] + 1}` : 'Y1', 5)}│${col(fns[1] != null ? `Y${fns[1] + 1}` : '', 4)}`;
      const rows: Row[] = [pad(cells(head))];
      for (let r = 0; r < 6; r++) {
        const x = s.tbl.start + (s.tableTop + r) * s.tbl.step;
        const y1 = fns[0] != null ? fnValue(s, fns[0], x) : NaN;
        const y2 = fns[1] != null ? fnValue(s, fns[1], x) : NaN;
        const v = (n: number, w: number) => (Number.isFinite(n) ? fmtNum(n, { fix: null, sci: false }, w) : fns.length ? 'ERROR'.slice(0, w) : '');
        rows.push(pad([...cells(col(v(x, 5), 5), { inv: r === s.row }), ...cells(`│${col(v(y1, 5), 5)}│${col(fns[1] != null ? v(y2, 4) : '', 4)}`)]));
      }
      const x = s.tbl.start + (s.tableTop + s.row) * s.tbl.step;
      rows.push(pad(cells(`X=${fmtNum(x, { fix: null, sci: false }, 14)}`)));
      return rows;
    }
    default:
      return Array.from({ length: ROWS }, () => pad([]));
  }
}

/** The graph as a 95 × 63 bitmap (1 = dark pixel), plus where the trace cursor is. */
export function plotG(s: GState): { px: Uint8Array; cursor: { x: number; y: number } | null } {
  const px = new Uint8Array(GW * GH);
  const w = s.win;
  const X = (x: number) => ((x - w.xmin) / (w.xmax - w.xmin)) * (GW - 1);
  const Y = (y: number) => ((w.ymax - y) / (w.ymax - w.ymin)) * (GH - 1);
  const set = (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi >= 0 && xi < GW && yi >= 0 && yi < GH) px[yi * GW + xi] = 1;
  };
  // Axes and tick marks.
  const ax = Y(0);
  const ay = X(0);
  if (ax >= 0 && ax <= GH - 1) for (let x = 0; x < GW; x++) set(x, ax);
  if (ay >= 0 && ay <= GW - 1) for (let y = 0; y < GH; y++) set(ay, y);
  if (w.xscl > 0 && ((w.xscl / (w.xmax - w.xmin)) * GW) > 2 && ax >= 0 && ax <= GH - 1)
    for (let t = Math.ceil(w.xmin / w.xscl) * w.xscl; t <= w.xmax; t += w.xscl) {
      set(X(t), ax - 1);
      set(X(t), ax + 1);
    }
  if (w.yscl > 0 && ((w.yscl / (w.ymax - w.ymin)) * GH) > 2 && ay >= 0 && ay <= GW - 1)
    for (let t = Math.ceil(w.ymin / w.yscl) * w.yscl; t <= w.ymax; t += w.yscl) {
      set(ay - 1, Y(t));
      set(ay + 1, Y(t));
    }
  // Functions, one column at a time, joined unless the jump is off the screen.
  for (const fn of definedFns(s)) {
    let last: number | null = null;
    for (let c = 0; c < GW; c++) {
      const y = Y(fnValue(s, fn, traceX(w, c)));
      if (!Number.isFinite(y)) {
        last = null;
        continue;
      }
      if (!s.dot && last != null && Math.abs(y - last) < GH * 1.5) {
        const steps = Math.max(1, Math.ceil(Math.abs(y - last)));
        for (let i = 0; i <= steps; i++) set(c - 1 + i / steps, last + ((y - last) * i) / steps);
      } else set(c, y);
      last = y;
    }
  }
  let cursor = null;
  if (s.screen === 'trace') {
    const x = traceX(w, s.trace.px);
    const y = Y(fnValue(s, s.trace.fn, x));
    cursor = { x: s.trace.px, y: Number.isFinite(y) ? Math.round(y) : -100 };
  }
  return { px, cursor };
}

/** The text drawn over the graph in TRACE. */
export function traceText(s: GState): { top: string; bottom: string } {
  const x = traceX(s.win, s.trace.px);
  const y = fnValue(s, s.trace.fn, x);
  const f = (v: number) => (Number.isFinite(v) ? fmtNum(v, { fix: s.fix, sci: false }, 6) : '');
  const top = `Y${s.trace.fn + 1}=${s.ys[s.trace.fn].join('')}`;
  // X on the left half, Y on the right, like the real screen.
  const bottom = s.edit ? `X=${s.edit.join('')}` : `X=${f(x)}`.padEnd(9, ' ') + `Y=${f(y)}`;
  return { top: top.slice(0, COLS), bottom: bottom.slice(0, COLS) };
}
