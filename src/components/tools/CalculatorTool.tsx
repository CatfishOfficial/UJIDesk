import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Delete } from 'lucide-react';
import { useWindowData, useWorkspace, uid } from '../../state/store';
import { useUI } from '../../state/ui';
import { evaluate, formatNumber, parseExpression, type AngleMode } from '../../math/expression';
import { parseLinearExpression } from '../../math/linear';
import { InventoryGrid } from '../ui/InventoryGrid';
import { CALCULATOR_MODELS } from '../../data/catalog';
import { MathView } from '../ui/MathView';
import { fmtR } from '../../math/markup';
import { GraphingCalc } from './calc/GraphingCalc';
import { ExamCalc } from './calc/ExamCalc';
import { useCalcGuide } from './calc/useCalcGuide';
import type { CalcModel } from './calc/guide';
import type { GState } from './calc/graphingEngine';
import type { EState } from './calc/examEngine';

interface TapeEntry {
  id: string;
  expr: string;
  result: string;
}

interface CalcData extends Record<string, unknown> {
  model: string;
  expr: string;
  tape: TapeEntry[];
  fresh?: boolean;
  exact?: boolean;
  /** Scientific model: angles in degrees (default) or radians. */
  angle?: AngleMode;
  /** Graphing and exam models keep their own device state. */
  g?: GState;
  e?: EState;
}

/** Each model needs a different amount of room. */
const MODEL_SIZE: Record<CalcModel, { w: number; h: number }> = {
  basic: { w: 300, h: 460 },
  scientific: { w: 320, h: 610 },
  graphing: { w: 350, h: 760 },
  exam: { w: 320, h: 600 },
};

type Key = { id: string; label: string; insert?: string; act?: 'clear' | 'back' | 'eval' | 'neg' | 'exact' | 'angle' | 'ans'; kind?: 'op' | 'fn' | 'eq' | 'num' | 'sci'; aria?: string; /** keeps going from the last answer, like an operator */ postfix?: boolean };

/** Extra rows for the Scientific model. */
const SCI_KEYS: Key[] = [
  { id: 'sin', label: 'sin', insert: 'sin(', kind: 'sci', aria: 'sine' },
  { id: 'cos', label: 'cos', insert: 'cos(', kind: 'sci', aria: 'cosine' },
  { id: 'tan', label: 'tan', insert: 'tan(', kind: 'sci', aria: 'tangent' },
  { id: 'angle', label: 'DEG', act: 'angle', kind: 'sci', aria: 'switch degrees or radians' },
  { id: 'asin', label: 'sin⁻¹', insert: 'asin(', kind: 'sci', aria: 'inverse sine' },
  { id: 'acos', label: 'cos⁻¹', insert: 'acos(', kind: 'sci', aria: 'inverse cosine' },
  { id: 'atan', label: 'tan⁻¹', insert: 'atan(', kind: 'sci', aria: 'inverse tangent' },
  { id: 'pi', label: 'π', insert: 'π', kind: 'sci', aria: 'pi' },
  { id: 'ln', label: 'ln', insert: 'ln(', kind: 'sci', aria: 'natural log' },
  { id: 'log', label: 'log', insert: 'log(', kind: 'sci', aria: 'log base 10' },
  { id: 'pow', label: 'xʸ', insert: '^', kind: 'sci', aria: 'power', postfix: true },
  { id: 'e', label: 'e', insert: 'e', kind: 'sci', aria: "Euler's number" },
  { id: 'fact', label: 'x!', insert: '!', kind: 'sci', aria: 'factorial', postfix: true },
  { id: 'recip', label: '1/x', insert: '^(−1)', kind: 'sci', aria: 'reciprocal', postfix: true },
  { id: 'ee', label: 'EE', insert: '×10^(', kind: 'sci', aria: 'times ten to the', postfix: true },
  { id: 'ans', label: 'Ans', act: 'ans', kind: 'sci', aria: 'last answer' },
];

