import { Fragment, useMemo, useRef, useState } from 'react';
import { Atom, Copy, Search, X } from 'lucide-react';
import { useWindowData, useWorkspace } from '../state/store';
import { CATEGORY_LABEL, ELEMENTS, electronConfig, type Category, type Element } from './elements';
import { copyText } from '../components/tools/bridge';

interface TableData extends Record<string, unknown> {
  selected: number | null;
  q: string;
  highlight: Category | null;
}

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

/** "[Ar] 4s2 3d6" → [Ar] 4s² 3d⁶ with real superscripts. */
function Config({ text }: { text: string }) {
  return (
    <span className="pt-config">
      {text.split(' ').map((part, i) => {
        const m = /^(\d[spdf])(\d+)$/.exec(part);
        return (
          <Fragment key={i}>
            {i > 0 && ' '}
            {m ? (
              <>
                {m[1]}
                <sup>{m[2]}</sup>
              </>
            ) : (
              part
            )}
          </Fragment>
        );
      })}
    </span>
  );
}

const fmtMass = (e: Element) => (e.stable ? String(e.mass) : `[${e.mass}]`);
const block = (e: Element) => (e.group === null ? 'f' : e.group <= 2 || e.z === 2 ? 's' : e.group >= 13 ? 'p' : 'd');

export function PeriodicTableTool({ winId }: { winId: string }) {
  const [d, update] = useWindowData<TableData>(winId);
  const openWindow = useWorkspace((s) => s.openWindow);
  const updateData = useWorkspace((s) => s.updateData);
  const restore = useWorkspace((s) => s.restore);
  const gridRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const q = (d.q ?? '').trim().toLowerCase();
  const selected = d.selected ? ELEMENTS[d.selected - 1] : null;
  const shown = selected ?? (hover ? ELEMENTS[hover - 1] : null);

  const matches = useMemo(() => {
    if (!q) return null;
    return new Set(
      ELEMENTS.filter((e) => e.symbol.toLowerCase() === q || e.name.toLowerCase().includes(q) || String(e.z) === q).map((e) => e.z),
    );
  }, [q]);

  const dimmed = (e: Element) => (matches ? !matches.has(e.z) : d.highlight ? e.category !== d.highlight : false);

  const select = (z: number) => update({ selected: d.selected === z ? null : z });

  /** Arrow keys walk the table, skipping empty cells and the gap above the f-block. */
  const move = (e: Element, key: string) => {
    const dr = { ArrowUp: -1, ArrowDown: 1 }[key] ?? 0;
    const dc = { ArrowLeft: -1, ArrowRight: 1 }[key] ?? 0;
    let r = e.row;
    let c = e.col;
    for (let k = 0; k < 20; k++) {
      r += dr;
      c += dc;
      if (r === 8) r += dr;
      if (r < 1 || r > 10 || c < 1 || c > 18) return;
      const next = ELEMENTS.find((x) => x.row === r && x.col === c);
      if (next) {
        gridRef.current?.querySelector<HTMLElement>(`[data-z="${next.z}"]`)?.focus();
        return;
      }
    }
  };

  /** Sends the element to the nuclear decay tool, reusing an open one. */
  const decay = (e: Element) => {
    const inputs = { el: e.symbol, a: String(Math.round(e.mass)), type: '' };
    const existing = Object.values(useWorkspace.getState().windows).find((w) => w.type === 'nuclearDecay');
    if (existing) {
      updateData(existing.id, { inputs, autoSolve: true });
      restore(existing.id);
    } else openWindow('nuclearDecay', { data: { inputs, autoSolve: true }, near: winId });
  };

  return (
    <div className="pt">
      <div className="pt-top">
        <label className="inv-search pt-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Find an element</span>
          <input type="search" value={d.q ?? ''} onChange={(e) => update({ q: e.target.value })} placeholder="Find an element" />
        </label>
        <div className="pt-legend" role="group" aria-label="Highlight a category">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`pt-chip cat-${c}`}
              aria-pressed={d.highlight === c}
              onClick={() => update({ highlight: d.highlight === c ? null : c, q: '' })}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-body">
        <div className="pt-grid" ref={gridRef} role="grid" aria-label="Periodic table">
          {ELEMENTS.map((e) => (
            <button
              key={e.z}
              type="button"
              data-z={e.z}
              className={`pt-el cat-${e.category} ${dimmed(e) ? 'is-dim' : ''} ${d.selected === e.z ? 'is-selected' : ''}`}
              style={{ gridRow: e.row, gridColumn: e.col }}
              onClick={() => select(e.z)}
              onMouseEnter={() => setHover(e.z)}
              onMouseLeave={() => setHover(null)}
              onKeyDown={(ev) => {
                if (ev.key.startsWith('Arrow')) {
                  ev.preventDefault();
                  move(e, ev.key);
                }
              }}
              aria-label={`${e.name}, ${e.symbol}, atomic number ${e.z}`}
              title={`${e.name} · ${fmtMass(e)}`}
            >
              <span className="pt-z">{e.z}</span>
              <span className="pt-sym">{e.symbol}</span>
              <span className="pt-name">{e.name}</span>
            </button>
          ))}
          <span className="pt-gap-label" style={{ gridRow: 6, gridColumn: 3 }} aria-hidden="true">
            57–71
          </span>
          <span className="pt-gap-label" style={{ gridRow: 7, gridColumn: 3 }} aria-hidden="true">
            89–103
          </span>
          <span className="pt-spacer" style={{ gridRow: 8, gridColumn: '1 / -1' }} aria-hidden="true" />
        </div>

        <aside className={`pt-detail ${shown ? '' : 'is-empty'}`} aria-live="polite">
          {shown ? (
            <>
              <div className={`pt-card cat-${shown.category}`}>
                <span className="pt-z">{shown.z}</span>
                <span className="pt-card-sym">{shown.symbol}</span>
                <span className="pt-card-mass">{fmtMass(shown)}</span>
              </div>
              <div className="pt-info">
                <div className="pt-info-name">
                  {shown.name}
                  {selected && (
                    <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={() => update({ selected: null })} aria-label="Clear selection">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="pt-info-cat">{CATEGORY_LABEL[shown.category]}</div>
                <dl className="pt-facts">
                  <dt>Atomic number</dt>
                  <dd>{shown.z}</dd>
                  <dt>Atomic mass</dt>
                  <dd>
                    {fmtMass(shown)}
                    {!shown.stable && <span className="muted small"> longest-lived isotope</span>}
                  </dd>
                  <dt>Period · group</dt>
                  <dd>
                    {shown.period} · {shown.group ?? (shown.category === 'lanthanide' ? 'lanthanides' : 'actinides')}
                  </dd>
                  <dt>Block</dt>
                  <dd>{block(shown)}</dd>
                  <dt>Electrons</dt>
                  <dd>
                    <Config text={electronConfig(shown.z)} />
                    {shown.z >= 104 && <span className="muted small"> (predicted)</span>}
                  </dd>
                </dl>
                {selected && (
                  <div className="pt-actions">
                    <button type="button" className="btn btn-sm" onClick={() => copyText(`${shown.name} (${shown.symbol}), Z = ${shown.z}, ${fmtMass(shown)}`, 'Copied')}>
                      <Copy size={13} /> Copy
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => decay(shown)} title="Open in the nuclear decay tool">
                      <Atom size={13} /> Decay it
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="muted small">Point at an element to peek; click to pin it.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
