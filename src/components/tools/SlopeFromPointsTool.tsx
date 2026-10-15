import { ProblemShell } from './problem/ProblemShell';
import type { Inputs, SolvedView } from './problem/types';
import { parsePointsInput, solveSlopeFromPoints } from '../../math/slopeFromPoints';
import { buildSlopeLesson } from '../../math/lessons';
import { toPlain } from '../../math/markup';
import { Rational } from '../../math/rational';
import { extractPoints } from '../../math/detect';
import { guideSlope } from '../../math/teaching';

const KEYS = ['x1', 'y1', 'x2', 'y2'] as const;

function solve(inputs: Inputs): SolvedView {
  const parsed = parsePointsInput({ x1: inputs.x1 ?? '', y1: inputs.y1 ?? '', x2: inputs.x2 ?? '', y2: inputs.y2 ?? '' });
  if (!parsed.ok) return { ok: false, error: parsed.error, field: parsed.field };
  const p = parsed.value;
  const r = solveSlopeFromPoints(p);
  if (r.kind === 'error') return { ok: false, error: r.message };
  const label = `(${p.x1}, ${p.y1}) and (${p.x2}, ${p.y2})`.replace(/-/g, '−');
  const points: [number, number][] = [
    [p.x1.toNumber(), p.y1.toNumber()],
    [p.x2.toNumber(), p.y2.toNumber()],
  ];
  const base = {
    ok: true as const,
    steps: r.steps,
    workHeader: `Slope of the line through ${label}`,
    label,
    decisions: (accepted: Record<string, string | undefined>) => buildSlopeLesson(p, r, accepted),
    graph: { text: toPlain(r.line), points },
    guide: guideSlope(p, r),
  };
  if (r.kind === 'vertical') {
    return {
      ...base,
      answer: 'm is undefined',
      answerPlain: r.answerPlain,
      caption: `Vertical line ${toPlain(r.line).replace(/-/g, '−')}. The run is 0, and you can't divide by zero.`,
    };
  }
  const decimal = r.m.toDecimalString(4)?.replace('-', '−');
  return {
    ...base,
    answer: r.answer,
    answerPlain: r.answerPlain,
    caption: [
      r.horizontal ? 'Horizontal line (zero rise).' : `Rise ${fmt(r.rise)} over run ${fmt(r.run)}${decimal ? `, about ${decimal.replace('≈ ', '')}` : ''}.`,
      `Line: ${toPlain(r.line).replace(/-/g, '−')}`,
    ].join(' '),
  };
}

const fmt = (r: Rational) => r.toString().replace('-', '−');

const EXAMPLES: Inputs[] = [
  { x1: '2', y1: '3', x2: '4', y2: '7' },
  { x1: '−1', y1: '4', x2: '3', y2: '−2' },
  { x1: '0', y1: '5', x2: '6', y2: '5' },
  { x1: '3', y1: '1', x2: '3', y2: '8' },
  { x1: '1/2', y1: '2', x2: '4', y2: '−5' },
];

export function SlopeFromPointsTool({ winId }: { winId: string }) {
  return (
    <ProblemShell
      winId={winId}
      type="slopeFromPoints"
      solve={solve}
      emptyInputs={{ x1: '', y1: '', x2: '', y2: '' }}
      examples={EXAMPLES}
      recognition="points"
      fromRecognized={extractPoints}
      renderInputs={({ inputs, setInput, setInputs, invalidField, firstRef }) => (
        <div className="points-grid">
          {[1, 2].map((n) => (
            <fieldset key={n} className="point-field">
              <legend className="field-label">Point {n}</legend>
              <div className="point-row">
                <span className="paren" aria-hidden="true">(</span>
                {(['x', 'y'] as const).map((axis, i) => {
                  const key = `${axis}${n}` as (typeof KEYS)[number];
                  return (
                    <span key={key} className="coord">
                      <input
                        ref={key === 'x1' ? firstRef : undefined}
                        className={`field field-math ${invalidField === key ? 'is-invalid' : ''}`}
                        value={inputs[key] ?? ''}
                        onChange={(e) => setInput(key, e.target.value)}
                        onPaste={(e) => {
                          // Pasting "(2, 3) (4, 7)" fills all four boxes at once.
                          const pts = extractPoints(e.clipboardData.getData('text'));
                          if (pts) {
                            e.preventDefault();
                            setInputs(pts);
                          }
                        }}
                        onKeyDown={(e) => {
                          // Typing a comma hops to the next box, like writing a coordinate.
                          if (e.key === ',') {
                            e.preventDefault();
                            const next = e.currentTarget.closest('.points-grid')?.querySelectorAll('input')[KEYS.indexOf(key) + 1] as HTMLInputElement | undefined;
                            next?.focus();
                          }
                        }}
                        placeholder={`${axis}${n === 1 ? '₁' : '₂'}`}
                        aria-label={`${axis}${n === 1 ? '₁' : '₂'}`}
                        aria-invalid={invalidField === key}
                        autoComplete="off"
                      />
                      {i === 0 && <span className="comma" aria-hidden="true">,</span>}
                    </span>
                  );
                })}
                <span className="paren" aria-hidden="true">)</span>
              </div>
            </fieldset>
          ))}
        </div>
      )}
    />
  );
}