const KEYS: Key[] = [
  { id: 'sqrt', label: '√', insert: '√(', kind: 'fn', aria: 'square root' },
  { id: 'sq', label: 'x²', insert: '^2', kind: 'fn', aria: 'squared' },
  { id: 'pct', label: '%', insert: '%', kind: 'fn', aria: 'percent' },
  { id: 'exact', label: 'a/b', act: 'exact', kind: 'fn', aria: 'toggle exact fraction' },
  { id: 'clear', label: 'AC', act: 'clear', kind: 'fn', aria: 'all clear' },
  { id: 'lparen', label: '(', insert: '(', kind: 'fn' },
  { id: 'rparen', label: ')', insert: ')', kind: 'fn' },
  { id: 'div', label: '÷', insert: '÷', kind: 'op', aria: 'divide' },
  { id: '7', label: '7', insert: '7', kind: 'num' },
  { id: '8', label: '8', insert: '8', kind: 'num' },
  { id: '9', label: '9', insert: '9', kind: 'num' },
  { id: 'mul', label: '×', insert: '×', kind: 'op', aria: 'times' },
  { id: '4', label: '4', insert: '4', kind: 'num' },
  { id: '5', label: '5', insert: '5', kind: 'num' },
  { id: '6', label: '6', insert: '6', kind: 'num' },
  { id: 'sub', label: '−', insert: '−', kind: 'op', aria: 'minus' },
  { id: '1', label: '1', insert: '1', kind: 'num' },
  { id: '2', label: '2', insert: '2', kind: 'num' },
  { id: '3', label: '3', insert: '3', kind: 'num' },
  { id: 'add', label: '+', insert: '+', kind: 'op', aria: 'plus' },
  { id: 'neg', label: '±', act: 'neg', kind: 'fn', aria: 'change sign' },
  { id: '0', label: '0', insert: '0', kind: 'num' },
  { id: '.', label: '.', insert: '.', kind: 'num', aria: 'decimal point' },
  { id: 'eq', label: '=', act: 'eval', kind: 'eq', aria: 'equals' },
];

