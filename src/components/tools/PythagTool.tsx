import { useMemo } from 'react';
import { ProblemShell } from './problem/ProblemShell';
import type { Inputs, SolvedView } from './problem/types';
import { NumField } from './problem/fields';
import { RightTriangle } from './figures';
import { buildPythagLesson, solvePythag } from '../../math/geometry';
import { Rational } from '../../math/rational';
import { detectProblem } from '../../math/detect';
import { guidePythag } from '../../math/teaching';

function solve(inputs: Inputs): SolvedView {
  const r = solvePythag({ a: inputs.a ?? '', b: inputs.b ?? '', c: inputs.c ?? '' });
  if (r.kind === 'error') return { ok: false, error: r.message, field: r.field };
  const show = (k: 'a' | 'b' | 'c') => (inputs[k]?.trim() ? inputs[k].trim() : '?');
  const label = `a = ${show('a')}, b = ${show('b')}, c = ${show('c')}`;
  if (r.kind === 'check') {
    return {
      ok: true,
      answer: r.answer,
      answerPlain: r.answerPlain,
      caption: r.right ? 'The squares of the two shorter sides add up to the square of the longest.' : 'For a right triangle, the two shorter sides squared would add to the longest side squared.',
      steps: r.steps,
      workHeader: `Is ${r.sides.map(String).join(', ')} a right triangle?`,
      label,
      decisions: () => [],
    };
  }
  return {
    ok: true,
    answer: r.answer,
    answerPlain: r.answerPlain,
    caption: r.missing === 'c' ? 'The hypotenuse, across from the right angle.' : `Leg ${r.missing}. The hypotenuse is still the longest side.`,
    steps: r.steps,
    workHeader: `Find ${r.missing === 'c' ? 'the hypotenuse' : `leg ${r.missing}`} (${label})`,
    label,
    decisions: () => buildPythagLesson(r),
    guide: guidePythag(r),
  };
}

const EXAMPLES: Inputs[] = [
  { a: '3', b: '4', c: '' },
  { a: '5', b: '', c: '13' },
  { a: '6', b: '9', c: '' },
  { a: '', b: '8', c: '17' },
  { a: '1', b: '1', c: '' },
];

function fromRecognized(text: string): Inputs | null {
  const d = detectProblem(text);
  return d?.type === 'pythag' ? d.inputs : null;
}

export function PythagTool({ winId }: { winId: string }) {
  return (
    <ProblemShell
      winId={winId}
      type="pythag"
      solve={solve}
      emptyInputs={{ a: '', b: '', c: '' }}
      examples={EXAMPLES}
      recognition="pythag"
      fromRecognized={fromRecognized}
      renderInputs={({ inputs, setInput, invalidField, firstRef }) => <PythagInputs inputs={inputs} setInput={setInput} invalidField={invalidField} firstRef={firstRef} />}
    />
  );
}

function PythagInputs({ inputs, setInput, invalidField, firstRef }: { inputs: Inputs; setInput: (k: string, v: string) => void; invalidField?: string; firstRef: React.RefObject<HTMLInputElement> }) {
  // Draw the triangle to scale when the numbers allow it.
  const shape = useMemo(() => {
    const n = (k: string) => {
      const r = Rational.parse(inputs[k] ?? '');
      return r && r.sign() > 0 ? r.toNumber() : null;
    };
    const a = n('a');
    const b = n('b');
    const c = n('c');
    if (a && b) return { base: b, height: a };
    if (c && a && c > a) return { base: Math.sqrt(c * c - a * a), height: a };
    if (c && b && c > b) return { base: b, height: Math.sqrt(c * c - b * b) };
    return { base: 4, height: 3 };
  }, [inputs]);
  const lab = (k: 'a' | 'b' | 'c') => ({ text: inputs[k]?.trim() ? `${k} = ${inputs[k].trim()}` : k, unknown: !inputs[k]?.trim() });
  return (
    <div className="geo-inputs">
      <RightTriangle base={shape.base} height={shape.height} baseLabel={lab('b')} heightLabel={lab('a')} hypLabel={lab('c')} />
      <div className="num-grid">
        <NumField label="Leg a" value={inputs.a ?? ''} onChange={(v) => setInput('a', v)} invalid={invalidField === 'a'} inputRef={firstRef} placeholder="?" />
        <NumField label="Leg b" value={inputs.b ?? ''} onChange={(v) => setInput('b', v)} invalid={invalidField === 'b'} placeholder="?" />
        <NumField label="Hypotenuse c" value={inputs.c ?? ''} onChange={(v) => setInput('c', v)} invalid={invalidField === 'c'} placeholder="?" />
      </div>
      <p className="muted small geo-hint">Fill in two sides and leave the missing one blank. Fill all three to check for a right triangle.</p>
    </div>
  );
}
