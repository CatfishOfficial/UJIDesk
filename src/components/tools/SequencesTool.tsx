import { ProblemShell } from './problem/ProblemShell';
import type { Inputs, SolvedView } from './problem/types';
import { ExprField, NumField } from './problem/fields';
import { TermStrip } from './figures';
import { aSub, bigR, buildSeqLesson, solveSequence } from '../../math/sequences';
import { fmtR, toPlain } from '../../math/markup';
import { plainR } from '../../math/surd';
import { detectProblem } from '../../math/detect';
import { guideSequence } from '../../math/teaching';

function solve(inputs: Inputs): SolvedView {
  const raw = (inputs.terms ?? '').trim();
  if (!raw) return { ok: false, error: 'Type at least three terms, like 3, 7, 11.', field: 'terms' };
  const r = solveSequence(raw, inputs.n ?? '');
  if (r.kind === 'error') return { ok: false, error: r.message, field: r.field };
  const hasN = !!(inputs.n ?? '').trim();
  const arith = r.kind === 'arithmetic';
  const label = `${r.terms.map(plainR).join(', ')}, …${hasN ? ` (term ${r.n})` : ''}`;
  const details = [
    { label: arith ? 'Common difference' : 'Common ratio', value: `${arith ? 'd' : 'r'} = ${fmtR(r.step)}` },
    { label: 'Next term', value: fmtR(r.next) },
    ...(hasN ? [{ label: `Term ${r.n}`, value: `${aSub(r.n)} = ${bigR(r.an)}` }] : []),
    { label: `Sum of ${r.n} terms`, value: `${aSub(r.n, 'S')} = ${bigR(r.sum)}` },
    ...(r.infinite ? [{ label: 'Sum to infinity', value: `S = ${fmtR(r.infinite)}` }] : []),
  ];
  return {
    ok: true,
    answer: r.formula,
    answerPlain: r.answerPlain,
    caption: arith ? 'Arithmetic: the same amount is added each time.' : 'Geometric: each term is multiplied by the same amount.',
    details,
    figure: <TermStrip terms={r.terms.map((t) => toPlain(fmtR(t)).replace(/-/g, '−'))} op={arith ? `${r.step.isNegative() ? '−' : '+'}${plainR(r.step.abs())}` : `×${plainR(r.step)}`} next={plainR(r.next)} />,
    steps: r.steps,
    workHeader: `The sequence ${label}`,
    label,
    decisions: () => buildSeqLesson(r, hasN),
    guide: guideSequence(r, hasN),
  };
}

const EXAMPLES: Inputs[] = [
  { terms: '3, 7, 11, 15', n: '20' },
  { terms: '2, 6, 18, 54', n: '8' },
  { terms: '50, 44, 38', n: '10' },
  { terms: '81, 27, 9, 3', n: '' },
  { terms: '1/2, 1, 3/2, 2', n: '12' },
];

function fromRecognized(text: string): Inputs | null {
  const d = detectProblem(text);
  if (d?.type === 'sequences') return d.inputs;
  return solveSequence(text, '').kind === 'error' ? null : { terms: text, n: '' };
}

export function SequencesTool({ winId }: { winId: string }) {
  return (
    <ProblemShell
      winId={winId}
      type="sequences"
      solve={solve}
      emptyInputs={{ terms: '', n: '' }}
      examples={EXAMPLES}
      recognition="sequence"
      fromRecognized={fromRecognized}
      renderInputs={({ inputs, setInput, invalidField, firstRef }) => (
        <div className="seq-inputs">
          <ExprField
            label="Terms"
            value={inputs.terms ?? ''}
            onChange={(v) => setInput('terms', v)}
            placeholder="3, 7, 11, 15, …"
            invalid={invalidField === 'terms'}
            inputRef={firstRef}
            hint="Three or more terms, in order."
          />
          <div className="num-grid">
            <NumField label="Find term n" optional value={inputs.n ?? ''} onChange={(v) => setInput('n', v.replace(/[^\d]/g, ''))} invalid={invalidField === 'n'} placeholder="10" />
          </div>
        </div>
      )}
    />
  );
}
