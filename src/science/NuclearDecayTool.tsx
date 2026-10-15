import { useId, useMemo } from 'react';
import { ProblemShell } from '../components/tools/problem/ProblemShell';
import type { Inputs, SolvedView } from '../components/tools/problem/types';
import { MathView } from '../components/ui/MathView';
import { toPlain } from '../math/markup';
import { DECAY, nuc, particleOf, parseDecayType, parseNuclide, solveDecay, type DecayType } from './decay';
import { buildDecayLesson } from './decayLesson';
import { findElement } from './elements';
import { guideDecay } from '../math/teaching';

const TYPES: { id: DecayType; label: string; hint: string }[] = [
  { id: 'alpha', label: 'Alpha', hint: 'α: gives off ⁴₂He' },
  { id: 'beta', label: 'Beta', hint: 'β⁻: gives off an electron' },
  { id: 'positron', label: 'Positron', hint: 'β⁺: gives off a positron' },
];

const typeOf = (inputs: Inputs): DecayType => (inputs.type as DecayType) || 'alpha';

/** Reads the element box (which may also hold the mass number, e.g. "Po-210"). */
function readParent(inputs: Inputs) {
  const fromText = parseNuclide(inputs.el ?? '');
  const el = findElement(inputs.el ?? '') ?? fromText.el;
  const aRaw = (inputs.a ?? '').trim();
  const a = aRaw ? Number(aRaw) : fromText.a;
  return { el, a };
}

function solve(inputs: Inputs): SolvedView {
  const { el, a } = readParent(inputs);
  if (!(inputs.el ?? '').trim()) return { ok: false, error: 'Which element? Type a symbol, a name, or an atomic number.', field: 'el' };
  if (!el) return { ok: false, error: `I don't know an element called "${inputs.el.trim()}". Try a symbol like Po or a name like polonium.`, field: 'el' };
  if (a == null || Number.isNaN(a)) return { ok: false, error: `What's the mass number? For example, ${el.symbol}-${Math.round(el.mass)}.`, field: 'a' };
  const type = typeOf(inputs);
  const r = solveDecay(el, a, type);
  if (r.kind === 'error') return { ok: false, error: r.message, field: r.field };
  const label = `${el.symbol}-${a}, ${DECAY[type].name.toLowerCase()}`;
  return {
    ok: true,
    answer: r.equation,
    answerPlain: toPlain(r.equation),
    caption: `Product: ${r.daughter.el.name.toLowerCase()}-${r.daughter.a} (${toPlain(`[${r.daughter.a}|${r.daughter.z}|${r.daughter.el.symbol}]`)})`,
    steps: r.steps,
    workHeader: `${DECAY[type].name} of ${el.name.toLowerCase()}-${a}`,
    label,
    decisions: () => buildDecayLesson(r),
    guide: guideDecay({
      name: el.name.toLowerCase(),
      a,
      z: el.z,
      type,
      da: r.daughter.a,
      dz: r.daughter.z,
      pa: DECAY[type].particle.a,
      pz: DECAY[type].particle.z,
      daughter: r.daughter.el.name.toLowerCase(),
    }),
  };
}

const EXAMPLES: Inputs[] = [
  { el: 'Po', a: '210', type: 'alpha' },
  { el: 'U', a: '238', type: 'alpha' },
  { el: 'C', a: '14', type: 'beta' },
  { el: 'Na', a: '22', type: 'positron' },
  { el: 'I', a: '131', type: 'beta' },
];

function fromRecognized(text: string): Inputs | null {
  const { el, a } = parseNuclide(text);
  if (!el) return null;
  return { el: el.symbol, a: a ? String(a) : '', type: parseDecayType(text) ?? 'alpha' };
}

export function NuclearDecayTool({ winId }: { winId: string }) {
  return (
    <ProblemShell
      winId={winId}
      type="nuclearDecay"
      solve={solve}
      emptyInputs={{ el: '', a: '', type: '' }}
      examples={EXAMPLES}
      recognition="nuclear"
      fromRecognized={fromRecognized}
      renderInputs={({ inputs, setInput, setInputs, invalidField, firstRef }) => <DecayInputs inputs={inputs} setInput={setInput} setInputs={setInputs} invalidField={invalidField} firstRef={firstRef} />}
    />
  );
}

function DecayInputs({
  inputs,
  setInput,
  setInputs,
  invalidField,
  firstRef,
}: {
  inputs: Inputs;
  setInput: (k: string, v: string) => void;
  setInputs: (i: Inputs) => void;
  invalidField?: string;
  firstRef: React.RefObject<HTMLInputElement>;
}) {
  const id = useId();
  const type = typeOf(inputs);
  const preview = useMemo(() => {
    const { el, a } = readParent(inputs);
    if (!el || a == null || Number.isNaN(a)) return null;
    return `${nuc(a, el.z, el.symbol)} → ? + ${particleOf(type)}`;
  }, [inputs, type]);

  return (
    <div className="decay-inputs">
      <div className="decay-row">
        <label className="decay-field">
          <span className="field-label">Element</span>
          <input
            ref={firstRef}
            id={`${id}-el`}
            className={`field ${invalidField === 'el' ? 'is-invalid' : ''}`}
            value={inputs.el ?? ''}
            onChange={(e) => setInput('el', e.target.value)}
            onPaste={(e) => {
              // "Po-210 alpha decay" fills everything at once.
              const parsed = fromRecognized(e.clipboardData.getData('text'));
              if (parsed && parsed.a) {
                e.preventDefault();
                setInputs(parsed);
              }
            }}
            placeholder="Po, polonium, or 84"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={invalidField === 'el'}
          />
        </label>
        <label className="decay-field is-narrow">
          <span className="field-label">Mass number</span>
          <input
            className={`field ${invalidField === 'a' ? 'is-invalid' : ''}`}
            value={inputs.a ?? ''}
            onChange={(e) => setInput('a', e.target.value.replace(/[^\d]/g, ''))}
            placeholder="210"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={invalidField === 'a'}
          />
        </label>
      </div>
      <div className="seg decay-types" role="radiogroup" aria-label="Decay type">
        {TYPES.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={type === t.id} aria-pressed={type === t.id} title={t.hint} onClick={() => setInput('type', t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="eq-preview" aria-live="polite">
        {preview ? (
          <>
            <span className="muted small">Reads as</span> <MathView m={preview} />
          </>
        ) : (
          <span className="muted small">Like Po-210 alpha, C-14 beta, or Na-22 positron.</span>
        )}
      </div>
    </div>
  );
}
