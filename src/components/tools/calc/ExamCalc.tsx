import type { KeyboardEvent, ReactNode } from 'react';
import { useWindowData } from '../../../state/store';
import { MathView } from '../../ui/MathView';
import { answerText, entryMarkup, initialE, pressE, type EState } from './examEngine';

interface EKey {
  id: string;
  label: string;
  second?: string;
  kind?: 'fn' | 'num' | 'op' | 'second' | 'enter' | 'clear';
}
const N = (d: string): EKey => ({ id: d, label: d, kind: 'num' });

const KEYS: EKey[][] = [
  [{ id: '2nd', label: '2nd', kind: 'second' }, { id: 'mode', label: 'mode' }, { id: 'del', label: 'delete' }, { id: 'clear', label: 'clear', kind: 'clear' }, { id: 'pow', label: '^', kind: 'op' }],
  [{ id: 'frac', label: 'n/d' }, { id: 'fd', label: 'f◂▸d' }, { id: 'recip', label: 'x⁻¹' }, { id: 'lparen', label: '(' }, { id: 'rparen', label: ')' }],
  [
    { id: 'pi', label: 'π', second: 'e' },
    { id: 'sin', label: 'sin', second: 'sin⁻¹' },
    { id: 'cos', label: 'cos', second: 'cos⁻¹' },
    { id: 'tan', label: 'tan', second: 'tan⁻¹' },
    { id: 'div', label: '÷', kind: 'op' },
  ],
  [{ id: 'sq', label: 'x²', second: '√' }, N('7'), N('8'), N('9'), { id: 'mul', label: '×', kind: 'op' }],
  [{ id: 'log', label: 'log', second: '10ˣ' }, N('4'), N('5'), N('6'), { id: 'sub', label: '−', kind: 'op' }],
  [{ id: 'ln', label: 'ln', second: 'eˣ' }, N('1'), N('2'), N('3'), { id: 'add', label: '+', kind: 'op' }],
  [{ id: 'ans', label: 'ans' }, N('0'), { id: '.', label: '.', kind: 'num' }, { id: 'neg', label: '(−)', second: 'ans', kind: 'num' }, { id: 'enter', label: 'enter', second: 'entry', kind: 'enter' }],
];

const KEYBOARD: Record<string, string> = { Enter: 'enter', '=': 'enter', Backspace: 'del', Escape: 'clear', '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '^': 'pow', '(': 'lparen', ')': 'rparen', '.': '.' };

export function ExamCalc({ winId, guide }: { winId: string; guide: { target: string | null; track: (id: string) => void; bar: ReactNode } }) {
  const [data, update] = useWindowData<{ e?: EState }>(winId);
  const s = data.e ?? initialE();
  const press = (id: string) => {
    guide.track(id);
    update((d) => ({ e: pressE(d.e ?? initialE(), id) }));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const id = /^\d$/.test(e.key) ? e.key : KEYBOARD[e.key];
    if (!id) return;
    e.preventDefault();
    press(id);
  };
  const top = s.shown && !s.entry.length ? s.shown.in : s.entry;
  const ans = answerText(s);
  const showAnswer = !!s.shown && !s.entry.length;
  return (
    <div className="ecalc" tabIndex={0} onKeyDown={onKeyDown} aria-label="Exam calculator. Type with your keyboard or press the keys.">
      <div className="ecalc-lcd" aria-live="polite">
        <div className="ecalc-flags">
          <span>{s.angle.toUpperCase()}</span>
          {s.second && <span className="is-on">2nd</span>}
          {showAnswer && s.shown?.exact && <span>{s.asDec ? 'DEC' : 'FRAC'}</span>}
        </div>
        {s.err ? (
          <div className="ecalc-err">
            <strong>{s.err === 'SYNTAX' ? 'SYNTAX ERROR' : `${s.err} ERROR`}</strong>
            <span>{s.err === 'SYNTAX' ? 'Check for a − where a (−) belongs.' : 'Press clear.'}</span>
          </div>
        ) : (
          <>
            <div className="ecalc-entry">
              {top.length ? <MathView m={entryMarkup(top)} /> : <span className="ecalc-empty" />}
              {!showAnswer && <span className="ecalc-cursor" aria-hidden="true" />}
            </div>
            <div className="ecalc-answer">{showAnswer && (ans.markup ? <MathView m={ans.markup} size="lg" /> : <span>{ans.plain}</span>)}</div>
          </>
        )}
      </div>
      {guide.bar}
      <div className="ecalc-keys" onMouseDown={(e) => (e.target as HTMLElement).closest('button') && e.preventDefault()}>
        {KEYS.flat().map((k) => (
          <button
            key={k.id}
            type="button"
            className={`ekey ekey-${k.kind ?? 'fn'} ${guide.target === k.id ? 'is-guide' : ''} ${k.id === '2nd' && s.second ? 'is-on' : ''}`}
            onClick={() => press(k.id)}
            aria-label={k.second ? `${k.label} (2nd: ${k.second})` : k.label}
          >
            {k.second && <span className="ekey-2nd">{k.second}</span>}
            <span className="ekey-cap">{k.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
