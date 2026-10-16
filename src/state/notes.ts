import { create } from 'zustand';
import { uid, useWorkspace } from './store';
import { useUI } from './ui';

/** One stroke of scratchpad ink: flat [x, y, pressure, …] samples in pad pixels. */
export interface PadStroke {
  id: string;
  color: string;
  pts: number[];
}

/**
 * A saved scratchpad page: its text and its sketches, kept by name so it can be
 * opened again later (and on other devices, once signed in). The pad's size when
 * it was saved lets a preview wrap the text and place the ink the way they were.
 */
export interface SavedNote {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  text: string;
  strokes: PadStroke[];
  size: { w: number; h: number };
}

/** What a scratchpad hands over to be saved. */
export interface PadPage {
  text: string;
  strokes: PadStroke[];
  size: { w: number; h: number };
  /** The note this pad was opened from or last saved to, if any. */
  noteId?: string;
}

const KEY = 'uji.notes';

export const localNoteStorage = {
  read(): SavedNote[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { version: number; notes: SavedNote[] } | null;
      return Array.isArray(parsed?.notes) ? parsed!.notes : [];
    } catch {
      return [];
    }
  },
  write(notes: SavedNote[]) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, notes }));
    } catch {
      useUI.getState().toast("Couldn't save notes: browser storage is full. Delete an old note or desk to make room.");
    }
  },
};

export const useNotes = create<{ notes: SavedNote[] }>()(() => ({ notes: typeof localStorage === 'undefined' ? [] : localNoteStorage.read() }));

// Notes saved in another tab of UJI show up here too, rather than this tab writing its old list over them.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) useNotes.setState({ notes: localNoteStorage.read() });
  });
}

const commit = (notes: SavedNote[]) => {
  useNotes.setState({ notes });
  localNoteStorage.write(notes);
};

/** Swaps the whole list at once: account sync, after merging this device's notes with the account's. */
export function replaceNotes(notes: SavedNote[]) {
  commit(notes);
}

export const pageIsEmpty = (p: { text: string; strokes: PadStroke[] }) => !p.text.trim() && !p.strokes.length;

/** Whether a pad still matches the note it's linked to. Ink is only ever added, erased or cleared, so stroke ids tell. */
export function samePage(note: Pick<SavedNote, 'text' | 'strokes'>, pad: { text: string; strokes: PadStroke[] }): boolean {
  return note.text === pad.text && note.strokes.length === pad.strokes.length && note.strokes.every((s, i) => s.id === pad.strokes[i].id);
}

/** A new note's name: its first line of text, or "Doodle 3" (the first free number) for a page of sketches. */
export function nameFor(text: string, notes: SavedNote[] = useNotes.getState().notes): string {
  const first = text
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (first) return first.length > 40 ? `${first.slice(0, 39).trimEnd()}…` : first;
  const taken = new Set(notes.map((n) => n.name));
  for (let i = 1; ; i++) if (!taken.has(`Doodle ${i}`)) return `Doodle ${i}`;
}

/** Whether a note matches a search, by name or anything written on it. */
export function noteMatches(note: SavedNote, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || note.name.toLowerCase().includes(q) || note.text.toLowerCase().includes(q);
}

/** Saves a page into the note it came from, or as a new one. Newest first, like the list shows. */
export function saveNote(page: PadPage): SavedNote {
  const notes = useNotes.getState().notes;
  const now = Date.now();
  const existing = page.noteId ? notes.find((n) => n.id === page.noteId) : undefined;
  const note: SavedNote = existing
    ? { ...existing, text: page.text, strokes: page.strokes, size: page.size, updatedAt: now }
    : { id: uid('note'), name: nameFor(page.text, notes), createdAt: now, updatedAt: now, text: page.text, strokes: page.strokes, size: page.size };
  commit([note, ...notes.filter((n) => n.id !== note.id)]);
  return note;
}

/** Opens a note in a scratchpad: the one already showing it (unsaved changes and all), or a new one. */
export function openNote(id: string): string | null {
  const note = useNotes.getState().notes.find((n) => n.id === id);
  if (!note) return null;
  const ws = useWorkspace.getState();
  const showing = Object.values(ws.windows).find((w) => w.type === 'scratchpad' && w.data.noteId === id);
  if (showing) {
    ws.restore(showing.id);
    return showing.id;
  }
  // A page of only sketches opens ready to keep sketching.
  const mode = !note.text.trim() && note.strokes.length ? 'pen' : 'type';
  return ws.openWindow('scratchpad', { data: { text: note.text, strokes: note.strokes, noteId: note.id, mode } });
}

export function renameNote(id: string, name: string) {
  const n = name.trim();
  if (!n) return;
  // A rename is a change: account sync keeps whichever copy of a note was changed last.
  commit(useNotes.getState().notes.map((x) => (x.id === id ? { ...x, name: n.slice(0, 60), updatedAt: Date.now() } : x)));
}

export function duplicateNote(id: string) {
  const notes = useNotes.getState().notes;
  const n = notes.find((x) => x.id === id);
  if (!n) return;
  const now = Date.now();
  commit([{ ...n, id: uid('note'), name: `${n.name} copy`.slice(0, 60), createdAt: now, updatedAt: now }, ...notes]);
}

/** Deletes a note, with Undo. A scratchpad showing it keeps its page; saving it again makes a new note. */
export function deleteNote(id: string) {
  const notes = useNotes.getState().notes;
  const n = notes.find((x) => x.id === id);
  if (!n) return;
  commit(notes.filter((x) => x.id !== id));
  useUI.getState().toast(`Deleted ${n.name}.`, {
    label: 'Undo',
    run: () => commit([n, ...useNotes.getState().notes.filter((x) => x.id !== n.id)].sort((a, b) => b.updatedAt - a.updatedAt)),
  });
}
