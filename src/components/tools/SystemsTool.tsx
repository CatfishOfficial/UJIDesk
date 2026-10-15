import { useMemo } from 'react';
import { ProblemShell } from './problem/ProblemShell';
import type { Inputs, SolvedView } from './problem/types';
import { ExprField } from './problem/fields';
import { buildSystemLesson, solveSystem } from '../../math/systems';
import { parseLinearEquation, toStandard } from '../../math/linear';
import { fmtR, fmtTerms } from '../../math/markup';
import { detectProblem } from '../../math/detect';
import { guideSystem } from '../../math/teaching';

function solve(inputs: Inputs): SolvedView {
  if (!(inputs.eq1 ?? '').trim()) return { ok: false, error: 'Type the first equation, like 2x + 3y = 12.', field: 'eq1' };
  if (!(inputs.eq2 ?? '').trim()) return { ok: false, error: 'Now the second equation, like x − y = 1.', field: 'eq2' };
  const r = solveSystem(inputs.eq1, inputs.eq2);
  if (r.kind === 'error') return { ok: false, error: r.message, field: r.field };
  const label = `${inputs.eq1.trim()} and ${inputs.eq2.trim()}`.replace(/\s+/g, ' ');
  const how = r.method === 'elimination' ? 'by elimination' : 'by substitution';
  return {
    ok: true,
    answer: r.answer,
    answerPlain: r.answerPlain,
    caption:
      r.kind === 'one'
        ? `The lines cross at one point, found ${how}.`
        : r.kind === 'none'
          ? 'Parallel lines: same slope, different intercepts, so they never meet.'
          : 'Both equations are the same line, so every point on it is a solution.',
    steps: r.steps,
    workHeader: `Solve the system ${label}`,
    label,
    decisions: (accepted) => buildSystemLesson(r, accepted),
    guide: guideSystem(r),
    graph: { text: r.lines[1], more: [r.lines[0]], points: r.kind === 'one' ? [[r.x!.toNumber(), r.y!.toNumber()]] : undefined },
    details: r.kind === 'one' ? [{ label: 'Check', value: `x = ${fmtR(r.x!)},  y = ${fmtR(r.y!)}` }] : undefined,
  };
}

const EXAMPLES: Inputs[] = [
  { eq1: '2x + 3y = 12', eq2: 'x − y = 1' },
  { eq1: 'y = 2x + 1', eq2: '3x + y = 11' },
  { eq1: '3x + 2y = 16', eq2: '7x − 5y = 1' },
  { eq1: 'x + y = 10', eq2: 'x − y = 4' },
  { eq1: 'y = 2x + 1', eq2: '4x − 2y = 6' },
];

function fromRecognized(text: string): Inputs | null {
  const d = detectProblem(text);
  return d?.type === 'systems' ? d.inputs : null;
}

function stdPreview(src: string): string | null {
  if (!src.trim()) return null;
  const p = parseLinearEquation(src);
  if (!p.ok) return null;
  const { A, B, C } = toStandard(p.value);
  if (A.isZero() && B.isZero()) return null;
  return `${fmtTerms([{ coef: A, v: 'x' }, { coef: B, v: 'y' }])} = ${fmtR(C)}`;
}

export function SystemsTool({ winId }: { winId: string }) {
  return (
    <ProblemShell
      winId={winId}
      type="systems"
      solve={solve}
      emptyInputs={{ eq1: '', eq2: '' }}
      examples={EXAMPLES}
      recognition="system"
      fromRecognized={fromRecognized}
      renderInputs={({ inputs, setInput, setInputs, invalidField, firstRef }) => <SystemInputs inputs={inputs} setInput={setInput} setInputs={setInputs} invalidField={invalidField} firstRef={firstRef} />}
    />
  );
}

function SystemInputs({ inputs, setInput, setInputs, invalidField, firstRef }: { inputs: Inputs; setInput: (k: string, v: string) => void; setInputs: (i: Inputs) => void; invalidField?: string; firstRef: React.RefObject<HTMLInputElement> }) {
  const p1 = useMemo(() => stdPreview(inputs.eq1 ?? ''), [inputs.eq1]);
  const p2 = useMemo(() => stdPreview(inputs.eq2 ?? ''), [inputs.eq2]);
  return (
    <div className="sys-inputs">
      <span className="sys-brace" aria-hidden="true" />
      <div className="sys-fields">
        <ExprField
          label="Equation 1"
          value={inputs.eq1 ?? ''}
          onChange={(v) => setInput('eq1', v)}
          placeholder="2x + 3y = 12"
          invalid={invalidField === 'eq1'}
          inputRef={firstRef}
          preview={p1}
          hint="Any linear equation in x and y."
          onPaste={(e) => {
            // "2x + 3y = 12, x − y = 1" fills both boxes.
            const parsed = fromRecognized(e.clipboardData.getData('text'));
            if (parsed) {
              e.preventDefault();
              setInputs(parsed);
            }
          }}
        />
        <ExprField label="Equation 2" value={inputs.eq2 ?? ''} onChange={(v) => setInput('eq2', v)} placeholder="x − y = 1" invalid={invalidField === 'eq2'} preview={p2} hint="y = 2x + 1 style works too." />
      </div>
    </div>
  );
}
