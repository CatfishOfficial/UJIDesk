import { useId, useMemo, useState } from 'react';
import { Copy, FilePlus2, MoreHorizontal, Pencil, Search, Trash2 } from 'lucide-react';
import { useWorkspace } from '../../state/store';
import { useUI } from '../../state/ui';
import { deleteNote, duplicateNote, noteMatches, openNote, renameNote, useNotes, type SavedNote } from '../../state/notes';
import { INKS, freehandPath } from '../drawing/ink';
import { ContextMenu, MenuItem, MenuSeparator } from '../ui/ContextMenu';
import { ago } from './DesksView';

/** The pad's lines and margin, in pad pixels, so the miniature matches the real page. */
const LINE = 28;
const MARGIN = 34;

/**
 * A miniature of the page as it was saved: lined paper, the text wrapped at the
 * width it was written at, and the ink on top. Shows the top of the page at the
 * card's 4:3 shape, scaled as one picture so text and sketches stay lined up.
 */
function NoteThumb({ note }: { note: SavedNote }) {
  const id = useId();
  const w = Math.max(200, note.size?.w ?? 380);
  const h = Math.round(w * 0.75);
  const paths = useMemo(() => (note.strokes ?? []).map((s) => ({ id: s.id, d: freehandPath(s.pts, 3.2), fill: INKS[s.color] ?? INKS.graphite })), [note.strokes]);
  return (
    <svg className="note-thumb" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <defs>
        <pattern id={`${id}-lines`} width={w} height={LINE} patternUnits="userSpaceOnUse">
          <rect width={w} height={LINE} className="note-thumb-paper" />
          <rect y={LINE - 1} width={w} height={1} className="note-thumb-line" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}-lines)`} />
      <rect x={MARGIN} width={1} height={h} className="note-thumb-margin" />
      {note.text && (
        <foreignObject width={w} height={h}>
          <div className="note-thumb-text">{note.text}</div>
        </foreignObject>
      )}
      {paths.map((p) => (
        <path key={p.id} d={p.d} style={{ fill: p.fill }} />
      ))}
    </svg>
  );
}

/** "3 lines, a sketch": what's on a page, at a glance. */
function contents(n: SavedNote): string {
  const lines = n.text.split('\n').filter((l) => l.trim()).length;
  const parts: string[] = [];
  if (lines) parts.push(`${lines} line${lines === 1 ? '' : 's'}`);
  if (n.strokes.length) parts.push(n.strokes.length === 1 ? 'a sketch' : 'sketches');
  return parts.join(', ') || 'empty';
}

export function NotesView() {
  const notes = useNotes((s) => s.notes);
  const setBackpack = useUI((s) => s.setBackpack);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState<{ note: SavedNote; x: number; y: number } | null>(null);
  const shown = useMemo(() => notes.filter((n) => noteMatches(n, query)).sort((a, b) => b.updatedAt - a.updatedAt), [notes, query]);

  const open = (id: string) => {
    openNote(id);
    setBackpack(false);
  };
  const startRename = (n: SavedNote) => {
    setRenaming(n.id);
    setDraft(n.name);
  };
  const finishRename = () => {
    if (renaming) renameNote(renaming, draft);
    setRenaming(null);
  };

  return (
    <div className="bag-view notes">
      <h3 className="bag-h3">Notes</h3>
      <p className="muted small">Scratchpad pages you’ve saved, text and sketches. Open one to pick up where you left off. Press Save in any scratchpad to add one.</p>

      <div className="notes-bar">
        {notes.length > 3 && (
          <label className="notes-search">
            <Search size={14} aria-hidden="true" />
            <input className="field" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes" />
          </label>
        )}
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            useWorkspace.getState().openWindow('scratchpad');
            setBackpack(false);
          }}
        >
          <FilePlus2 size={13} /> New page
        </button>
      </div>

      {shown.length > 0 ? (
        <ul className="note-grid" aria-label="Saved notes">
          {shown.map((n) => (
            <li key={n.id} className="note-card">
              <button
                type="button"
                className="note-open"
                onClick={() => open(n.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ note: n, x: e.clientX, y: e.clientY });
                }}
                title={`Open ${n.name}`}
              >
                <NoteThumb note={n} />
                <span className="note-meta">
                  {renaming === n.id ? (
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
                      aria-label="Note name"
                      maxLength={60}
                    />
                  ) : (
                    <span className="note-name">{n.name}</span>
                  )}
                  <span className="muted small">
                    {ago(n.updatedAt)} · {contents(n)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-sm btn-icon note-more"
                aria-label={`More for ${n.name}`}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setMenu({ note: n, x: r.left, y: r.bottom + 4 });
                }}
              >
                <MoreHorizontal size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="desk-empty hand">{notes.length ? 'No notes match that.' : 'No saved notes yet. Press Save in a scratchpad to keep a page here.'}</p>
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} label={`${menu.note.name} options`} onClose={() => setMenu(null)}>
          <MenuItem
            onSelect={() => {
              setMenu(null);
              open(menu.note.id);
            }}
          >
            Open
          </MenuItem>
          <MenuItem
            icon={<Pencil size={13} />}
            onSelect={() => {
              setMenu(null);
              startRename(menu.note);
            }}
          >
            Rename
          </MenuItem>
          <MenuItem
            icon={<Copy size={13} />}
            onSelect={() => {
              setMenu(null);
              duplicateNote(menu.note.id);
            }}
          >
            Duplicate
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={<Trash2 size={13} />}
            onSelect={() => {
              setMenu(null);
              deleteNote(menu.note.id);
            }}
          >
            Delete
          </MenuItem>
        </ContextMenu>
      )}
    </div>
  );
}
