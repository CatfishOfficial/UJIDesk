import { useId, useMemo, useState } from 'react';
import { ProblemShell } from '../components/tools/problem/ProblemShell';
import type { Inputs, SolvedView } from '../components/tools/problem/types';
import { MathView } from '../components/ui/MathView';
import { ELEMENTS, blockOf, electronConfig, type Element } from './elements';
import { cfgMarkup, formatSubs, orbitalBoxes, outsideCore, parseCharge, parseSpecies, readElectronProblem, solveElectrons, speciesLabel, sup, type ConfigForm, type ElectronResult, type Subshell } from './electrons';
import { buildElectronLesson, guideElectrons } from './electronLesson';

type Ok = Extract<ElectronResult, { kind: 'ok' }>;

const formOf = (inputs: Inputs): ConfigForm => (inputs.form === 'short' ? 'short' : 'long');

/** "1s2 2s2" → "1s² 2s²", keeping any [core]. */
const pretty = (text: string) => text.replace(/([spdf])(\d+)/g, (_, l, n) => `${l}${sup(n)}`);

/** The element box may hold the charge too ("Fe3+"); a separate charge box wins when filled in. */
function readSpecies(inputs: Inputs) {
  const sp = parseSpecies(inputs.el ?? '');
  const raw = (inputs.charge ?? '').trim();
  const charge = raw ? parseCharge(raw) : (sp.charge ?? 0);
  return { el: sp.el, charge, chargeRaw: raw };
}

function solve(inputs: Inputs): SolvedView {
  if (!(inputs.el ?? '').trim()) return { ok: false, error: 'Which atom or ion? Type a symbol, a name, an atomic number, or an ion like Fe3+.', field: 'el' };
  const { el, charge, chargeRaw } = readSpecies(inputs);
  if (!el) return { ok: false, error: `I don't know an element called "${inputs.el.trim()}". Try a symbol like Fe, a name like iron, or an ion like O2−.`, field: 'el' };
  if (charge === null) return { ok: false, error: `I can't read "${chargeRaw}" as a charge. Try 2+, 3−, or leave it blank for a neutral atom.`, field: 'charge' };
  const r = solveElectrons(el, charge);
  if (r.kind === 'error') return { ok: false, error: r.message, field: r.field };
  const form = formOf(inputs);
  const label = speciesLabel(el, charge);
  const main = form === 'short' ? r.short : r.long;
  const other = form === 'short' ? r.long : r.short;
  const details: { label: string; value: string }[] = [];
  if (other !== main) details.push({ label: form === 'short' ? 'Long form' : 'Short form', value: cfgMarkup(pretty(other)) });
  if (r.byShell !== r.long) details.push({ label: 'By shell', value: cfgMarkup(pretty(r.byShell)) });
  details.push({ label: 'Electrons', value: String(r.electrons) });
  details.push({ label: `Outer shell (n = ${r.outer.n})`, value: `${r.outer.e} "electron${r.outer.e === 1 ? '' : 's'}"` });
  details.push({ label: 'Unpaired', value: String(r.unpaired) });
  if (r.isoelectronic && r.charge !== 0) details.push({ label: 'Same as', value: `"${r.isoelectronic.name.toLowerCase()} (${r.isoelectronic.symbol})"` });

  return {
    ok: true,
    answer: cfgMarkup(pretty(main)),
    answerPlain: main,
    answerSize: main.length > 28 ? 'lg' : undefined,
    caption: `${label}${charge === 0 ? `, ${el.name.toLowerCase()}` : ''}: ${form === 'short' ? 'short (noble-gas) form' : 'long (full) form'}${r.exception ? ', a known exception' : ''}${r.predicted ? ', predicted' : ''}`,
    steps: r.steps,
    workHeader: `Electron configuration of ${label}`,
    label: `${speciesLabel(el, charge, false)}, ${form}`,
    figure: <OrbitalDiagram r={r} />,
    details,
    decisions: () => buildElectronLesson(r),
    guide: guideElectrons(r),
  };
}

const fromRecognizedElectrons = (text: string): Inputs | null => readElectronProblem(text);

const EXAMPLES: Inputs[] = [
  { el: 'Fe', charge: '', form: 'long' },
  { el: 'Cl', charge: '', form: 'short' },
  { el: 'Fe', charge: '3+', form: 'short' },
  { el: 'Cr', charge: '', form: 'long' },
  { el: 'O', charge: '2-', form: 'long' },
  { el: 'Sn', charge: '', form: 'short' },
  { el: 'Cu', charge: '2+', form: 'short' },
];

export function ElectronConfigTool({ winId }: { winId: string }) {
  return (
    <ProblemShell
      winId={winId}
      type="electronConfig"
      solve={solve}
      emptyInputs={{ el: '', charge: '', form: 'long' }}
      examples={EXAMPLES}
      recognition="electron"
      fromRecognized={fromRecognizedElectrons}
      renderInputs={(args) => <ElectronInputs {...args} />}
    />
  );
}

