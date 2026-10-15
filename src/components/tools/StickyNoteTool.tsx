import { useWindowData } from '../../state/store';

const PAPERS = ['sun', 'rose', 'mint', 'lilac'] as const;

export function stickyPaper(color: unknown) {
  return `var(--paper-${PAPERS.includes(color as never) ? color : 'sun'})`;
}

export function StickyNoteTool({ winId }: { winId: string }) {
  const [data, update] = useWindowData<{ text: string; color: string }>(winId);
  return (
    <div className="sticky" style={{ background: stickyPaper(data.color) }}>
      <textarea
        className="sticky-text hand"
        value={data.text ?? ''}
        onChange={(e) => update({ text: e.target.value })}
        placeholder="note to self…"
        aria-label="Sticky note"
        autoFocus={!data.text}
      />
      <div className="sticky-colors" role="radiogroup" aria-label="Note color">
        {PAPERS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={(data.color ?? 'sun') === p}
            aria-label={p}
            className="sticky-color"
            style={{ background: `var(--paper-${p})` }}
            onClick={() => update({ color: p })}
          />
        ))}
      </div>
    </div>
  );
}
