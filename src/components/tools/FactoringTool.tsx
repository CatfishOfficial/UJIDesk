import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { ProblemShell } from './problem/ProblemShell';
import type { Inputs, SolvedView } from './problem/types';
import { ExprField } from './problem/fields';
import { buildFactorLesson, solveFactoring } from '../../math/factoring';
import { fmtR } from '../../math/markup';
import { degree, fmtPoly, parsePoly, polyPlain } from '../../math/poly';
import { quadGraphText } from '../../math/quadratic';
import { detectProblem } from '../../math/detect';
import { useWorkspace } from '../../state/store';
import { guideFactoring } from '../../math/teaching';

function solve(inputs: Inputs): SolvedView {
  const src = (inputs.expr ?? '').trim();
  if (!src) return { ok: false, error: 'Type an expression to factor, like x² + 5x + 6.', field: 'expr' };
  const r = solveFactoring(src);
  if (r.kind === 'error') return { ok: false, error: r.message, field: 'expr' };
  const label = src.replace(/\s+/g, ' ');
  const caption =
    r.kind === 'prime'
      ? 'Prime over the integers: no two whole numbers fit, so it stays as it is. The quadratic formula can still find its roots.'
      : r.kind === 'gcfOnly'
        ? r.prim.length === 3
          ? 'The common factor comes out, but what’s left doesn’t factor over the integers.'
          : 'Taking out the common factor is all there is.'
        : r.pattern === 'square'
          ? 'A perfect square trinomial.'
          : r.pattern === 'diffSquares'
            ? 'A difference of two squares.'
            : undefined;
  const roots = r.roots ?? [];
  return {
    ok: true,
    answer: r.answer,
    answerPlain: r.answerPlain,
    caption,
    steps: r.steps,
    workHeader: `Factor ${label}`,
    label,
    decisions: () => buildFactorLesson(r),
    guide: guideFactoring(`${polyPlain(r.poly, r.v)}${r.isEquation ? ' = 0' : ''}`, r),
    details: roots.length ? [{ label: 'Solutions', value: roots.map((x) => `${r.v} = ${fmtR(x)}`).join(',  ') }] : undefined,
    graph: degree(r.poly) <= 3 && r.v === 'x' ? { text: quadGraphText(r.poly), points: r.factors.map((f) => [-Number(f.n) / Number(f.m), 0] as [number, number]) } : undefined,
  };
}

const EXAMPLES: Inputs[] = [{ expr: 'x² + 5x + 6' }, { expr: '2x² + 7x + 3' }, { expr: '6x² − x − 2' }, { expr: 'x² − 49' }, { expr: '3x² + 12x + 12' }];

function fromRecognized(text: string): Inputs | null {
  const d = detectProblem(text);
  if (d?.type === 'factoring') return d.inputs;
  if (d?.type === 'quadratic') return { expr: d.inputs.eq };
  return parsePoly(text).ok ? { expr: text } : null;
}

export function FactoringTool({ winId }: { winId: string }) {
  return (
    <ProblemShell
      winId={winId}
      type="factoring"
      solve={solve}
      emptyInputs={{ expr: '' }}
      examples={EXAMPLES}
      recognition="factoring"
      fromRecognized={fromRecognized}
      renderInputs={({ inputs, setInput, invalidField, firstRef }) => <FactorField winId={winId} value={inputs.expr ?? ''} onChange={(v) => setInput('expr', v)} invalid={invalidField === 'expr'} inputRef={firstRef} />}
    />
  );
}

function FactorField({ winId, value, onChange, invalid, inputRef }: { winId: string; value: string; onChange: (v: string) => void; invalid: boolean; inputRef: React.RefObject<HTMLInputElement> }) {
  const openWindow = useWorkspace((s) => s.openWindow);
  const parsed = useMemo(() => (value.trim() ? solveFactoring(value) : null), [value]);
  const preview = useMemo(() => {
    const p = value.trim() ? parsePoly(value.replace(/\bfactor\b/gi, '')) : null;
    return p?.ok && degree(p.value.poly) >= 1 ? fmtPoly(p.value.poly, p.value.variable) + (p.value.isEquation ? ' = 0' : '') : null;
  }, [value]);
  return (
    <>
      <ExprField
        label="Expression"
        value={value}
        onChange={onChange}
        placeholder="x² + 5x + 6"
        invalid={invalid}
        inputRef={inputRef}
        preview={preview}
        hint="Type x^2 or x². Add “= 0” to also get the solutions."
      />
      {parsed?.kind === 'prime' && parsed.prim.length === 3 && (
        <button
          type="button"
          className="btn btn-quiet btn-sm tool-xlink"
          onClick={() => openWindow('quadratic', { near: winId, data: { inputs: { eq: `${value.replace(/=.*$/, '')} = 0` }, autoSolve: true } })}
        >
          Doesn’t factor? Try the quadratic formula <ArrowRight size={13} />
        </button>
      )}
    </>
  );
}
