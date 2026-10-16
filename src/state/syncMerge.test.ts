import { describe, expect, it } from 'vitest';
import { mergeBoard, mergeFlags, mergeProgress, mergeSaved, mergeSettings, same, type Board } from './syncMerge';
import type { Progress, Settings } from './types';
import type { SavedDesk } from './desks';

const fresh: Progress = {
  tokens: 0,
  tokensEarned: 0,
  solved: 0,
  setsFinished: 0,
  stickersEarned: [],
  fishOwned: [],
  fishSelected: '',
  catches: {},
  decorOwned: [],
  decorShown: [],
  foods: ['flakes'],
  tickets: { day: 0, night: 0 },
  trips: 0,
};
const p = (over: Partial<Progress>): Progress => ({ ...fresh, ...over });

const settings: Settings = { theme: 'light', grid: true, motion: 'system', backpackPos: { edge: 'bottom', t: 0 }, arrange: { grid: false, gridSize: 24, windows: false, guides: false } as never, uiScale: 1, tips: true };

const emptyBoard: Board = { windows: {}, zTop: 10, strokes: [], stickers: [], mode: 'cheat', deskId: null, recent: [], recentlyClosed: [] };
const boardWith = (id: string): Board => ({ ...emptyBoard, windows: { [id]: { id, type: 'calculator', x: 0, y: 0, w: 300, h: 400, z: 11, minimized: false, maximized: false, data: {} } as never } });

const desk = (id: string, updatedAt: number, name = id): SavedDesk => ({ id, name, createdAt: 1, updatedAt, snapshot: { windows: {}, zTop: 10, strokes: [], stickers: [], mode: 'cheat', viewport: { w: 1280, h: 800 } } });

