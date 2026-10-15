import { ProblemShell } from './problem/ProblemShell';
import type { Inputs, SolvedView } from './problem/types';
import { ExprField, PointField, Seg } from './problem/fields';
import { buildPointSlopeLesson, solvePointSlope, type PointSlopeInput } from '../../math/pointSlope';
import { detectProblem, extractPoints } from '../../math/detect';
import { Rational } from '../../math/rational';
import { fmtR, toPlain } from '../../math/markup';
import { plainR } from '../../math/surd';
import { guidePointSlope } from '../../math/teaching';

const UNDEFINED = /^(undefined|undef|none|vertical|∞)$/i;

function read(inputs: Inputs): { ok: true; value: PointSlopeInput } | { ok: false; error: string; field: string } {
  const num = (k: string, name: string) => {
    const t = (inputs[k] ?? '').trim();
    if (!t) return { error: `${name} is empty.` };
    const r = Rational.parse(t);
    return r ? { r } : { error: `${name} should be a number, like 3, −2.5 or 1/2.` };
  };
  const x1 = num('x1', 'x₁');
  if ('error' in x1) return { ok: false, error: x1.error!, field: 'x1' };
  const y1 = num('y1', 'y₁');
  if ('error' in y1) return { ok: false, error: y1.error!, field: 'y1' };
  if (inputs.mode === 'points') {
    const x2 = num('x2', 'x₂');
    if ('error' in x2) return { ok: false, error: x2.error!, field: 'x2' };
    const y2 = num('y2', 'y₂');
    if ('error' in y2) return { ok: false, error: y2.error!, field: 'y2' };
    return { ok: true, value: { x1: x1.r!, y1: y1.r!, m: null, second: { x2: x2.r!, y2: y2.r! } } };
  }
  const mt = (inputs.m ?? '').trim().replace(/^m\s*=\s*/i, '');
  if (!mt) return { ok: false, error: 'What is the slope? A number like 2 or −3/4, or "undefined".', field: 'm' };
  if (UNDEFINED.test(mt)) return { ok: true, value: { x1: x1.r!, y1: y1.r!, m: null } };
  const m = Rational.parse(mt);
  if (!m) return { ok: false, error: 'The slope should be a number like 2 or −3/4 (or "undefined").', field: 'm' };
  return { ok: true, value: { x1: x1.r!, y1: y1.r!, m } };
}

function solve(inputs: Inputs): SolvedView {
  const p = read(inputs);
  if (!p.ok) return { ok: false, error: p.error, field: p.field };
  const input = p.value;
  const r = solvePointSlope(input);
  if (r.kind === 'error') return { ok: false, error: r.message };
  const pt = (x: Rational, y: Rational) => `(${plainR(x)}, ${plainR(y)})`;
  const label = input.second ? `${pt(input.x1, input.y1)} and ${pt(input.second.x2, input.second.y2)}` : `${pt(input.x1, input.y1)}, m = ${input.m ? plainR(input.m) : 'undefined'}`;
  const points: [number, number][] = [[input.x1.toNumber(), input.y1.toNumber()]];
  if (input.second) points.push([input.second.x2.toNumber(), input.second.y2.toNumber()]);
  const base = {
    ok: true as const,
    steps: r.steps,
    workHeader: `Point-slope form for ${label}`,
    label,
    decisions: () => buildPointSlopeLesson(input, r),
    guide: guidePointSlope(input, r),
  };
  if (r.kind === 'vertical') {
    return {
      ...base,
      answer: `x = ${fmtR(r.x)}`,
      answerPlain: `x = ${plainR(r.x)}`,
      caption: 'The slope is undefined, so the line is vertical and point-slope form doesn’t apply.',
      graph: { text: `x = ${r.x.toString()}`, points },
    };
  }
  return {
    ...base,
    answer: r.pointSlope,
    answerPlain: toPlain(r.pointSlope).replace(/-/g, '−'),
    details: [
      { label: 'Slope-intercept', value: r.slopeIntercept },
      { label: 'Standard form', value: r.standard },
    ],
    graph: { text: toPlain(r.slopeIntercept), points },
  };
}

const EXAMPLES: Inputs[] = [
  { mode: 'slope', x1: '2', y1: '3', m: '4', x2: '', y2: '' },
  { mode: 'slope', x1: '−1', y1: '−4', m: '−2/3', x2: '', y2: '' },
  { mode: 'slope', x1: '0', y1: '5', m: '1/2', x2: '', y2: '' },
  { mode: 'points', x1: '1', y1: '2', m: '', x2: '3', y2: '8' },
  { mode: 'points', x1: '−2', y1: '5', m: '', x2: '4', y2: '−1' },
];

function fromRecognized(text: string): Inputs | null {
  const d = detectProblem(text);
  if (d?.type === 'pointSlope') return d.inputs;
  const pts = extractPoints(text);
  return pts ? { mode: 'points', m: '', ...pts } : null;
}

export function PointSlopeTool({ winId }: { winId: string }) {
  return (
    <ProblemShell
      winId={winId}
      type="pointSlope"
      solve={solve}
      emptyInputs={{ mode: 'slope', x1: '', y1: '', m: '', x2: '', y2: '' }}
      examples={EXAMPLES}
      recognition="pointSlope"
      fromRecognized={fromRecognized}
      renderInputs={({ inputs, setInput, setInputs, invalidField, firstRef }) => {
        const mode = inputs.mode === 'points' ? 'points' : 'slope';
        const paste = (e: React.ClipboardEvent<HTMLInputElement>) => {
          const parsed = fromRecognized(e.clipboardData.getData('text'));
          if (parsed) {
            e.preventDefault();
            setInputs({ ...inputs, ...parsed });
          }
        };
        return (
          <div className="ps-inputs">
            <Seg
              label="What you know"
              value={mode}
              onChange={(v) => setInput('mode', v)}
              options={[
                { id: 'slope', label: 'A point and the slope' },
                { id: 'points', label: 'Two points' },
              ]}
            />
            <div className="points-grid">
              <PointField
                legend={mode === 'points' ? 'Point 1' : 'Point'}
                sub="₁"
                x={inputs.x1 ?? ''}
                y={inputs.y1 ?? ''}
                onX={(v) => setInput('x1', v)}
                onY={(v) => setInput('y1', v)}
                invalidX={invalidField === 'x1'}
                invalidY={invalidField === 'y1'}
                inputRef={firstRef}
                onPaste={paste}
              />
              {mode === 'points' ? (
                <PointField
                  legend="Point 2"
                  sub="₂"
                  x={inputs.x2 ?? ''}
                  y={inputs.y2 ?? ''}
                  onX={(v) => setInput('x2', v)}
                  onY={(v) => setInput('y2', v)}
                  invalidX={invalidField === 'x2'}
                  invalidY={invalidField === 'y2'}
                />
              ) : (
                <ExprField label="Slope m" size="md" value={inputs.m ?? ''} onChange={(v) => setInput('m', v)} placeholder="4, −2/3, or undefined" invalid={invalidField === 'm'} />
              )}
            </div>
          </div>
        );
      }}
    />
  );
}
