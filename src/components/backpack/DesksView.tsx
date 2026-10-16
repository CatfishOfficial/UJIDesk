import { useMemo, useState } from 'react';
import { Copy, FilePlus2, MoreHorizontal, Pencil, Save, Trash2 } from 'lucide-react';
import { useWorkspace } from '../../state/store';
import { useUI } from '../../state/ui';
import { boardIsEmpty, deleteDesk, duplicateDesk, newDesk, openDesk, renameDesk, saveDesk, saveDeskAsNew, useDesks, type DeskSnapshot, type SavedDesk } from '../../state/desks';
import { TOOLS } from '../../data/tools';
import { TOOL_ICONS } from '../ui/icons';
import { ContextMenu, MenuItem, MenuSeparator } from '../ui/ContextMenu';

export function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? 'yesterday' : `${d} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function summary(s: Pick<DeskSnapshot, 'windows' | 'strokes' | 'stickers'>): string {
  const n = Object.keys(s.windows).length;
  const parts = [n ? `${n} window${n === 1 ? '' : 's'}` : 'no windows'];
  if (s.strokes.length) parts.push('ink');
  if (s.stickers.length) parts.push(`${s.stickers.length} sticker${s.stickers.length === 1 ? '' : 's'}`);
  return parts.join(', ');
}

/** A tiny map of the desk: where its windows sit. */
function Thumb({ snap }: { snap: DeskSnapshot }) {
  const { w, h } = snap.viewport;
  const wins = Object.values(snap.windows).filter((x) => !x.minimized);
  return (
    <svg className="desk-thumb" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x={0} y={0} width={w} height={h} className="desk-thumb-board" />
      {snap.strokes.slice(0, 40).map((st) => {
        const p = st.pts;
        if (p.length < 6) return null;
        const d = [];
        for (let i = 0; i < p.length; i += Math.max(3, Math.floor(p.length / 60) * 3)) d.push(`${i ? 'L' : 'M'}${p[i]},${p[i + 1]}`);
        return <path key={st.id} d={d.join(' ')} className="desk-thumb-ink" />;
      })}
      {wins
        .sort((a, b) => a.z - b.z)
        .map((x) => {
          const bare = TOOLS[x.type].chrome === 'bare';
          const height = bare && TOOLS[x.type].aspect ? x.w / TOOLS[x.type].aspect! : x.h;
          return x.maximized ? (
            <rect key={x.id} x={0} y={0} width={w} height={h} className="desk-thumb-win" />
          ) : (
            <rect key={x.id} x={x.x} y={x.y} width={x.w} height={height} rx={bare ? height / 2.4 : 14} className={`desk-thumb-win ${bare ? 'is-item' : ''}`} />
          );
        })}
      {snap.stickers.map((k) => {
        // Stuck stickers are stored relative to their window.
        const host = k.on ? snap.windows[k.on] : undefined;
        if (k.on && (!host || host.minimized)) return null;
        return <circle key={k.id} cx={(host?.x ?? 0) + k.x} cy={(host?.y ?? 0) + k.y} r={22} className="desk-thumb-sticker" />;
      })}
    </svg>
  );
}

function Icons({ snap }: { snap: DeskSnapshot }) {
  const types = [...new Set(Object.values(snap.windows).map((w) => w.type))].slice(0, 5);
  return (
    <span className="desk-icons" aria-hidden="true">
      {types.map((t) => {
        const I = TOOL_ICONS[t];
        return <I key={t} size={16} />;
      })}
    </span>
  );
}

export function DesksView() {
  const desks = useDesks((s) => s.desks);
  const deskId = useWorkspace((s) => s.deskId);
  const windows = useWorkspace((s) => s.windows);
  const strokes = useWorkspace((s) => s.strokes);
  const stickers = useWorkspace((s) => s.stickers);
  const setBackpack = useUI((s) => s.setBackpack);
  const toast = useUI((s) => s.toast);
  const current = desks.find((d) => d.id === deskId) ?? null;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState<{ desk: SavedDesk; x: number; y: number } | null>(null);
  const board = useMemo(() => ({ windows, strokes, stickers }), [windows, strokes, stickers]);
  const others = desks.filter((d) => d.id !== deskId);

  const startRename = (d: SavedDesk) => {
    setRenaming(d.id);
    setDraft(d.name);
  };
  const finishRename = () => {
    if (renaming) renameDesk(renaming, draft);
    setRenaming(null);
  };

  return (
    <div className="bag-view desks">
      <h3 className="bag-h3">Desks</h3>
      <p className="muted small">Save the whole board (windows, ink, stickers) and come back to it. Switching desks keeps the one you leave.</p>

      <section className="desk-current" aria-label="The desk on the board">
        <div className="desk-current-head">
          <span className="desk-label">On the board</span>
          {current ? <span className="muted small">saved {ago(current.updatedAt)}</span> : <span className="muted small">not saved as a desk yet</span>}
        </div>
        {current && renaming === current.id ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              finishRename();
            }}
          >
            <input className="field desk-name-input" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={finishRename} aria-label="Desk name" maxLength={60} />
          </form>
        ) : (
          <button type="button" className="desk-current-name" onClick={() => (current ? startRename(current) : undefined)} disabled={!current} title={current ? 'Rename' : undefined}>
            {current?.name ?? 'Unsaved desk'}
            {current && <Pencil size={12} aria-hidden="true" />}
          </button>
        )}
        <p className="muted small desk-summary">{summary(board)}</p>
        <div className="desk-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              const d = saveDesk();
              toast(`Saved ${d.name}.`);
            }}
          >
            <Save size={13} /> {current ? 'Save' : 'Save as a desk'}
          </button>
          {current && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                const d = saveDeskAsNew();
                toast(`Saved a copy as ${d.name}.`);
              }}
            >
              <Copy size={13} /> Save as new
            </button>
          )}
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => {
              newDesk();
              setBackpack(false);
            }}
            disabled={boardIsEmpty(board) && !current}
            title="Start a clean board. What's on this one is kept."
          >
            <FilePlus2 size={13} /> New desk
          </button>
        </div>
      </section>

      {others.length > 0 ? (
        <ul className="desk-list" aria-label="Saved desks">
          {others.map((d) => (
            <li key={d.id} className="desk-item">
              <button
                type="button"
                className="desk-open"
                onClick={() => {
                  openDesk(d.id);
                  setBackpack(false);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ desk: d, x: e.clientX, y: e.clientY });
                }}
                title={`Open ${d.name}`}
              >
                <Thumb snap={d.snapshot} />
                <span className="desk-meta">
                  {renaming === d.id ? (
                    <input
                      className="field desk-name-input"
                      autoFocus
                      value={draft}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') finishRename();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={finishRename}
                      aria-label="Desk name"
                      maxLength={60}
                    />
                  ) : (
                    <span className="desk-name">{d.name}</span>
                  )}
                  <span className="muted small">
                    {ago(d.updatedAt)} · {summary(d.snapshot)}
                  </span>
                  <Icons snap={d.snapshot} />
                </span>
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-sm btn-icon desk-more"
                aria-label={`More for ${d.name}`}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setMenu({ desk: d, x: r.left, y: r.bottom + 4 });
                }}
              >
                <MoreHorizontal size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="desk-empty hand">{desks.length ? 'This is your only desk so far.' : 'No saved desks yet. Save this one to start a collection.'}</p>
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} label={`${menu.desk.name} options`} onClose={() => setMenu(null)}>
          <MenuItem
            onSelect={() => {
              setMenu(null);
              openDesk(menu.desk.id);
              setBackpack(false);
            }}
          >
            Open
          </MenuItem>
          <MenuItem
            icon={<Pencil size={13} />}
            onSelect={() => {
              setMenu(null);
              startRename(menu.desk);
            }}
          >
            Rename
          </MenuItem>
          <MenuItem
            icon={<Copy size={13} />}
            onSelect={() => {
              setMenu(null);
              duplicateDesk(menu.desk.id);
            }}
          >
            Duplicate
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={<Trash2 size={13} />}
            onSelect={() => {
              setMenu(null);
              deleteDesk(menu.desk.id);
            }}
          >
            Delete
          </MenuItem>
        </ContextMenu>
      )}
    </div>
  );
}
