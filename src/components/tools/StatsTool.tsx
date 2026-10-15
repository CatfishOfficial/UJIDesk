import { useMemo } from 'react';
import { ProblemShell } from './problem/ProblemShell';
import type { Inputs, SolvedView } from './problem/types';
import { ExprField } from './problem/fields';
import { DotPlot } from './figures';
import { buildStatsLesson, solveStats } from '../../math/stats';
import { fmtR } from '../../math/markup';
import { parseNumberList } from '../../math/surd';
import { detectProblem } from '../../math/detect';
import { guideStats } from '../../math/teaching';

function solve(inputs: Inputs): SolvedView {
  const raw = (inputs.list ?? '').trim();
  if (!raw) return { ok: false, error: 'Type some numbers, separated by commas or spaces.', field: 'list' };
  const r = solveStats(raw);
  if (r.kind === 'error') return { ok: false, error: r.message, field: 'list' };
  const label = r.values.length > 8 ? `${r.values.slice(0, 7).map(String).join(', ')}, … (${r.n} numbers)` : r.values.map(String).join(', ');
  return {
    ok: true,
    answer: r.answer,
    answerPlain: r.answerPlain,
    answerSize: 'lg',
    details: [
      // A repeating mean is rounded in the headline; here it is exactly.
      ...(r.answer.startsWith('mean ≈') ? [{ label: 'Mean, exactly', value: fmtR(r.mean) }] : []),
      { label: 'Mode', value: r.modes.length ? r.modes.map(fmtR).join(', ') : 'no mode' },
      { label: 'Range', value: fmtR(r.range) },
      { label: 'Count · sum', value: `n = ${r.n},  sum = ${fmtR(r.sum)}` },
    ],
    figure: <DotPlot values={r.values} mean={r.mean.toNumber()} median={r.median.toNumber()} />,
    steps: r.steps,
    workHeader: `Mean, median, mode and range of ${label}`,
    label: label.replace(/-/g, '−'),
    decisions: () => buildStatsLesson(r),
    guide: guideStats(r),
  };
}

const EXAMPLES: Inputs[] = [{ list: '3, 7, 7, 2, 9' }, { list: '4, 8, 15, 16, 23, 42' }, { list: '88, 92, 75, 92, 81, 70, 95' }, { list: '1.5, 2.5, 2.5, 4, 6' }, { list: '−3, 0, 2, 2, 5, 5, 9' }];

function fromRecognized(text: string): Inputs | null {
  const d = detectProblem(text);
  if (d?.type === 'stats') return d.inputs;
  const l = parseNumberList(text);
  return l.ok && l.values.length >= 2 ? { list: text } : null;
}

export function StatsTool({ winId }: { winId: string }) {
  return (
    <ProblemShell
      winId={winId}
      type="stats"
      solve={solve}
      emptyInputs={{ list: '' }}
      examples={EXAMPLES}
      recognition="list"
      fromRecognized={fromRecognized}
      renderInputs={({ inputs, setInput, invalidField, firstRef }) => <ListField value={inputs.list ?? ''} onChange={(v) => setInput('list', v)} invalid={invalidField === 'list'} inputRef={firstRef} />}
    />
  );
}

function ListField({ value, onChange, invalid, inputRef }: { value: string; onChange: (v: string) => void; invalid: boolean; inputRef: React.RefObject<HTMLInputElement> }) {
  const count = useMemo(() => {
    const l = value.trim() ? parseNumberList(value) : null;
    return l?.ok ? l.values.length : null;
  }, [value]);
  return (
    <ExprField
      label="Numbers"
      value={value}
      onChange={onChange}
      placeholder="3, 7, 7, 2, 9"
      invalid={invalid}
      inputRef={inputRef}
      hint={count ? `${count} number${count === 1 ? '' : 's'}. Order doesn’t matter.` : 'Commas or spaces between them. Decimals, fractions and negatives are fine.'}
    />
  );
}
