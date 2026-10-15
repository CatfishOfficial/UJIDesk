import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useWindowData } from '../../../state/store';
import { GH, GW, initialG, plotG, pressG, screenRows, traceText, type Cell, type GState } from './graphingEngine';

interface GKey {
  id: string;
  label: string;
  second?: string;
  kind?: 'top' | 'fn' | 'num' | 'op' | 'second' | 'alpha' | 'enter';
}

const N = (d: string): GKey => ({ id: d, label: d, kind: 'num' });

/** Ten rows, like the real layout: function keys on top, arrows at the right. */
const ROWS: (GKey | 'arrows' | null)[][] = [
  [
    { id: 'yeq', label: 'Y=', second: 'STAT PLOT', kind: 'top' },
    { id: 'window', label: 'WINDOW', second: 'TBLSET', kind: 'top' },
    { id: 'zoom', label: 'ZOOM', second: 'FORMAT', kind: 'top' },
    { id: 'trace', label: 'TRACE', second: 'CALC', kind: 'top' },
    { id: 'graph', label: 'GRAPH', second: 'TABLE', kind: 'top' },
  ],
  [{ id: '2nd', label: '2nd', kind: 'second' }, { id: 'mode', label: 'MODE', second: 'QUIT' }, { id: 'del', label: 'DEL', second: 'INS' }, 'arrows', null],
  [{ id: 'alpha', label: 'ALPHA', kind: 'alpha' }, { id: 'xt', label: 'X,T,θ,n' }, { id: 'stat', label: 'STAT' }, null, null],
  [
    { id: 'math', label: 'MATH' },
    { id: 'apps', label: 'APPS' },
    { id: 'prgm', label: 'PRGM' },
    { id: 'vars', label: 'VARS' },
    { id: 'clear', label: 'CLEAR' },
  ],
  [
    { id: 'recip', label: 'x⁻¹' },
    { id: 'sin', label: 'SIN', second: 'SIN⁻¹' },
    { id: 'cos', label: 'COS', second: 'COS⁻¹' },
    { id: 'tan', label: 'TAN', second: 'TAN⁻¹' },
    { id: 'pow', label: '^', second: 'π', kind: 'op' },
  ],
  [
    { id: 'sq', label: 'x²', second: '√' },
    { id: 'comma', label: ',', second: 'EE' },
    { id: 'lparen', label: '(' },
    { id: 'rparen', label: ')' },
    { id: 'div', label: '÷', second: 'e', kind: 'op' },
  ],
  [{ id: 'log', label: 'LOG', second: '10ˣ' }, N('7'), N('8'), N('9'), { id: 'mul', label: '×', kind: 'op' }],
  [{ id: 'ln', label: 'LN', second: 'eˣ' }, N('4'), N('5'), N('6'), { id: 'sub', label: '−', kind: 'op' }],
  [{ id: 'sto', label: 'STO→' }, N('1'), N('2'), N('3'), { id: 'add', label: '+', kind: 'op' }],
  [{ id: 'on', label: 'ON' }, N('0'), { id: '.', label: '.', kind: 'num' }, { id: 'neg', label: '(−)', second: 'ANS', kind: 'num' }, { id: 'enter', label: 'ENTER', second: 'ENTRY', kind: 'enter' }],
];

const KEYBOARD: Record<string, string> = {
  Enter: 'enter',
  Backspace: 'del',
  Delete: 'del',
  Escape: 'clear',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  '+': 'add',
  '-': 'sub',
  '*': 'mul',
  '/': 'div',
  '^': 'pow',
  '(': 'lparen',
  ')': 'rparen',
  '.': '.',
  ',': 'comma',
  x: 'xt',
  X: 'xt',
};

