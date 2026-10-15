import { useMemo } from 'react';
import { ProblemShell } from './problem/ProblemShell';
import type { Inputs, SolvedView } from './problem/types';
import { NumField } from './problem/fields';
import { RightTriangle } from './figures';
import { buildTrigLesson, SIDE_NAME, solveTrig } from '../../math/trig';
import { Rational } from '../../math/rational';
import { round } from '../../math/surd';
import { detectProblem } from '../../math/detect';
import { guideTrig } from '../../math/teaching';

function solve(inputs: Inputs): SolvedView {
  const r = solveTrig(inputs);
  if (r.kind === 'error') return { ok: false, error: r.message, field: r.field };
  const given = [inputs.angle?.trim() && `A = ${inputs.angle.trim().replace(/°$/, '')}°`, ...(['opp', 'adj', 'hyp'] as const).filter((k) => inputs[k]?.trim()).map((k) => `${k} ${inputs[k].trim()}`)].filter(Boolean).join(', ');
  return {
    ok: true,
    answer: r.answer,
    answerPlain: r.answerPlain,
    caption: 'Rounded to two decimal places (angles to one). Calculator in degrees.',
    details: [
      { label: 'All three sides', value: `opp ≈ ${round(r.sides.opp, 2).replace('−', '-')},  adj ≈ ${round(r.sides.adj, 2).replace('−', '-')},  hyp ≈ ${round(r.sides.hyp, 2).replace('−', '-')}` },
      { label: 'Angles', value: `A ≈ ${round(r.A, 1)}°,  B ≈ ${round(r.B, 1)}°,  C = 90°` },
    ],
    steps: r.steps,
    workHeader: `Right-triangle trig: ${given}`,
    label: given,
    decisions: () => buildTrigLesson(r),
    guide: guideTrig(r),
  };
}

const EXAMPLES: Inputs[] = [
  { angle: '35', opp: '', adj: '', hyp: '10' },
  { angle: '', opp: '3', adj: '4', hyp: '' },
  { angle: '52', opp: '', adj: '8', hyp: '' },
  { angle: '', opp: '7', adj: '', hyp: '12' },
  { angle: '20', opp: '5', adj: '', hyp: '' },
];

function fromRecognized(text: string): Inputs | null {
  const d = detectProblem(text);
  return d?.type === 'trig' ? d.inputs : null;
}

export function TrigTool({ winId }: { winId: string }) {
  return (
    <ProblemShell
      winId={winId}
      type="trig"
      solve={solve}
      emptyInputs={{ angle: '', opp: '', adj: '', hyp: '' }}
      examples={EXAMPLES}
      recognition="trig"
      fromRecognized={fromRecognized}
      renderInputs={({ inputs, setInput, invalidField, firstRef }) => <TrigInputs inputs={inputs} setInput={setInput} invalidField={invalidField} firstRef={firstRef} />}
    />
  );
}

function TrigInputs({ inputs, setInput, invalidField, firstRef }: { inputs: Inputs; setInput: (k: string, v: string) => void; invalidField?: string; firstRef: React.RefObject<HTMLInputElement> }) {
  const shape = useMemo(() => {
    const n = (k: string) => {
      const r = Rational.parse((inputs[k] ?? '').replace('°', ''));
      return r && r.sign() > 0 ? r.toNumber() : null;
    };
    const A = n('angle');
    if (A && A < 90) return { base: Math.cos((A * Math.PI) / 180), height: Math.sin((A * Math.PI) / 180) };
    const o = n('opp');
    const a = n('adj');
    const h = n('hyp');
    if (o && a) return { base: a, height: o };
    if (h && o && h > o) return { base: Math.sqrt(h * h - o * o), height: o };
    if (h && a && h > a) return { base: a, height: Math.sqrt(h * h - a * a) };
    return { base: 4, height: 3 };
  }, [inputs]);
  const side = (k: 'opp' | 'adj' | 'hyp') => ({ text: inputs[k]?.trim() ? `${SIDE_NAME[k]} ${inputs[k].trim()}` : SIDE_NAME[k], unknown: !inputs[k]?.trim() });
  const angle = inputs.angle?.trim();
  return (
    <div className="geo-inputs">
      <RightTriangle
        base={shape.base}
        height={shape.height}
        baseLabel={side('adj')}
        heightLabel={side('opp')}
        hypLabel={side('hyp')}
        angleLabel={{ text: angle ? `A = ${angle.replace(/°$/, '')}°` : 'A', unknown: !angle }}
      />
      <div className="num-grid num-grid-tight">
        <NumField label="Angle A" value={inputs.angle ?? ''} onChange={(v) => setInput('angle', v)} invalid={invalidField === 'angle'} inputRef={firstRef} suffix="°" placeholder="?" />
        <NumField label="Opposite" value={inputs.opp ?? ''} onChange={(v) => setInput('opp', v)} invalid={invalidField === 'opp'} placeholder="?" />
        <NumField label="Adjacent" value={inputs.adj ?? ''} onChange={(v) => setInput('adj', v)} invalid={invalidField === 'adj'} placeholder="?" />
        <NumField label="Hypotenuse" value={inputs.hyp ?? ''} onChange={(v) => setInput('hyp', v)} invalid={invalidField === 'hyp'} placeholder="?" />
      </div>
      <p className="muted small geo-hint">Give two: an angle and a side, or two sides. Sides are named from angle A.</p>
    </div>
  );
}
