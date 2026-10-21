import { Fragment, useMemo, useRef, useState } from 'react';
import { Atom, Copy, Orbit, Search, X } from 'lucide-react';
import { useWindowData, useWorkspace } from '../state/store';
import { CATEGORY_LABEL, ELEMENTS, blockOf, electronConfig, elementList, type Category, type Element } from './elements';
import { copyText } from '../components/tools/bridge';

interface TableData extends Record<string, unknown> {
  /** Atomic numbers of the picked elements, in the order picked. Older saves hold one number. */
  selected: number[] | number | null;
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
const caption = (e: Element) => `${e.name} (${e.symbol}), Z = ${e.z}, ${fmtMass(e)}`;

/** The search text for a picked list; a lone element keeps its comma so the box stays a list. */
const listText = (zs: number[]) => (zs.length === 1 ? `${ELEMENTS[zs[0] - 1].symbol},` : zs.map((z) => ELEMENTS[z - 1].symbol).join(', '));

export function PeriodicTableTool({ winId }: { winId: string }) {
  const [d, update] = useWindowData<TableData>(winId);
  const openWindow = useWorkspace((s) => s.openWindow);
  const updateData = useWorkspace((s) => s.updateData);
  const restore = useWorkspace((s) => s.restore);
  const gridRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const q = (d.q ?? '').trim().toLowerCase();
  /** "Fe, Cu, O" in the search box picks those elements instead of filtering. */
  const isList = q.includes(',');
  const picked = useMemo(() => (Array.isArray(d.selected) ? d.selected : d.selected ? [d.selected] : []), [d.selected]);
  const pickedEls = picked.map((z) => ELEMENTS[z - 1]).filter(Boolean);
  const selected = pickedEls.length === 1 ? pickedEls[0] : null;
  const shown = pickedEls.length > 1 ? null : (selected ?? (hover ? ELEMENTS[hover - 1] : null));

  const matches = useMemo(() => {
    if (!q || isList) return null;
    return new Set(
      ELEMENTS.filter((e) => e.symbol.toLowerCase() === q || e.name.toLowerCase().includes(q) || String(e.z) === q).map((e) => e.z),
    );
  }, [q, isList]);

  const dimmed = (e: Element) =>
    isList ? !picked.includes(e.z) : matches ? !matches.has(e.z) : d.highlight ? e.category !== d.highlight : false;

  const search = (text: string) =>
    update(text.includes(',') ? { q: text, selected: elementList(text).map((e) => e.z), highlight: null } : { q: text });

  /** A click picks just this element (or unpicks it); shift-click adds it to, or takes it out of, the picked set. */
  const pick = (z: number, add: boolean) => {
    const next = add
      ? picked.includes(z)
        ? picked.filter((p) => p !== z)
        : [...picked, z]
      : picked.length === 1 && picked[0] === z
        ? []
        : [z];
    // A typed list follows shift-clicks; a plain click starts over.
    update({ selected: next, ...(isList ? { q: add && next.length ? listText(next) : '' } : {}) });
  };

  const clear = () => update({ selected: [], ...(isList ? { q: '' } : {}) });

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
  /** Sends the element to the electron configuration solver, reusing an open one (and keeping its Long/Short choice). */
  const electrons = (e: Element) => {
    const existing = Object.values(useWorkspace.getState().windows).find((w) => w.type === 'electronConfig');
    const form = ((existing?.data.inputs as Record<string, string> | undefined)?.form ?? 'long') as string;
    const inputs = { el: e.symbol, charge: '', form };
    if (existing) {
      updateData(existing.id, { inputs, autoSolve: true });
      restore(existing.id);
    } else openWindow('electronConfig', { data: { inputs, autoSolve: true }, near: winId });
  };

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
          <span className="sr-only">Find an element, or list several separated by commas</span>
          <input
            type="search"
            value={d.q ?? ''}
            onChange={(e) => search(e.target.value)}
            placeholder="Find, or list: Fe, Cu, O"
            title="Type one element to find it, or several separated by commas to pick them all"
          />
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
              className={`pt-el cat-${e.category} ${dimmed(e) ? 'is-dim' : ''} ${picked.includes(e.z) ? 'is-selected' : ''}`}
              style={{ gridRow: e.row, gridColumn: e.col }}
              onClick={(ev) => pick(e.z, ev.shiftKey || ev.ctrlKey || ev.metaKey)}
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

        <aside className={`pt-detail ${shown || pickedEls.length ? '' : 'is-empty'} ${pickedEls.length > 1 ? 'is-multi' : ''}`} aria-live="polite">
          {pickedEls.length > 1 ? (
            <div className="pt-multi">
              <div className="pt-info-name">
                {pickedEls.length} elements
                <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={clear} aria-label="Clear selection">
                  <X size={13} />
                </button>
              </div>
              <ul className="pt-picks">
                {pickedEls.map((e) => (
                  <li key={e.z} className="pt-pick">
                    <span className={`pt-mini cat-${e.category}`} aria-hidden="true">
                      <span className="pt-z">{e.z}</span>
                      {e.symbol}
                    </span>
                    <div className="pt-pick-text">
                      <div className="pt-pick-name">{e.name}</div>
                      <div className="pt-pick-facts">
                        {fmtMass(e)} · {blockOf(e)}-block · {CATEGORY_LABEL[e.category]}
                      </div>
                      <button type="button" className="pt-config-link pt-pick-config" onClick={() => electrons(e)} title="Open in the electron configuration solver">
                        <Config text={electronConfig(e.z)} />
                      </button>
                    </div>
                    <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={() => pick(e.z, true)} aria-label={`Unpick ${e.name}`}>
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="pt-actions">
                <button type="button" className="btn btn-sm" onClick={() => copyText(pickedEls.map(caption).join('\n'), 'Copied')}>
                  <Copy size={13} /> Copy all
                </button>
              </div>
            </div>
          ) : shown ? (
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
                    <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={clear} aria-label="Clear selection">
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
                  <dd>{blockOf(shown)}</dd>
                  <dt>Electrons</dt>
                  <dd>
                    <button type="button" className="pt-config-link" onClick={() => electrons(shown)} title="Open in the electron configuration solver: long and short forms, steps, orbital boxes">
                      <Config text={electronConfig(shown.z)} />
                    </button>
                    {shown.z >= 104 && <span className="muted small"> (predicted)</span>}
                  </dd>
                </dl>
                {selected && (
                  <div className="pt-actions">
                    <button type="button" className="btn btn-sm" onClick={() => copyText(caption(shown), 'Copied')}>
                      <Copy size={13} /> Copy
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => electrons(shown)} title="Work out its electron configuration, long and short, with steps">
                      <Orbit size={13} /> Electrons
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => decay(shown)} title="Open in the nuclear decay tool">
                      <Atom size={13} /> Decay it
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="muted small">
              Point at an element to peek; click to pin it. Shift-click to pick several, or search a list like <b>Fe, Cu, O</b>.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
