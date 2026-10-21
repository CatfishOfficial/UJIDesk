import { Fragment, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Atom, Copy, Orbit, Search, X } from 'lucide-react';
import { useWindowData, useWorkspace } from '../state/store';
import { CATEGORY_LABEL, ELEMENTS, blockOf, electronConfig, elementList, type Category, type Element } from './elements';
import { TRENDS, TREND_KEYS, compareTrend, fmtTrend, trendRange, trendValue, type Trend, type TrendComparison } from './trends';
import { copyText } from '../components/tools/bridge';
import { Seg } from '../components/tools/problem/fields';

type Overlay = 'category' | 'block' | Trend;

interface TableData extends Record<string, unknown> {
  /** Atomic numbers of the picked elements, in the order picked. Older saves hold one number. */
  selected: number[] | number | null;
  q: string;
  /** Highlighted categories or blocks, whichever the overlay shows. Older saves hold one category. */
  highlight: string[] | string | null;
  overlay?: Overlay;
  /** What the panel shows when several elements are picked. */
  compare?: Trend | 'details';
}

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];
const BLOCKS = ['s', 'p', 'd', 'f'] as const;
const isTrend = (o: Overlay | 'details'): o is Trend => o in TRENDS;

const OVERLAYS: { id: Overlay; label: string; title: string }[] = [
  { id: 'category', label: 'Category', title: 'Color by kind of element: alkali metal, halogen…' },
  { id: 'block', label: 'Block', title: 'Color by the subshell being filled: s, p, d or f' },
  ...TREND_KEYS.map((t) => ({ id: t, label: TRENDS[t].short, title: `Shade by ${TRENDS[t].label.toLowerCase()}` })),
];

const FACT_LABEL: Record<Trend, string> = { radius: 'Atomic radius', en: 'Electronegativity', ie: '1st ionization' };

/** Overlay shading: nine steps of one hue, light to dark (the steps are theme tokens in tools.css). */
const HEAT_STEPS = 9;
const RANGES = Object.fromEntries(TREND_KEYS.map((t) => [t, trendRange(t)])) as Record<Trend, [number, number]>;
const heatStep = (t: Trend, v: number) => {
  const [lo, hi] = RANGES[t];
  return Math.min(HEAT_STEPS - 1, Math.floor(((v - lo) / (hi - lo)) * HEAT_STEPS));
};

/** Plain click: just this one (or none, if it was the only one). Shift-click: add it, or take it out. */
function toggle<T>(list: T[], x: T, add: boolean): T[] {
  if (add) return list.includes(x) ? list.filter((y) => y !== x) : [...list, x];
  return list.length === 1 && list[0] === x ? [] : [x];
}

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

const rankHead = (t: Trend) => `${TRENDS[t].label}, ${t === 'radius' ? 'smallest to largest' : 'lowest to highest'}`;

/** "Atomic radius, smallest to largest: O (48 pm) < Cu (145 pm) < Fe (156 pm)" */
function rankText(t: Trend, cmp: TrendComparison): string {
  const chain = cmp.order.map((e, i) => `${i ? (cmp.steps[i - 1].tie ? ' ≈ ' : ' < ') : ''}${e.symbol} (${fmtTrend(t, trendValue(t, e))})`).join('');
  const missing = cmp.missing.length ? `\nNo value for ${cmp.missing.map((e) => e.symbol).join(', ')}.` : '';
  return `${rankHead(t)}: ${chain}${missing}`;
}

function HeatLegend({ t }: { t: Trend }) {
  const [lo, hi] = RANGES[t];
  return (
    <div className="pt-heat-legend">
      <span>{fmtTrend(t, lo)}</span>
      <span className="pt-heat-bar" aria-hidden="true" />
      <span>{fmtTrend(t, hi)}</span>
      <span className="pt-heat-none">
        <i aria-hidden="true" /> no data
      </span>
      <span className="pt-heat-rule">{TRENDS[t].rule}</span>
    </div>
  );
}

