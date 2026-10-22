import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eraser, FolderOpen, PenLine, Save, Type, Trash2 } from 'lucide-react';
import { useWindowData, useWorkspace, uid } from '../../state/store';
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
  const textRef = useRef<HTMLTextAreaElement>(null);
  const mode = data.mode ?? 'type';
  const color = data.color ?? 'graphite';
  const strokes = data.strokes ?? [];
  const text = data.text ?? '';

  // A fresh pad is ready to type in, without the browser scrolling anything to show it.
  useEffect(() => {
    if (mode === 'type' && !text) textRef.current?.focus({ preventScroll: true });
  }, []);

  // Finished strokes only change when one is added or erased, not on every pointer move.
  const inked = useMemo(() => strokes.map((s) => ({ id: s.id, d: freehandPath(s.pts, 3.2), fill: INKS[s.color] ?? INKS.graphite })), [strokes]);
  // The page runs at least a couple of lines past the lowest ink, so there's always room to keep sketching.
  const inkBottom = useMemo(() => strokes.reduce((m, s) => s.pts.reduce((mm, v, i) => (i % 3 === 1 ? Math.max(mm, v) : mm), m), 0), [strokes]);

  /** Pointer position on the page (which scrolls inside the surface). */
  const local = (e: React.PointerEvent) => {
    const r = surface.current!.getBoundingClientRect();
    return [e.clientX - r.left + surface.current!.scrollLeft, e.clientY - r.top + surface.current!.scrollTop];
  };

  const erase = (x: number, y: number) => {
    // Read the live strokes, not this render's: a quick sweep can hit two before React re-renders,
    // and filtering a stale list brought the first one back.
    const now = (useWorkspace.getState().windows[winId]?.data.strokes as PadStroke[] | undefined) ?? [];
    const keep = now.filter((s) => !strokeHit(s.pts, x, y, 8));
    if (keep.length !== now.length) update({ strokes: keep });
  };

  const endStroke = (keepIt: boolean) => {
    const pts = liveRef.current;
    liveRef.current = null;
    setLive(null);
    if (keepIt && pts && pts.length >= 3) {
      const now = (useWorkspace.getState().windows[winId]?.data.strokes as PadStroke[] | undefined) ?? [];
      update({ strokes: [...now, { id: uid('ps'), color, pts: pts.map((n) => Math.round(n * 10) / 10) }] });
    }
  };

  const clear = () => {
    const before = { text: data.text, strokes };
    update({ text: '', strokes: [] });
    toast('Page cleared.', { label: 'Undo', run: () => update(before) });
  };

  const page = { text, strokes };
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
          // No text selection or focus change while sketching.
          e.preventDefault();
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
        onPointerUp={() => endStroke(true)}
        // A cancelled touch (palm, scroll, alert) used to leave its half-drawn line on the page for good.
        onPointerCancel={() => endStroke(false)}
      >
        {/*
          The page grows with what's on it and the surface scrolls it, so the ruled lines,
          the margin, the text and the ink always move together. The textarea never scrolls
          on its own: its height comes from a hidden copy of the text (.pad-page::after).
        */}
        <div className="pad-page" data-text={text} style={inkBottom ? { minHeight: `max(100%, ${Math.ceil(inkBottom) + 56}px)` } : undefined}>
          <textarea
            ref={textRef}
            className="pad-text"
            value={text}
            onChange={(e) => update({ text: e.target.value })}
            placeholder="Work it out here…"
            aria-label="Scratchpad text"
            spellCheck={false}
            readOnly={mode !== 'type'}
            tabIndex={mode === 'type' ? 0 : -1}
          />
          <svg className="pad-ink" aria-hidden="true">
            {inked.map((s) => (
              <path key={s.id} d={s.d} fill={s.fill} />
            ))}
            {live && <path d={freehandPath(live, 3.2)} fill={INKS[color]} />}
          </svg>
        </div>
      </div>
    </div>
  );
}