function ElectronInputs({
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
  const form = formOf(inputs);
  const { el, charge } = readSpecies(inputs);
  const electrons = el && charge !== null ? el.z - charge : null;

  return (
    <div className="ec-inputs">
      <div className="decay-row">
        <label className="decay-field">
          <span className="field-label">Atom or ion</span>
          <input
            ref={firstRef}
            id={`${id}-el`}
            className={`field ${invalidField === 'el' ? 'is-invalid' : ''}`}
            value={inputs.el ?? ''}
            onChange={(e) => setInput('el', e.target.value)}
            onPaste={(e) => {
              // "Fe3+ noble gas notation" fills everything at once.
              const parsed = fromRecognizedElectrons(e.clipboardData.getData('text'));
              if (parsed && /\s/.test(e.clipboardData.getData('text').trim())) {
                e.preventDefault();
                setInputs(parsed);
              }
            }}
            placeholder="Fe, iron, 26, or Fe3+"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={invalidField === 'el'}
          />
        </label>
        <label className="decay-field is-narrow">
          <span className="field-label">Charge</span>
          <input
            className={`field ${invalidField === 'charge' ? 'is-invalid' : ''}`}
            value={inputs.charge ?? ''}
            onChange={(e) => setInput('charge', e.target.value.replace(/[^\d+\-−]/g, ''))}
            placeholder="0, 2+, 3−"
            autoComplete="off"
            aria-invalid={invalidField === 'charge'}
          />
        </label>
      </div>
      <div className="ec-form-row">
        <div className="seg decay-types" role="radiogroup" aria-label="Answer form">
          {(
            [
              ['long', 'Long', 'Every subshell: 1s² 2s² 2p⁶…'],
              ['short', 'Short', 'Noble-gas shorthand: [Ar] 4s² 3d⁶'],
            ] as const
          ).map(([v, label, hint]) => (
            <button key={v} type="button" role="radio" aria-checked={form === v} aria-pressed={form === v} title={hint} onClick={() => setInput('form', v)}>
              {label}
            </button>
          ))}
        </div>
        <span className="eq-preview ec-preview" aria-live="polite">
          {el && electrons !== null && electrons > 0 ? (
            <>
              <span className="muted small">Reads as</span> <MathView m={`"${speciesLabel(el, charge ?? 0)}"`} /> <span className="muted small">· {electrons} electrons</span>
            </>
          ) : (
            <span className="muted small">Or pick an element below.</span>
          )}
        </span>
      </div>
      <MiniTable selected={el?.z ?? null} electrons={electrons} onPick={(e) => setInput('el', e.symbol)} />
    </div>
  );
}

/**
 * A small periodic table colored by block (s, p, d, f). Click to pick an
 * element; the shaded cells are the filling path, 1 up to the electron count.
 */
function MiniTable({ selected, electrons, onPick }: { selected: number | null; electrons: number | null; onPick: (e: Element) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const peek = hover ? ELEMENTS[hover - 1] : null;
  const filled = electrons && electrons > 0 ? Math.min(electrons, 118) : 0;
  const cells = useMemo(() => ELEMENTS.map((e) => ({ e, block: blockOf(e) })), []);
  return (
    <div className="ec-mini">
      <div className="ec-mini-grid" role="group" aria-label="Pick an element">
        {cells.map(({ e, block }) => (
          <button
            key={e.z}
            type="button"
            className={`ec-cell blk-${block} ${e.z <= filled ? 'is-filled' : ''} ${selected === e.z ? 'is-selected' : ''}`}
            style={{ gridRow: e.row, gridColumn: e.col }}
            onClick={() => onPick(e)}
            onMouseEnter={() => setHover(e.z)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(e.z)}
            onBlur={() => setHover(null)}
            aria-label={`${e.name}, ${e.symbol}, ${block}-block`}
            aria-pressed={selected === e.z}
          >
            {e.symbol}
          </button>
        ))}
        <span className="ec-gap" style={{ gridRow: 8, gridColumn: '1 / -1' }} aria-hidden="true" />
      </div>
      <div className="ec-mini-foot">
        <span className="ec-legend" aria-hidden="true">
          {(['s', 'p', 'd', 'f'] as const).map((b) => (
            <span key={b} className={`ec-key blk-${b}`}>
              {b}
            </span>
          ))}
        </span>
        <span className="muted small ec-peek">
          {peek ? (
            <>
              <b>{peek.name}</b> <MathView m={cfgMarkup(pretty(electronConfig(peek.z)))} />
            </>
          ) : filled ? (
            `Shaded: the filling path, 1 → ${filled}. Read it row by row.`
          ) : (
            'Point at an element to peek; click to pick it.'
          )}
        </span>
      </div>
    </div>
  );
}

/** Orbital boxes for the electrons outside the core, arrows paired only after each box has one. */
function OrbitalDiagram({ r }: { r: Ok }) {
  const shown: Subshell[] = outsideCore(r.config, r.core);
  return (
    <figure className="ec-orbitals" aria-label={`Orbital diagram: ${r.short}, ${r.unpaired} unpaired`}>
      {r.core && <span className="ec-core">[{r.core.symbol}]</span>}
      {shown.map((s) => (
        <div key={`${s.n}${s.l}`} className="ec-sub">
          <div className="ec-boxes">
            {orbitalBoxes(s).map((b, i) => (
              <span key={i} className="ec-box">
                {b >= 1 && <span className="ec-up">↿</span>}
                {b === 2 && <span className="ec-down">⇂</span>}
              </span>
            ))}
          </div>
          <span className="ec-sub-label">
            {s.n}
            {s.l}
            <sup>{s.e}</sup>
          </span>
        </div>
      ))}
      <figcaption className="muted small">
        {r.unpaired} unpaired electron{r.unpaired === 1 ? '' : 's'} · {formatSubs(shown, true) || 'no electrons outside the core'}
      </figcaption>
    </figure>
  );
}
