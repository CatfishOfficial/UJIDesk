import { ProblemShell } from './problem/ProblemShell';
import type { Inputs, SolvedView } from './problem/types';
import { NumField, Seg } from './problem/fields';
import { ShapeFigure } from './figures';
import { buildAreaLesson, fmtMeasure, SHAPES, solveArea, UNITS, type Shape } from '../../math/geometry';
import { detectProblem } from '../../math/detect';
import { guideArea } from '../../math/teaching';

const EMPTY: Inputs = { shape: 'rectangle', unit: '', l: '', w: '', s: '', b: '', h: '', s1: '', s2: '', b1: '', b2: '', r: '', d: '' };

function solve(inputs: Inputs): SolvedView {
  const r = solveArea(inputs);
  if (r.kind === 'error') return { ok: false, error: r.message, field: r.field };
  const def = SHAPES.find((s) => s.id === r.shape)!;
  const dims = def.fields
    .filter((f) => inputs[f.key]?.trim())
    .map((f) => `${f.label.replace(/^or /, '').toLowerCase()} ${inputs[f.key].trim()}`)
    .join(', ');
  const label = `${def.label}: ${dims}${r.unit ? ` ${r.unit}` : ''}`;
  return {
    ok: true,
    answer: `A = ${fmtMeasure(r.area, r.unit, 2)}`,
    answerPlain: r.answerPlain,
    caption: r.perimeterNote,
    details: r.perimeter ? [{ label: r.shape === 'circle' ? 'Circumference' : 'Perimeter', value: `${r.shape === 'circle' ? 'C' : 'P'} = ${fmtMeasure(r.perimeter, r.unit, 1)}` }] : undefined,
    steps: r.steps,
    workHeader: `Area${r.perimeter ? ' and perimeter' : ''} of a ${def.label.toLowerCase()} (${dims})`,
    label,
    decisions: () => buildAreaLesson(r),
    guide: guideArea(r),
  };
}

const EXAMPLES: Inputs[] = [
  { ...EMPTY, shape: 'rectangle', l: '8', w: '5', unit: 'cm' },
  { ...EMPTY, shape: 'triangle', b: '10', h: '6', unit: 'in' },
  { ...EMPTY, shape: 'circle', r: '3', unit: 'm' },
  { ...EMPTY, shape: 'trapezoid', b1: '4', b2: '10', h: '5', unit: 'ft' },
  { ...EMPTY, shape: 'parallelogram', b: '7', h: '4', s1: '5' },
];

function fromRecognized(text: string): Inputs | null {
  const d = detectProblem(text);
  return d?.type === 'area' ? { ...EMPTY, ...d.inputs } : null;
}

const SHORT: Record<Shape, string> = { rectangle: 'Rectangle', square: 'Square', triangle: 'Triangle', parallelogram: 'Parallelogram', trapezoid: 'Trapezoid', circle: 'Circle' };

export function AreaTool({ winId }: { winId: string }) {
  return (
    <ProblemShell
      winId={winId}
      type="area"
      solve={solve}
      emptyInputs={EMPTY}
      examples={EXAMPLES}
      recognition="area"
      fromRecognized={fromRecognized}
      renderInputs={({ inputs, setInput, invalidField, firstRef }) => {
        const shape = ((inputs.shape as Shape) || 'rectangle') as Shape;
        const def = SHAPES.find((s) => s.id === shape)!;
        const unit = inputs.unit ?? '';
        const labels = Object.fromEntries(def.fields.map((f) => [f.key, inputs[f.key]?.trim() ? `${inputs[f.key].trim()}${unit ? ` ${unit}` : ''}` : '']));
        return (
          <div className="geo-inputs">
            <Seg label="Shape" className="seg-grid" value={shape} onChange={(v) => setInput('shape', v)} options={SHAPES.map((s) => ({ id: s.id, label: SHORT[s.id] }))} />
            <ShapeFigure shape={shape} labels={labels} />
            <div className="num-grid">
              {def.fields.map((f, i) => (
                <NumField
                  key={f.key}
                  label={f.label}
                  optional={f.optional && !(shape === 'circle' && f.key === 'd')}
                  value={inputs[f.key] ?? ''}
                  onChange={(v) => setInput(f.key, v)}
                  invalid={invalidField === f.key}
                  inputRef={i === 0 ? firstRef : undefined}
                  suffix={unit || undefined}
                />
              ))}
              <label className="num-field">
                <span className="field-label">Units</span>
                <select className="field" value={unit} onChange={(e) => setInput('unit', e.target.value)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u || 'none'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        );
      }}
    />
  );
}
