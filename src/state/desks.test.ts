import { beforeEach, describe, expect, it } from 'vitest';

// Window placement reads the screen size; a plain object is enough here.
(globalThis as { window?: unknown }).window ??= { innerWidth: 1280, innerHeight: 800, setTimeout, clearTimeout };
import { useWorkspace } from './store';
import { deleteDesk, newDesk, openDesk, saveDesk, setDeskStorage, useDesks, type SavedDesk } from './desks';
import { useUI } from './ui';

let saved: SavedDesk[] = [];
beforeEach(() => {
  saved = [];
  setDeskStorage({ read: () => saved, write: (d) => (saved = d) });
  useWorkspace.setState({ windows: {}, strokes: [], stickers: [], deskId: null, zTop: 10 });
});

const addWindow = () => useWorkspace.getState().openWindow('scratchpad', { data: { text: 'hello' } });

describe('desks', () => {
  it('saves the board and switches without losing anything', () => {
    addWindow();
    const a = saveDesk('Homework');
    expect(saved).toHaveLength(1);
    expect(useWorkspace.getState().deskId).toBe(a.id);

    newDesk();
    expect(Object.keys(useWorkspace.getState().windows)).toHaveLength(0);
    useWorkspace.getState().openWindow('calculator');
    useWorkspace.getState().openWindow('graph');

    // Opening Homework keeps this unsaved board as a desk of its own.
    openDesk(a.id);
    expect(useDesks.getState().desks.map((d) => d.name).sort()).toEqual(['Desk 1', 'Homework']);
    const ws = Object.values(useWorkspace.getState().windows);
    expect(ws.map((w) => w.type)).toEqual(['scratchpad']);
    expect(ws[0].data.text).toBe('hello');

    const other = useDesks.getState().desks.find((d) => d.name === 'Desk 1')!;
    openDesk(other.id);
    expect(Object.values(useWorkspace.getState().windows).map((w) => w.type).sort()).toEqual(['calculator', 'graph']);
  });

  it('deletes with undo, and the board stays put', () => {
    addWindow();
    const d = saveDesk();
    deleteDesk(d.id);
    expect(saved).toHaveLength(0);
    expect(useWorkspace.getState().deskId).toBe(null);
    expect(Object.keys(useWorkspace.getState().windows)).toHaveLength(1);
    useUI.getState().toasts.at(-1)?.action?.run();
    expect(saved.map((x) => x.id)).toEqual([d.id]);
  });
});