/** Tries exact rational arithmetic first; falls back to floating point. */
function compute(expr: string, angle: AngleMode = 'deg'): { value: string; exact: string | null } | { error: string } {
  try {
    const node = parseExpression(expr);
    const v = evaluate(node, 0, angle);
    let exact: string | null = null;
    const lin = parseLinearExpression(expr.replace(/%/g, '/100'));
    if (lin.ok && lin.value.x.isZero() && lin.value.y.isZero() && !lin.value.c.isInteger()) exact = fmtR(lin.value.c);
    return { value: formatNumber(v), exact };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export function CalculatorTool({ winId }: { winId: string }) {
  const [data, update] = useWindowData<CalcData>(winId);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // New key directions come with a cleared screen; drop any old error message too.
  const guideAt = (data.guide as { at?: number } | null | undefined)?.at;
  useEffect(() => setError(null), [guideAt]);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useUI((s) => s.toast);
  const expr = data.expr ?? '';
  const tape = data.tape ?? [];
  const scientific = data.model === 'scientific';
  const model = (data.model ?? 'basic') as CalcModel;
  const angle: AngleMode = data.angle ?? 'deg';
  const win = useWorkspace((s) => s.windows[winId]);
  const setRect = useWorkspace((s) => s.setRect);

  const chooseModel = (id: CalcModel) => {
    update({ model: id });
    // Bigger keypads need more room; never shrink what the student sized.
    const size = MODEL_SIZE[id];
    if (win) setRect(winId, { w: Math.max(win.w, size.w), h: Math.max(win.h, Math.min(size.h, window.innerHeight - 40)) });
    setPicking(false);
  };
  const deviceAngle = model === 'graphing' ? (data.g?.angle ?? 'rad') : model === 'exam' ? (data.e?.angle ?? 'deg') : angle;
  const guide = useCalcGuide(winId, model, deviceAngle, chooseModel, model === 'scientific' ? () => update({ angle: 'deg' }) : undefined);

  const preview = useMemo(() => {
    if (!expr.trim() || data.fresh) return null;
    const r = compute(expr, angle);
    return 'error' in r ? null : r;
  }, [expr, data.fresh, angle]);

  const lastExact = useMemo(() => (data.fresh && tape[0] ? compute(tape[0].expr, angle) : null), [data.fresh, tape, angle]);

  const setExpr = (next: string, fresh = false) => {
    update({ expr: next, fresh });
    setError(null);
  };

  const press = (k: Key) => {
    guide.track(k.id);
    if (k.act === 'clear') return setExpr('');
    if (k.act === 'back') return setExpr(expr.slice(0, -1));
    if (k.act === 'eval') return evalNow();
    if (k.act === 'exact') return update({ exact: !data.exact });
    if (k.act === 'angle') return update({ angle: angle === 'deg' ? 'rad' : 'deg' });
    if (k.act === 'ans') {
      const last = tape[0]?.result;
      if (!last) return;
      const ans = last.includes('e') ? `(${last})` : last;
      return setExpr(data.fresh ? ans : expr + ans);
    }
    if (k.act === 'neg') {
      const t = expr.trim();
      if (!t) return setExpr('−');
      if (/^[−-]?\d*\.?\d+$/.test(t)) return setExpr(/^[−-]/.test(t) ? t.slice(1) : `−${t}`);
      if (/^[−-]\(.*\)$/.test(t)) return setExpr(t.slice(2, -1));
      return setExpr(`−(${t})`);
    }
    const ins = k.insert!;
    // After "=", digits start fresh; operators continue from the answer.
    if (data.fresh) return setExpr(k.kind === 'op' || k.postfix || ins === '^2' || ins === '%' ? expr + ins : ins);
    setExpr(expr + ins);
  };

  const evalNow = () => {
    if (!expr.trim()) return;
    const r = compute(expr, angle);
    if ('error' in r) {
      setError(r.error);
      return;
    }
    if (r.value === 'Not a number' || r.value.includes('∞')) {
      setError(r.value === 'Not a number' ? "That one doesn't have a real answer." : "Dividing by zero: the one thing calculators can't do.");
      return;
    }
    update({
      expr: r.value,
      fresh: true,
      tape: [{ id: uid('t'), expr, result: r.value }, ...tape].slice(0, 30),
    });
    setError(null);
  };

  const shownResult = data.fresh && data.exact && lastExact && !('error' in lastExact) && lastExact.exact ? lastExact.exact : null;

  return (
    <div className="calc">
      <div className="calc-top">
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setPicking(!picking)} aria-expanded={picking}>
          {CALCULATOR_MODELS.find((m) => m.id === (data.model ?? 'basic'))?.name ?? 'Basic'} <ChevronDown size={13} />
        </button>
        <span className="muted small">
          {model === 'graphing' ? 'Practice model' : model === 'exam' ? 'Two-line, test style' : (
            <>
              {scientific && <strong className="calc-angle">{angle.toUpperCase()} · </strong>}
              {data.exact ? 'exact' : 'decimal'}
            </>
          )}
        </span>
      </div>

      {picking ? (
        <div className="calc-picker">
          <InventoryGrid
            items={CALCULATOR_MODELS}
            variant="cards"
            label="Calculator models"
            selectedId={data.model ?? 'basic'}
            autoFocus
            onActivate={(m) => {
              if (m.status === 'planned') {
                toast(`The ${m.name} model is planned, not built yet.`);
                return;
              }
              chooseModel(m.id as CalcModel);
            }}
          />
        </div>
      ) : model === 'graphing' ? (
        <GraphingCalc winId={winId} guide={guide} />
      ) : model === 'exam' ? (
        <ExamCalc winId={winId} guide={guide} />
      ) : (
        <>
          <ol className="calc-tape" aria-label="Calculation history">
            {tape
              .slice(0, 12)
              .reverse()
              .map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setExpr(data.fresh || !expr ? t.result : expr + t.result)} title="Reuse this result">
                    <span className="calc-tape-expr">{t.expr}</span>
                    <span className="calc-tape-res">= {t.result}</span>
                  </button>
                </li>
              ))}
          </ol>
          <div className={`calc-display ${error ? 'has-error' : ''}`}>
            <input
              ref={inputRef}
              className="calc-input"
              style={{ fontSize: expr.length > 16 ? 16 : expr.length > 11 ? 20 : undefined }}
              value={expr}
              placeholder="0"
              onChange={(e) => setExpr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === '=') {
                  e.preventDefault();
                  evalNow();
                } else if (e.key === 'Escape' && expr) {
                  e.preventDefault();
                  e.stopPropagation();
                  setExpr('');
                } else if (data.fresh && e.key.length === 1 && /[0-9.(]/.test(e.key)) {
                  e.preventDefault();
                  setExpr(e.key === '.' ? '0.' : e.key);
                } else if (data.fresh) {
                  update({ fresh: false });
                }
              }}
              aria-label="Calculator expression"
              autoComplete="off"
              spellCheck={false}
              inputMode="none"
            />
            <button type="button" className="calc-back" onClick={() => press({ id: 'back', label: '⌫', act: 'back' })} aria-label="Backspace">
              <Delete size={15} />
            </button>
            <div className="calc-preview" aria-live="polite">
              {error ? (
                <span className="calc-error">{error}</span>
              ) : shownResult ? (
                <span className="calc-exact">
                  exactly <MathView m={shownResult} />
                </span>
              ) : preview?.exact && data.exact ? (
                <span className="calc-exact">
                  = <MathView m={preview.exact} />
                </span>
              ) : preview ? (
                `= ${preview.value}`
              ) : (
                '\u00a0'
              )}
            </div>
          </div>
          {guide.bar}
          {scientific && (
            <div className="calc-keys calc-sci" onMouseDown={(e) => (e.target as HTMLElement).closest('button') && e.preventDefault()}>
              {SCI_KEYS.map((k) => (
                <button key={k.label} type="button" className={`calc-key key-sci ${k.act === 'angle' ? 'is-angle' : ''} ${guide.target === k.id ? 'is-guide' : ''}`} onClick={() => press(k)} aria-label={k.aria ?? k.label}>
                  {k.act === 'angle' ? angle.toUpperCase() : k.label}
                </button>
              ))}
            </div>
          )}
          <div className="calc-keys" onMouseDown={(e) => (e.target as HTMLElement).closest('button') && e.preventDefault()}>
            {KEYS.map((k) => (
              <button
                key={k.label}
                type="button"
                className={`calc-key key-${k.kind} ${guide.target === k.id ? 'is-guide' : ''}`}
                onClick={() => press(k)}
                aria-label={k.aria ?? k.label}
                aria-pressed={k.act === 'exact' ? !!data.exact : undefined}
              >
                {k.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