/** Several picked elements, ranked by one trend, with the reason for each step up. */
function TrendRanking({ t, cmp, onUnpick }: { t: Trend; cmp: TrendComparison; onUnpick: (z: number) => void }) {
  const max = Math.max(...cmp.order.map((e) => trendValue(t, e)!));
  return (
    <div className="pt-rank">
      <div className="pt-rank-head">
        {rankHead(t)}
        {cmp.shared && <> · all in {cmp.shared}</>}
      </div>
      <ol className="pt-rank-list">
        {cmp.order.map((e) => {
          const v = trendValue(t, e)!;
          return (
            <li key={e.z} className="pt-rank-row">
              <span className={`pt-mini pt-mini-sm cat-${e.category}`} aria-hidden="true">
                {e.symbol}
              </span>
              <span className="pt-rank-name">{e.name}</span>
              <span className="pt-rank-val">{fmtTrend(t, v)}</span>
              <span className="pt-rank-bar" style={{ width: `${(v / max) * 100}%` }} aria-hidden="true" />
              <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={() => onUnpick(e.z)} aria-label={`Unpick ${e.name}`}>
                <X size={12} />
              </button>
            </li>
          );
        })}
      </ol>
      {cmp.order.length > 1 && (
        <p className="pt-rank-chain">
          {cmp.order.map((e, i) => (
            <Fragment key={e.z}>
              {i > 0 && (cmp.steps[i - 1].tie ? ' ≈ ' : ' < ')}
              {e.symbol}
            </Fragment>
          ))}
        </p>
      )}
      {cmp.steps.length > 0 && (
        <ul className="pt-why" aria-label="Why">
          {cmp.steps.map((s) => (
            <li key={`${s.from.z}-${s.to.z}`} className={s.exception ? 'is-exception' : ''}>
              {s.why}
            </li>
          ))}
        </ul>
      )}
      {cmp.missing.length > 0 && (
        <p className="muted small">
          No {TRENDS[t].label.toLowerCase()} for {cmp.missing.map((e) => e.name).join(', ')}. {TRENDS[t].source}
        </p>
      )}
      <p className="muted small">{TRENDS[t].rule}</p>
    </div>
  );
}

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

  const overlay: Overlay = d.overlay ?? 'category';
  const marks = Array.isArray(d.highlight) ? d.highlight : d.highlight ? [d.highlight] : [];
  const markOf = (e: Element): string => (overlay === 'block' ? blockOf(e) : e.category);
  const view = d.compare ?? (isTrend(overlay) ? overlay : 'radius');
  const cmp = pickedEls.length > 1 && isTrend(view) ? compareTrend(view, pickedEls) : null;

  const dimmed = (e: Element) =>
    isList ? !picked.includes(e.z) : matches ? !matches.has(e.z) : marks.length && !isTrend(overlay) ? !marks.includes(markOf(e)) : false;

  /** How a tile looks under the current overlay, and the value it shows for a trend. */
  const look = (e: Element): { cls: string; style?: CSSProperties; value?: string } => {
    if (overlay === 'category') return { cls: `cat-${e.category}` };
    if (overlay === 'block') return { cls: `blk-${blockOf(e)}` };
    const v = trendValue(overlay, e);
    if (v === null) return { cls: 'is-nodata', value: '—' };
    const n = heatStep(overlay, v);
    const style = { '--heat-bg': `var(--heat-${n})`, '--heat-ink': `var(--heat-ink-${n >= 5 ? 'hi' : 'lo'})` } as CSSProperties;
    return { cls: 'is-heat', style, value: v.toFixed(TRENDS[overlay].digits) };
  };

  const search = (text: string) =>
    update(text.includes(',') ? { q: text, selected: elementList(text).map((e) => e.z), highlight: [] } : { q: text });

  const pick = (z: number, add: boolean) => {
    const next = toggle(picked, z, add);
    // A typed list follows shift-clicks; a plain click starts over.
    update({ selected: next, ...(isList ? { q: add && next.length ? listText(next) : '' } : {}) });
  };

  const mark = (k: string, add: boolean) => update({ highlight: toggle(marks, k, add), q: '' });

  /** Switching overlays drops the highlights (they belong to the old one) and points the comparer at a trend. */
  const setOverlay = (o: Overlay) => update({ overlay: o, highlight: [], ...(isTrend(o) ? { compare: o } : {}) });

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
        <Seg value={overlay} options={OVERLAYS} onChange={setOverlay} label="Color the table by" className="seg-sm pt-overlay" />
      </div>
      <div className="pt-legend" role="group" aria-label={isTrend(overlay) ? `${TRENDS[overlay].label} scale` : 'Highlight; shift-click for several'}>
        {isTrend(overlay) ? (
          <HeatLegend t={overlay} />
        ) : (
          (overlay === 'block' ? BLOCKS.map((b) => [b, `blk-${b}`, `${b}-block`]) : CATEGORIES.map((c) => [c, `cat-${c}`, CATEGORY_LABEL[c]])).map(([k, cls, label]) => (
            <button
              key={k}
              type="button"
              className={`pt-chip ${cls}`}
              aria-pressed={marks.includes(k)}
              onClick={(ev) => mark(k, ev.shiftKey || ev.ctrlKey || ev.metaKey)}
              title="Click to highlight; shift-click to highlight several"
            >
              {label}
            </button>
          ))
        )}
      </div>

      <div className="pt-body">
        <div className="pt-grid" ref={gridRef} role="grid" aria-label="Periodic table">
          {ELEMENTS.map((e) => {
            const { cls, style, value } = look(e);
            return (
              <button
                key={e.z}
                type="button"
                data-z={e.z}
                className={`pt-el ${cls} ${dimmed(e) ? 'is-dim' : ''} ${picked.includes(e.z) ? 'is-selected' : ''}`}
                style={{ gridRow: e.row, gridColumn: e.col, ...style }}
                onClick={(ev) => pick(e.z, ev.shiftKey || ev.ctrlKey || ev.metaKey)}
                onMouseEnter={() => setHover(e.z)}
                onMouseLeave={() => setHover(null)}
                onKeyDown={(ev) => {
                  if (ev.key.startsWith('Arrow')) {
                    ev.preventDefault();
                    move(e, ev.key);
                  }
                }}
                aria-label={`${e.name}, ${e.symbol}, atomic number ${e.z}${isTrend(overlay) ? `, ${TRENDS[overlay].label.toLowerCase()} ${fmtTrend(overlay, trendValue(overlay, e))}` : ''}`}
                title={`${e.name} · ${isTrend(overlay) ? fmtTrend(overlay, trendValue(overlay, e)) : fmtMass(e)}`}
              >
                <span className="pt-z">{e.z}</span>
                <span className="pt-sym">{e.symbol}</span>
                {value !== undefined ? <span className="pt-val">{value}</span> : <span className="pt-name">{e.name}</span>}
              </button>
            );
          })}
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
              <Seg
                value={view}
                options={[
                  ...TREND_KEYS.map((t) => ({ id: t, label: TRENDS[t].short, title: `Rank them by ${TRENDS[t].label.toLowerCase()}` })),
                  { id: 'details' as const, label: 'Details', title: 'Mass, block and electron configuration of each' },
                ]}
                onChange={(v) => update({ compare: v })}
                label="Compare the picked elements by"
                className="seg-sm"
              />
              {cmp && isTrend(view) ? (
                <TrendRanking t={view} cmp={cmp} onUnpick={(z) => pick(z, true)} />
              ) : (
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
              )}
              <div className="pt-actions">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => copyText(cmp && isTrend(view) ? rankText(view, cmp) : pickedEls.map(caption).join('\n'), 'Copied')}
                >
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
                  {TREND_KEYS.map((t) => (
                    <Fragment key={t}>
                      <dt>{FACT_LABEL[t]}</dt>
                      <dd>{fmtTrend(t, trendValue(t, shown))}</dd>
                    </Fragment>
                  ))}
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
              Point at an element to peek; click to pin it. Shift-click to pick several, or search a list like <b>Fe, Cu, O</b>, to rank them by
              radius, electronegativity or ionization energy.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