describe('a brand-new account takes everything already on the device', () => {
  const local = p({ tokens: 140, tokensEarned: 200, solved: 23, stickersEarned: ['matcha', 'bass'], fishOwned: ['koi'], fishSelected: 'koi', catches: { koi: 2 }, tickets: { day: 1, night: 0 }, trips: 3 });

  it('progress', () => {
    // Never synced (base = a fresh start) into an empty account.
    expect(mergeProgress(fresh, local, fresh)).toEqual(local);
  });

  it('settings and flags', () => {
    const mine = { ...settings, theme: 'dark' as const, uiScale: 1.25 };
    expect(mergeSettings(settings, mine, settings)).toEqual(mine);
    expect(mergeFlags({ seenWelcome: true, nextTip: 5, introSeen: ['quadratic'], guideSeen: [] }, { seenWelcome: false, nextTip: 0, introSeen: [], guideSeen: [] })).toEqual({
      seenWelcome: true,
      nextTip: 5,
      introSeen: ['quadratic'],
      guideSeen: [],
    });
  });

  it('the board on screen', () => {
    expect(mergeBoard(null, boardWith('a'), emptyBoard)).toEqual({ board: boardWith('a'), keepLocalAsDesk: false });
    expect(mergeBoard(null, boardWith('a'), null)).toEqual({ board: boardWith('a'), keepLocalAsDesk: false });
  });

  it('saved desks, all uploaded', () => {
    const r = mergeSaved({}, [desk('d1', 5), desk('d2', 6)], []);
    expect(r.items.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(r.upload.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(r.remove).toEqual([]);
  });
});

describe('a device with its own progress signing in to an account that has some', () => {
  it('adds the two together instead of picking one', () => {
    const merged = mergeProgress(fresh, p({ tokens: 30, tokensEarned: 30, fishOwned: ['koi'], catches: { koi: 1 } }), p({ tokens: 50, tokensEarned: 80, fishOwned: ['bass'], catches: { koi: 2, bass: 1 } }));
    expect(merged).toMatchObject({ tokens: 80, tokensEarned: 110, fishOwned: ['bass', 'koi'], catches: { koi: 3, bass: 1 } });
  });

  it('keeps the account’s board on screen and saves this device’s as a desk', () => {
    expect(mergeBoard(null, boardWith('mine'), boardWith('theirs'))).toEqual({ board: boardWith('theirs'), keepLocalAsDesk: true });
    // An empty board here has nothing worth keeping.
    expect(mergeBoard(null, emptyBoard, boardWith('theirs'))).toEqual({ board: boardWith('theirs'), keepLocalAsDesk: false });
  });
});

describe('two signed-in devices', () => {
  const base = p({ tokens: 100, tokensEarned: 100, tickets: { day: 1, night: 0 } });

  it('combine earning on one with spending on the other', () => {
    const here = p({ tokens: 50, tokensEarned: 100, tickets: { day: 2, night: 0 } }); // bought a 50-token ticket
    const there = p({ tokens: 130, tokensEarned: 130, tickets: { day: 1, night: 0 } }); // earned 30
    expect(mergeProgress(base, here, there)).toMatchObject({ tokens: 80, tokensEarned: 130, tickets: { day: 2, night: 0 } });
  });

  it('take no change from a device that changed nothing', () => {
    const there = p({ tokens: 160, tokensEarned: 160 });
    expect(mergeProgress(base, base, there)).toEqual(there);
  });

  it('follow whichever side changed a choice or a setting', () => {
    expect(mergeProgress(p({ fishSelected: 'koi' }), p({ fishSelected: 'koi' }), p({ fishSelected: 'bass' })).fishSelected).toBe('bass');
    expect(mergeProgress(p({ fishSelected: 'koi' }), p({ fishSelected: 'carp' }), p({ fishSelected: 'bass' })).fishSelected).toBe('carp');
    const there = { ...settings, grid: false };
    expect(mergeSettings(settings, settings, there).grid).toBe(false);
    const here = { ...settings, theme: 'dark' as const };
    expect(mergeSettings(settings, here, there)).toMatchObject({ theme: 'dark', grid: false });
  });

  it('never let tokens go below zero', () => {
    expect(mergeProgress(p({ tokens: 100 }), p({ tokens: 0 }), p({ tokens: 40 })).tokens).toBe(0);
  });

  it('pick the board from whichever device changed it', () => {
    const b = boardWith('a');
    expect(mergeBoard(b, boardWith('b'), b).board).toEqual(boardWith('b'));
    expect(mergeBoard(b, b, boardWith('c')).board).toEqual(boardWith('c'));
  });

  it('merge desks one by one: newer wins, deletions carry over, new ones join', () => {
    const base = { kept: 5, renamedThere: 5, deletedHere: 5, deletedThere: 5 };
    const local = [desk('kept', 5), desk('renamedThere', 5), desk('deletedThere', 5), desk('newHere', 9)];
    const cloud = [desk('kept', 5), desk('renamedThere', 8, 'Algebra'), desk('deletedHere', 5), desk('newThere', 9)];
    const r = mergeSaved(base, local, cloud);
    expect(r.items.map((d) => d.id)).toEqual(['kept', 'renamedThere', 'newHere', 'newThere']);
    expect(r.items.find((d) => d.id === 'renamedThere')?.name).toBe('Algebra');
    expect(r.upload.map((d) => d.id)).toEqual(['newHere']);
    expect(r.remove).toEqual(['deletedHere']);
  });
});

/** What Postgres jsonb does to an object on the way back: keys re-sorted, shortest first. */
const jsonbOrder = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(jsonbOrder)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
            .map((k) => [k, jsonbOrder((v as Record<string, unknown>)[k])]),
        )
      : v;

describe('a copy that went through the account unchanged', () => {
  const withInputs = (eq: string): Board => ({
    ...emptyBoard,
    windows: { 'std-1': { id: 'std-1', type: 'standardToSlope', x: 40, y: 40, w: 440, h: 560, z: 11, minimized: false, maximized: false, data: { inputs: { eq }, solved: null, history: [] } } as never },
  });

  it('counts as the same even with its keys in another order', () => {
    expect(same({ a: 1, b: { c: 2, d: [1, 2] } }, { b: { d: [1, 2], c: 2 }, a: 1 })).toBe(true);
    expect(same({ a: 1, gone: undefined }, { a: 1 })).toBe(true);
    expect(same([1, 2], [2, 1])).toBe(false);
    expect(same(withInputs('x'), jsonbOrder(withInputs('x')))).toBe(true);
  });

  it('keeps what the student just typed instead of putting the old board back', () => {
    // Synced with an empty box; the student types; the account still has the empty box, re-sorted by jsonb.
    const base = withInputs('');
    const typed = withInputs('3x + 4y = 12');
    expect(mergeBoard(base, typed, jsonbOrder(base) as Board)).toEqual({ board: typed, keepLocalAsDesk: false });
  });

  it('keeps a window the student just opened', () => {
    const base = withInputs('');
    const opened: Board = { ...base, windows: { ...base.windows, 'calc-2': { id: 'calc-2', type: 'calculator', x: 0, y: 0, w: 300, h: 460, z: 12, minimized: false, maximized: false, data: {} } as never }, zTop: 12 };
    expect(mergeBoard(base, opened, jsonbOrder(base) as Board).board).toBe(opened);
  });

  it('leaves an unchanged desk alone', () => {
    const d = desk('d1', 5);
    const r = mergeSaved({ d1: 5 }, [d], [jsonbOrder(d) as SavedDesk]);
    expect(r.upload).toEqual([]);
    expect(r.remove).toEqual([]);
    expect(r.items).toHaveLength(1);
  });
});
