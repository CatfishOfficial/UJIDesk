import { create } from 'zustand';
import { uid, useWorkspace } from './store';
import { useUI } from './ui';
import { viewport } from './placement';
import type { AssistMode, PlacedSticker, Stroke, Win } from './types';

/**
 * Saved desks: named snapshots of the whole board (windows and what's in
 * them, ink, stickers, help style). The board you're on is always live; a desk
 * is saved when you press Save and whenever you switch away, so switching
 * never loses work.
 *
 * Storage goes through `DeskStorage`. Today that's localStorage; accounts and
 * sync can swap in a remote adapter without touching the UI.
 */
export interface DeskSnapshot {
  windows: Record<string, Win>;
  zTop: number;
  strokes: Stroke[];
  stickers: PlacedSticker[];
  mode: AssistMode;
  /** Screen size when saved, for drawing the little preview. */
  viewport: { w: number; h: number };
}

export interface SavedDesk {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  snapshot: DeskSnapshot;
}

export interface DeskStorage {
  read(): SavedDesk[];
  write(desks: SavedDesk[]): void;
}

const KEY = 'uji.desks';

export const localDeskStorage: DeskStorage = {
  read() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? (JSON.parse(raw) as { version: number; desks: SavedDesk[] }) : null;
      return Array.isArray(parsed?.desks) ? parsed!.desks : [];
    } catch {
      return [];
    }
  },
  write(desks) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, desks }));
    } catch {
      useUI.getState().toast("Couldn't save desks: browser storage is full. Delete an old desk to make room.");
    }
  },
};

let storage: DeskStorage = localDeskStorage;
/** Swap where desks live (a sync adapter, or memory in tests). */
export function setDeskStorage(next: DeskStorage) {
  storage = next;
  useDesks.setState({ desks: storage.read() });
}

interface DesksState {
  desks: SavedDesk[];
}

export const useDesks = create<DesksState>()(() => ({ desks: typeof localStorage === 'undefined' ? [] : storage.read() }));

const commit = (desks: SavedDesk[]) => {
  useDesks.setState({ desks });
  storage.write(desks);
};

export function snapshotBoard(): DeskSnapshot {
  const s = useWorkspace.getState();
  const { vw, vh } = viewport();
  return {
    windows: s.windows,
    zTop: s.zTop,
    strokes: s.strokes,
    stickers: s.stickers,
    mode: s.mode,
    viewport: { w: vw, h: vh },
  };
}

export const boardIsEmpty = (b: Pick<DeskSnapshot, 'windows' | 'strokes' | 'stickers'>) =>
  !Object.keys(b.windows).length && !b.strokes.length && !b.stickers.length;

/** "Desk 3", the first free number. */
export function nextDeskName(desks = useDesks.getState().desks): string {
  const taken = new Set(desks.map((d) => d.name));
  for (let i = 1; ; i++) if (!taken.has(`Desk ${i}`)) return `Desk ${i}`;
}

/** Saves the board into its desk, or as a new desk if it doesn't have one yet. */
export function saveDesk(name?: string): SavedDesk {
  const { deskId } = useWorkspace.getState();
  const desks = useDesks.getState().desks;
  const now = Date.now();
  const existing = deskId ? desks.find((d) => d.id === deskId) : undefined;
  if (existing) {
    const updated = { ...existing, name: name?.trim() || existing.name, updatedAt: now, snapshot: snapshotBoard() };
    commit(desks.map((d) => (d.id === existing.id ? updated : d)));
    return updated;
  }
  return saveDeskAsNew(name);
}

export function saveDeskAsNew(name?: string): SavedDesk {
  const now = Date.now();
  const desk: SavedDesk = { id: uid('desk'), name: name?.trim() || nextDeskName(), createdAt: now, updatedAt: now, snapshot: snapshotBoard() };
  commit([desk, ...useDesks.getState().desks]);
  useWorkspace.getState().setDeskId(desk.id);
  return desk;
}

/** Before the board changes: keep what's on it. Returns the name it was saved under, if it was new. */
function keepCurrent(): string | null {
  const s = useWorkspace.getState();
  const snap = snapshotBoard();
  if (s.deskId && useDesks.getState().desks.some((d) => d.id === s.deskId)) {
    saveDesk();
    return null;
  }
  if (boardIsEmpty(snap)) return null;
  return saveDeskAsNew().name;
}

export function openDesk(id: string) {
  const desk = useDesks.getState().desks.find((d) => d.id === id);
  if (!desk || useWorkspace.getState().deskId === id) return;
  const kept = keepCurrent();
  const { windows, zTop, strokes, stickers, mode } = desk.snapshot;
  useWorkspace.getState().loadBoard({ windows, zTop, strokes, stickers, mode }, desk.id);
  useUI.getState().toast(kept ? `Switched to ${desk.name}. Your last board was kept as ${kept}.` : `Switched to ${desk.name}.`);
}

/** A clean board. Whatever was on the old one is kept as a desk first. */
export function newDesk() {
  const kept = keepCurrent();
  useWorkspace.getState().loadBoard({ windows: {}, zTop: 10, strokes: [], stickers: [], mode: useWorkspace.getState().mode }, null);
  useUI.getState().toast(kept ? `Fresh desk. Your last board was kept as ${kept}.` : 'Fresh desk.');
}

export function renameDesk(id: string, name: string) {
  const n = name.trim();
  if (!n) return;
  commit(useDesks.getState().desks.map((d) => (d.id === id ? { ...d, name: n.slice(0, 60) } : d)));
}

export function duplicateDesk(id: string) {
  const desks = useDesks.getState().desks;
  const d = desks.find((x) => x.id === id);
  if (!d) return;
  const now = Date.now();
  const copy: SavedDesk = { ...d, id: uid('desk'), name: `${d.name} copy`.slice(0, 60), createdAt: now, updatedAt: now };
  commit([copy, ...desks]);
}

export function deleteDesk(id: string) {
  const desks = useDesks.getState().desks;
  const d = desks.find((x) => x.id === id);
  if (!d) return;
  commit(desks.filter((x) => x.id !== id));
  // The board itself stays; it just isn't saved as that desk anymore.
  if (useWorkspace.getState().deskId === id) useWorkspace.getState().setDeskId(null);
  useUI.getState().toast(`Deleted ${d.name}.`, {
    label: 'Undo',
    run: () => {
      commit([d, ...useDesks.getState().desks.filter((x) => x.id !== d.id)].sort((a, b) => b.updatedAt - a.updatedAt));
    },
  });
}