export function GraphingCalc({ winId, guide }: { winId: string; guide: { target: string | null; track: (id: string) => void; bar: ReactNode } }) {
  const [data, update] = useWindowData<{ g?: GState }>(winId);
  const s = data.g ?? initialG();
  const press = (id: string) => {
    guide.track(id);
    update((d) => ({ g: pressG(d.g ?? initialG(), id) }));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const id = /^\d$/.test(e.key) ? e.key : KEYBOARD[e.key];
    if (!id) return;
    e.preventDefault();
    press(id);
  };

  const graphing = s.screen === 'graph' || s.screen === 'trace';
  return (
    <div className="gcalc" tabIndex={0} onKeyDown={onKeyDown} aria-label="Graphing calculator. Type with your keyboard or press the keys.">
      <div className="gcalc-bezel">
        <div className={`gcalc-lcd ${graphing ? 'is-graph' : ''}`} aria-live="polite">
          {graphing ? <GraphScreen s={s} /> : <TextScreen rows={screenRows(s)} />}
          {s.second && <span className="gcalc-2nd-flag">2nd</span>}
        </div>
      </div>
      <p className="gcalc-note" aria-live="polite">
        {s.note ?? ' '}
      </p>
      {guide.bar}
      <div className="gcalc-keys" onMouseDown={(e) => (e.target as HTMLElement).closest('button') && e.preventDefault()}>
        {ROWS.map((row, ri) =>
          row.map((k, ci) => {
            if (k === null) return null;
            if (k === 'arrows')
              return (
                <div key="arrows" className="gcalc-arrows" style={{ gridRow: `${ri + 1} / span 2`, gridColumn: '4 / span 2' }}>
                  {(['up', 'left', 'right', 'down'] as const).map((d) => (
                    <button key={d} type="button" className={`gkey gkey-arrow is-${d} ${guide.target === d ? 'is-guide' : ''}`} onClick={() => press(d)} aria-label={d}>
                      {{ up: '▲', left: '◀', right: '▶', down: '▼' }[d]}
                    </button>
                  ))}
                </div>
              );
            return (
              <button
                key={k.id}
                type="button"
                className={`gkey gkey-${k.kind ?? 'fn'} ${guide.target === k.id ? 'is-guide' : ''} ${k.id === '2nd' && s.second ? 'is-on' : ''}`}
                style={{ gridRow: ri + 1, gridColumn: ci + 1 }}
                onClick={() => press(k.id)}
                aria-label={k.second ? `${k.label} (2nd: ${k.second})` : k.label}
              >
                {k.second && <span className="gkey-2nd">{k.second}</span>}
                <span className="gkey-cap">{k.label}</span>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function TextScreen({ rows }: { rows: Cell[][] }) {
  return (
    <div className="gcalc-text">
      {rows.map((r, ri) => (
        <div key={ri} className="gcalc-row">
          {r.map((c, ci) => (
            <span key={ci} className={`gcell ${c.inv ? 'is-inv' : ''} ${c.blink ? 'is-blink' : ''} ${c.dim ? 'is-dim' : ''}`}>
              {c.ch === ' ' ? ' ' : c.ch}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function GraphScreen({ s }: { s: GState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { px, cursor } = plotG(s);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const ink = getComputedStyle(ref.current!).getPropertyValue('--lcd-ink').trim() || '#1f2a1c';
    ctx.clearRect(0, 0, GW, GH);
    ctx.fillStyle = ink;
    for (let i = 0; i < px.length; i++) if (px[i]) ctx.fillRect(i % GW, Math.floor(i / GW), 1, 1);
  });
  const t = s.screen === 'trace' ? traceText(s) : null;
  return (
    <div className="gcalc-graph">
      <canvas ref={ref} width={GW} height={GH} aria-label="Graph" />
      {cursor && cursor.y >= 0 && cursor.y < GH && (
        <span className="gcalc-cursor" style={{ left: `${((cursor.x + 0.5) / GW) * 100}%`, top: `${((cursor.y + 0.5) / GH) * 100}%` }} aria-hidden="true" />
      )}
      {t && (
        <>
          <div className="gcalc-overlay is-top">{t.top}</div>
          <div className="gcalc-overlay is-bottom">{t.bottom}</div>
        </>
      )}
    </div>
  );
}
