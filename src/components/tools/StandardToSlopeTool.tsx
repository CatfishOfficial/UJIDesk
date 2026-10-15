import { useId, useMemo } from 'react';
import { ProblemShell } from './problem/ProblemShell';
import type { Inputs, SolvedView } from './problem/types';
import { solveFromEquation } from '../../math/standardToSlope';
import { parseLinearEquation, toStandard } from '../../math/linear';
import { buildStandardLesson } from '../../math/lessons';
import { fmtR, fmtTerms, toPlain } from '../../math/markup';
import { MathView } from '../ui/MathView';
import { guideStandard } from '../../math/teaching';

function solve(inputs: Inputs): SolvedView {
  const parsed = parseLinearEquation(inputs.eq ?? '');
  if (!parsed.ok) return { ok: false, error: parsed.error, field: 'eq' };
  const r = solveFromEquation(parsed.value);
  if (r.kind === 'error') return { ok: false, error: r.message, field: 'eq' };
  const label = inputs.eq.trim().replace(/\s+/g, ' ');
  const base = {
    ok: true as const,
    steps: r.steps,
    workHeader: `Rewrite ${label} in slope-intercept form`,
    label,
    decisions: () => buildStandardLesson(parsed.value, r),
    guide: guideStandard(label.replace(/-/g, '−'), r),
  };
  if (r.kind === 'vertical') {
    return {
      ...base,
      answer: r.answer,
      answerPlain: r.answerPlain,
      caption: 'Vertical line: the slope is undefined, so there is no y = mx + b form.',
      graph: { text: toPlain(r.answer) },
    };
  }
  return {
    ...base,
    answer: r.answer,
    answerPlain: r.answerPlain,
    caption: `${r.horizontal ? 'Horizontal line. ' : ''}Slope m = ${r.m.toString().replace('-', '−')}, y-intercept b = ${r.b.toString().replace('-', '−')}`,
    graph: { text: r.answerPlain },
  };
}

const EXAMPLES: Inputs[] = [{ eq: '3x + 4y = 12' }, { eq: '2x − 3y = 6' }, { eq: '5x + y = −2' }, { eq: 'x − 2y = 7' }, { eq: '4x = 10' }];

function fromRecognized(text: string): Inputs | null {
  return parseLinearEquation(text).ok ? { eq: text } : null;
}

export function StandardToSlopeTool({ winId }: { winId: string }) {
  return (
    <ProblemShell
      winId={winId}
      type="standardToSlope"
      solve={solve}
      emptyInputs={{ eq: '' }}
      examples={EXAMPLES}
      recognition="equation"
      fromRecognized={fromRecognized}
      renderInputs={({ inputs, setInput, invalidField, firstRef }) => <EquationField value={inputs.eq ?? ''} onChange={(v) => setInput('eq', v)} invalid={invalidField === 'eq'} inputRef={firstRef} />}
    />
  );
}

function EquationField({ value, onChange, invalid, inputRef }: { value: string; onChange: (v: string) => void; invalid: boolean; inputRef: React.RefObject<HTMLInputElement> }) {
  const id = useId();
  // Live "read as" preview so students can see how their typing was understood.
  const preview = useMemo(() => {
    if (!value.trim()) return null;
    const p = parseLinearEquation(value);
    if (!p.ok) return null;
    const { A, B, C } = toStandard(p.value);
    if (A.isZero() && B.isZero()) return null;
    return `${fmtTerms([{ coef: A, v: 'x' }, { coef: B, v: 'y' }])} = ${fmtR(C)}`;
  }, [value]);

  return (
    <div className="eq-field">
      <label className="field-label" htmlFor={id}>
        Equation
      </label>
      <input
        ref={inputRef}
        id={id}
        className={`field field-math field-lg ${invalid ? 'is-invalid' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="3x + 4y = 12"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={invalid}
        aria-describedby={`${id}-hint`}
      />
      <div className="eq-preview" id={`${id}-hint`} aria-live="polite">
        {preview ? (
          <>
            <span className="muted small">Reads as</span> <MathView m={preview} />
          </>
        ) : (
          <span className="muted small">Any linear equation works: 2y = 4x + 6, x − y = 0, ½x + y = 3…</span>
        )}
      </div>
    </div>
  );
}
