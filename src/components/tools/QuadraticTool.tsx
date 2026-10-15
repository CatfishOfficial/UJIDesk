import { useMemo } from 'react';
import { ProblemShell } from './problem/ProblemShell';
import type { Inputs, SolvedView } from './problem/types';
import { ExprField } from './problem/fields';
import { buildQuadLesson, quadGraphText, readQuadratic, solveQuadratic } from '../../math/quadratic';
import { fmtR } from '../../math/markup';
import { degree, fmtPoly, polyPlain } from '../../math/poly';
import { round } from '../../math/surd';
import { detectProblem } from '../../math/detect';
import { guideQuadratic } from '../../math/teaching';

function solve(inputs: Inputs): SolvedView {
  const q = readQuadratic(inputs.eq ?? '');
  if (!q.ok) return { ok: false, error: q.error, field: 'eq' };
  const r = solveQuadratic(q.value);
  if (r.kind === 'error') return { ok: false, error: r.message, field: 'eq' };
  const label = `${(inputs.eq ?? '').trim().replace(/\s+/g, ' ')}${q.value.alreadyZero && !/=/.test(inputs.eq) ? ' = 0' : ''}`;
  const real = r.decimals;
  const points: [number, number][] = [...real.map((x) => [x, 0] as [number, number]), [r.vertex.h.toNumber(), r.vertex.k.toNumber()]];
  const caption =
    r.D < 0n
      ? 'The discriminant is negative, so the parabola never crosses the x-axis.'
      : r.D === 0n
        ? 'A double root: the parabola just touches the x-axis at its vertex.'
        : r.roots.type === 'rational'
          ? 'Two rational roots, so this one also factors.'
          : `About ${real.map((x) => round(x, 3)).join(' and ')}.`;
  return {
    ok: true,
    answer: r.answer,
    answerPlain: r.answerPlain,
    caption,
    steps: r.steps,
    workHeader: `Solve ${label} with the quadratic formula`,
    label,
    decisions: () => buildQuadLesson(r),
    guide: guideQuadratic(`${polyPlain(q.value.poly, q.value.variable)} = 0`, r),
    details: [
      { label: 'Discriminant', value: `b^2 - 4ac = ${r.D}` },
      { label: 'Vertex', value: `(${fmtR(r.vertex.h)}, ${fmtR(r.vertex.k)})` },
      { label: 'Axis of symmetry', value: `x = ${fmtR(r.vertex.h)}` },
    ],
    graph: { text: quadGraphText(q.value.poly), points },
  };
}

const EXAMPLES: Inputs[] = [{ eq: 'x² − 5x + 6 = 0' }, { eq: '2x² + 3x − 4 = 0' }, { eq: 'x² − 2x − 1 = 0' }, { eq: 'x² = 3x + 10' }, { eq: 'x² + 2x + 5 = 0' }];

function fromRecognized(text: string): Inputs | null {
  const d = detectProblem(text);
  if (d?.type === 'quadratic') return d.inputs;
  if (d?.type === 'factoring') return { eq: `${d.inputs.expr} = 0` };
  return readQuadratic(text).ok ? { eq: text } : null;
}

export function QuadraticTool({ winId }: { winId: string }) {
  return (
    <ProblemShell
      winId={winId}
      type="quadratic"
      solve={solve}
      emptyInputs={{ eq: '' }}
      examples={EXAMPLES}
      recognition="quadratic"
      fromRecognized={fromRecognized}
      renderInputs={({ inputs, setInput, invalidField, firstRef }) => <QuadField value={inputs.eq ?? ''} onChange={(v) => setInput('eq', v)} invalid={invalidField === 'eq'} inputRef={firstRef} />}
    />
  );
}

function QuadField({ value, onChange, invalid, inputRef }: { value: string; onChange: (v: string) => void; invalid: boolean; inputRef: React.RefObject<HTMLInputElement> }) {
  const preview = useMemo(() => {
    if (!value.trim()) return null;
    const q = readQuadratic(value);
    if (!q.ok || degree(q.value.poly) < 1) return null;
    return `${fmtPoly(q.value.poly, q.value.variable)} = 0`;
  }, [value]);
  return (
    <ExprField
      label="Equation"
      value={value}
      onChange={onChange}
      placeholder="x² − 5x + 6 = 0"
      invalid={invalid}
      inputRef={inputRef}
      preview={preview}
      hint="Type x^2 or x². Either side can have terms; a = 1, b = −5, c = 6 works too."
    />
  );
}
