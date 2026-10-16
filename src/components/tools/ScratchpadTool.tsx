import { useRef, useState } from 'react';
import { Check, Eraser, FolderOpen, PenLine, Save, Type, Trash2 } from 'lucide-react';
import { useWindowData, uid } from '../../state/store';
import { useUI } from '../../state/ui';
import { pageIsEmpty, samePage, saveNote, useNotes, type PadStroke } from '../../state/notes';
import { INKS, freehandPath, strokeHit } from '../drawing/ink';

interface PadData extends Record<string, unknown> {
  text: string;
  strokes: PadStroke[];
  mode: 'type' | 'pen' | 'eraser';
  color?: string;
  /** The saved note this page was opened from or last saved to (see state/notes.ts). */
  noteId?: string;
}

/** Lined paper you can type on or sketch on, and save as a note to open again later. Clearing is separate from closing. */
export function ScratchpadTool({ winId }: { winId: string }) {
  const [data, update] = useWindowData<PadData>(winId);
  const toast = useUI((s) => s.toast);
  const setBackpack = useUI((s) => s.setBackpack);
  const note = useNotes((s) => (data.noteId ? s.notes.find((n) => n.id === data.noteId) : undefined));
  const [live, setLive] = useState<number[] | null>(null);
  const liveRef = useRef<number[] | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const mode = data.mode ?? 'type';
  const color = data.color ?? 'graphite';
  const strokes = data.strokes ?? [];

  const local = (e: React.PointerEvent) => {
    const r = surface.current!.getBoundingClientRect();
    return [e.clientX - r.left + surface.current!.scrollLeft, e.clientY - r.top + surface.current!.scrollTop];
  };

  const erase = (x: number, y: number) => {
    const keep = strokes.filter((s) => !strokeHit(s.pts, x, y, 8));
    if (keep.length !== strokes.length) update({ strokes: keep });
  };

  const clear = () => {
    const before = { text: data.text, strokes };
    update({ text: '', strokes: [] });
    toast('Page cleared.', { label: 'Undo', run: () => update(before) });
  };

  const page = { text: data.text ?? '', strokes };
  const saved = !!note && samePage(note, page);
  const save = () => {
    const el = surface.current;
    // The page's size goes with it, so a preview wraps the text and places the ink as they were here.
    const size = { w: el?.clientWidth ?? 380, h: Math.max(el?.scrollHeight ?? 0, el?.clientHeight ?? 0) };
    const n = saveNote({ ...page, size, noteId: data.noteId });
    if (n.id !== data.noteId) update({ noteId: n.id });
    toast(`Saved “${n.name}”.`, { label: 'See notes', run: () => setBackpack(true, 'notes') });
  };

  return (
    <div className="pad">
      <div className="pad-tools" role="toolbar" aria-label="Scratchpad tools">
        <div className="seg">
          <button type="button" aria-pressed={mode === 'type'} onClick={() => update({ mode: 'type' })} title="Type">
            <Type size={14} /> <span>Type</span>
          </button>
          <button type="button" aria-pressed={mode === 'pen'} onClick={() => update({ mode: 'pen' })} title="Sketch">
            <PenLine size={14} /> <span>Sketch</span>
          </button>
          <button type="button" aria-pressed={mode === 'eraser'} onClick={() => update({ mode: 'eraser' })} title="Erase sketches" aria-label="Eraser">
            <Eraser size={14} />
          </button>
        </div>
        {mode === 'pen' && (
          <div className="ink-swatches" role="radiogroup" aria-label="Ink color">
            {['graphite', 'periwinkle', 'coral', 'green'].map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                className="ink-swatch"
                style={{ '--c': INKS[c] } as React.CSSProperties}
                onClick={() => update({ color: c })}
              />
            ))}
          </div>
        )}
        <span className="pad-note" title={note ? `Saved note: ${note.name}` : undefined}>
          {note && (
            <>
              <span className="pad-note-name">{note.name}</span>
              {!saved && (
                <span className="pad-note-dot" aria-label="(unsaved changes)">
                  •
                </span>
              )}
            </>
          )}
        </span>
        <button
          type="button"
          className="btn btn-quiet btn-sm btn-icon"
          onClick={save}
          disabled={saved || pageIsEmpty(page)}
          aria-label={saved ? 'Saved' : note ? `Save changes to ${note.name}` : 'Save as a note'}
          title={saved ? 'Saved' : note ? `Save changes to “${note.name}”` : 'Save this page as a note'}
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
        </button>
        <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={() => setBackpack(true, 'notes')} aria-label="Saved notes" title="Saved notes">
          <FolderOpen size={14} />
        </button>
        <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={clear} disabled={!data.text && !strokes.length} aria-label="Clear this page" title="Clear page (you can undo)">
          <Trash2 size={14} />
        </button>
      </div>
      <div
        ref={surface}
        className={`pad-surface mode-${mode}`}
        onPointerDown={(e) => {
          if (mode === 'type' || e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const [x, y] = local(e);
          if (mode === 'eraser') return erase(x, y);
          liveRef.current = [x, y, e.pressure || 0.5];
          setLive(liveRef.current);
        }}
        onPointerMove={(e) => {
          if (mode === 'type' || !(e.buttons & 1)) return;
          const [x, y] = local(e);
          if (mode === 'eraser') return erase(x, y);
          if (!liveRef.current) return;
          liveRef.current = [...liveRef.current, x, y, e.pressure || 0.5];
          setLive(liveRef.current);
        }}
        onPointerUp={() => {
          if (liveRef.current && liveRef.current.length >= 3) {
            update({ strokes: [...strokes, { id: uid('ps'), color, pts: liveRef.current.map((n) => Math.round(n * 10) / 10) }] });
          }
          liveRef.current = null;
          setLive(null);
        }}
      >
        <textarea
          className="pad-text"
          value={data.text ?? ''}
          onChange={(e) => update({ text: e.target.value })}
          placeholder="Work it out here…"
          aria-label="Scratchpad text"
          spellCheck={false}
          readOnly={mode !== 'type'}
          autoFocus={mode === 'type' && !data.text}
          tabIndex={mode === 'type' ? 0 : -1}
        />
        <svg className="pad-ink" aria-hidden="true">
          {strokes.map((s) => (
            <path key={s.id} d={freehandPath(s.pts, 3.2)} fill={INKS[s.color] ?? INKS.graphite} />
          ))}
          {live && <path d={freehandPath(live, 3.2)} fill={INKS[color]} />}
        </svg>
      </div>
    </div>
  );
}
