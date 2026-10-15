import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AssistMode, PlacedSticker, Progress, RecentProblem, Settings, Stroke, Win, WindowType } from './types';
import { TOOLS } from '../data/tools';
import { clampToViewport, findPlacement, findStickerSpot, fitSize } from './placement';
import { BUTTON, DEFAULT_POS, buttonXY } from '../components/backpack/geometry';
import { useUI } from './ui';
import { STICKER_BY_KIND } from '../data/stickers';
import { FISH_BY_ID } from '../data/fish';

/**
 * Persisted workspace content. Ephemeral UI state (backpack open, draw mode,
 * toasts, search text) lives in ./ui.ts and is never saved.
 */
export interface WorkspaceState {
  windows: Record<string, Win>;
  zTop: number;
  mode: AssistMode;
  stickers: PlacedSticker[];
  strokes: Stroke[];
  recent: RecentProblem[];
  recentlyClosed: Win[];
  progress: Progress;
  settings: Settings;
  /** Subtle "what next?" invitation after a task is truly finished. */
  nudge: boolean;
  /** The backpack opens by itself only on the very first visit. */
  seenWelcome: boolean;
  setSeenWelcome: () => void;
  /** Tools whose lesson intro has been seen: after the first lesson it starts folded up. */
  introSeen: string[];
  markIntroSeen: (tool: string) => void;
  /** Calculator models whose key-by-key walkthrough has been done once: after that it waits until asked. */
  guideSeen: string[];
  markGuideSeen: (model: string) => void;
  /** Which saved desk is on the board right now (null: not saved as a desk yet). */
  deskId: string | null;
  setDeskId: (id: string | null) => void;
  /** Swaps the whole board for a saved one. */
  loadBoard: (board: { windows: Record<string, Win>; zTop: number; strokes: Stroke[]; stickers: PlacedSticker[]; mode: AssistMode }, deskId: string | null) => void;

  openWindow: (type: WindowType, opts?: { data?: Record<string, unknown>; near?: string; at?: { x: number; y: number }; focus?: boolean }) => string;
  closeWindow: (id: string) => void;
  reopenClosed: (id: string) => void;
  focusWindow: (id: string) => void;
  setRect: (id: string, rect: Partial<Pick<Win, 'x' | 'y' | 'w' | 'h'>>) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
  toggleMaximize: (id: string) => void;
  updateData: <T extends Record<string, unknown>>(id: string, patch: Partial<T> | ((d: T) => Partial<T>)) => void;
  clampAll: () => void;

  setMode: (mode: AssistMode) => void;
  pushRecent: (r: RecentProblem) => void;
  addTokens: (n: number) => void;
  /** Spends tokens if there are enough; returns whether it worked. */
  buyTicket: (kind: 'day' | 'night', price: number) => boolean;
  redeemTicket: (kind: 'day' | 'night') => boolean;
  /** Records a catch and applies its unlocks; returns what was new. */
  recordCatch: (fishId: string, decorDrop?: string | null) => { newFish: boolean; unlocked: string[] };
  toggleDecor: (id: string) => void;
  recordSolve: () => void;
  finishSet: () => void;
  earnSticker: (kind: string) => void;
  /** Earns several stickers with one message; returns the ones that were new. */
  earnStickers: (kinds: string[]) => string[];
  selectFish: (id: string) => void;
  setNudge: (on: boolean) => void;

  placeSticker: (kind: string, at?: { x: number; y: number }, on?: { winId: string; local: { x: number; y: number } }) => string;
  updateSticker: (id: string, patch: Partial<PlacedSticker>) => void;
  removeSticker: (id: string) => void;

  setStrokes: (strokes: Stroke[]) => void;

  setSettings: (patch: Partial<Settings>) => void;
  reset: (what: 'drawing' | 'windows' | 'stickers' | 'progress' | 'everything') => void;
}

/** Drops stickers whose window no longer exists anywhere. */
function withoutOrphans(stickers: PlacedSticker[], windows: Record<string, Win>, closed: Win[]): PlacedSticker[] {
  return stickers.filter((k) => !k.on || windows[k.on] || closed.some((w) => w.id === k.on));
}

export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const initialProgress: Progress = {
  tokens: 0,
  tokensEarned: 0,
  solved: 0,
  setsFinished: 0,
  stickersEarned: [],
  // The bowl starts empty: fish come from da Ship.
  fishOwned: [],
  fishSelected: '',
  catches: {},
  decorOwned: [],
  decorShown: [],
  foods: ['flakes'],
  tickets: { day: 0, night: 0 },
  trips: 0,
};

const initialSettings: Settings = { theme: 'light', grid: true, motion: 'system', backpackPos: { edge: 'bottom', t: 0 } };

const isTaskOpen = (windows: Record<string, Win>) => Object.values(windows).some((w) => TOOLS[w.type].isTask);

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      windows: {},
      zTop: 10,
      mode: 'cheat',
      stickers: [],
      strokes: [],
      recent: [],
      recentlyClosed: [],
      progress: initialProgress,
      settings: initialSettings,
      nudge: false,
      seenWelcome: false,
      setSeenWelcome: () => set({ seenWelcome: true }),
      introSeen: [],
      markIntroSeen: (tool) => set((s) => (s.introSeen.includes(tool) ? s : { introSeen: [...s.introSeen, tool] })),
      guideSeen: [],
      markGuideSeen: (model) => set((s) => (s.guideSeen.includes(model) ? s : { guideSeen: [...s.guideSeen, model] })),
      deskId: null,
      setDeskId: (id) => set({ deskId: id }),
      loadBoard: (board, deskId) => {
        const ui = useUI.getState();
        ui.setFocused(null);
        ui.selectSticker(null);
        set({ windows: board.windows, zTop: board.zTop, strokes: board.strokes, stickers: withoutOrphans(board.stickers, board.windows, []), mode: board.mode, deskId, recentlyClosed: [], nudge: false });
        get().clampAll();
      },

      openWindow: (type, opts = {}) => {
        const meta = TOOLS[type];
        const state = get();
        if (meta.singleton) {
          const existing = Object.values(state.windows).find((w) => w.type === type);
          if (existing) {
            set((s) => ({
              zTop: s.zTop + 1,
              windows: {
                ...s.windows,
                [existing.id]: { ...existing, minimized: false, z: s.zTop + 1, data: opts.data ? { ...existing.data, ...opts.data } : existing.data },
              },
            }));
            useUI.getState().setFocused(existing.id);
            return existing.id;
          }
        }
        // Items (fishbowl, clock) tucked away in the bag come back as they were, rather than as a new copy.
        if (meta.chrome === 'bare') {
          const tucked = Object.values(state.windows)
            .filter((w) => w.type === type && w.minimized)
            .sort((a, b) => b.z - a.z)[0];
          if (tucked) {
            const others = Object.values(state.windows).filter((w) => w.id !== tucked.id);
            const near = opts.near ? state.windows[opts.near] : undefined;
            // Dropped somewhere on purpose: it goes there. Otherwise it returns to its old spot.
            const spot = opts.at ? findPlacement({ w: tucked.w, h: tucked.h }, others, near, opts.at) : { x: tucked.x, y: tucked.y };
            set((s) => ({
              zTop: s.zTop + 1,
              windows: { ...s.windows, [tucked.id]: { ...tucked, ...clampToViewport({ ...tucked, ...spot }), minimized: false, z: s.zTop + 1 } },
            }));
            if (opts.focus !== false) useUI.getState().setFocused(tucked.id);
            return tucked.id;
          }
        }
        const id = uid(type);
        const want = meta.sizeFor?.({ ...meta.initialData(), ...opts.data }) ?? meta.size;
        const size = fitSize(want.w, want.h);
        const others = Object.values(state.windows);
        const near = opts.near ? state.windows[opts.near] : undefined;
        const rect = findPlacement(size, others, near, opts.at);
        const win: Win = {
          id,
          type,
          ...rect,
          z: state.zTop + 1,
          minimized: false,
          maximized: false,
          data: { ...meta.initialData(), ...opts.data },
        };
        set((s) => ({ zTop: s.zTop + 1, windows: { ...s.windows, [id]: win }, nudge: meta.isTask ? false : s.nudge }));
        if (opts.focus !== false) useUI.getState().setFocused(id);
        return id;
      },

      closeWindow: (id) => {
        const win = get().windows[id];
        if (!win) return;
        const meta = TOOLS[win.type];
        const keep = meta.hasContent(win.data);
        set((s) => {
          const windows = { ...s.windows };
          delete windows[id];
          const lastTaskClosed = meta.isTask && !isTaskOpen(windows);
          const recentlyClosed = keep ? [win, ...s.recentlyClosed.filter((w) => w.id !== id)].slice(0, 8) : s.recentlyClosed;
          return {
            windows,
            recentlyClosed,
            nudge: lastTaskClosed ? true : s.nudge,
            // Stickers ride along with a closed window (and come back with Undo); gone for good, they go too.
            stickers: withoutOrphans(s.stickers, windows, recentlyClosed),
          };
        });
        const ui = useUI.getState();
        if (ui.focusedId === id) ui.setFocused(null);
        // No toast here: a closed window with something in it can be reopened from the bag (On your desk → closed).
      },

      reopenClosed: (id) => {
        const win = get().recentlyClosed.find((w) => w.id === id);
        if (!win) return;
        set((s) => ({
          zTop: s.zTop + 1,
          windows: { ...s.windows, [id]: { ...win, ...clampToViewport(win), minimized: false, z: s.zTop + 1 } },
          recentlyClosed: s.recentlyClosed.filter((w) => w.id !== id),
        }));
        useUI.getState().setFocused(id);
      },

      focusWindow: (id) => {
        const s = get();
        const win = s.windows[id];
        if (!win) return;
        if (win.z !== s.zTop) {
          set({ zTop: s.zTop + 1, windows: { ...s.windows, [id]: { ...win, z: s.zTop + 1 } } });
        }
        useUI.getState().setFocused(id);
      },

      setRect: (id, rect) =>
        set((s) => (s.windows[id] ? { windows: { ...s.windows, [id]: { ...s.windows[id], ...rect } } } : s)),

      minimize: (id) => {
        set((s) => (s.windows[id] ? { windows: { ...s.windows, [id]: { ...s.windows[id], minimized: true } } } : s));
        const ui = useUI.getState();
        if (ui.focusedId === id) ui.setFocused(null);
      },

      restore: (id) => {
        set((s) =>
          s.windows[id]
            ? { zTop: s.zTop + 1, windows: { ...s.windows, [id]: { ...s.windows[id], minimized: false, z: s.zTop + 1 } } }
            : s,
        );
        useUI.getState().setFocused(id);
      },

      toggleMaximize: (id) =>
        set((s) => (s.windows[id] ? { windows: { ...s.windows, [id]: { ...s.windows[id], maximized: !s.windows[id].maximized } } } : s)),

      updateData: (id, patch) =>
        set((s) => {
          const win = s.windows[id];
          if (!win) return s;
          const p = typeof patch === 'function' ? patch(win.data as never) : patch;
          return { windows: { ...s.windows, [id]: { ...win, data: { ...win.data, ...p } } } };
        }),

      clampAll: () =>
        set((s) => {
          const windows: Record<string, Win> = {};
          for (const w of Object.values(s.windows)) windows[w.id] = { ...w, ...clampToViewport(w) };
          return { windows };
        }),

      setMode: (mode) => set({ mode }),

      pushRecent: (r) =>
        set((s) => ({
          recent: [r, ...s.recent.filter((x) => !(x.windowId === r.windowId && x.label === r.label))].slice(0, 12),
        })),

      addTokens: (n) =>
        set((s) => ({ progress: { ...s.progress, tokens: s.progress.tokens + n, tokensEarned: s.progress.tokensEarned + Math.max(0, n) } })),

      buyTicket: (kind, price) => {
        const p = get().progress;
        if (p.tokens < price) return false;
        set({ progress: { ...p, tokens: p.tokens - price, tickets: { ...p.tickets, [kind]: p.tickets[kind] + 1 } } });
        return true;
      },

      redeemTicket: (kind) => {
        const p = get().progress;
        if (p.tickets[kind] < 1) return false;
        set({ progress: { ...p, tickets: { ...p.tickets, [kind]: p.tickets[kind] - 1 }, trips: p.trips + 1 } });
        return true;
      },

      recordCatch: (fishId, decorDrop) => {
        const p = get().progress;
        const fish = FISH_BY_ID[fishId];
        const newFish = !p.fishOwned.includes(fishId);
        const unlocked: string[] = [];
        let { decorOwned, decorShown, foods } = p;
        if (newFish && fish?.unlocks) {
          for (const d of fish.unlocks.decor ?? []) if (!decorOwned.includes(d)) (decorOwned = [...decorOwned, d]), (decorShown = [...decorShown, d]), unlocked.push(d);
          for (const f of fish.unlocks.food ?? []) if (!foods.includes(f)) (foods = [...foods, f]), unlocked.push(f);
        }
        if (decorDrop && !decorOwned.includes(decorDrop)) {
          decorOwned = [...decorOwned, decorDrop];
          decorShown = [...decorShown, decorDrop];
          unlocked.push(decorDrop);
        }
        set({
          progress: {
            ...p,
            fishOwned: newFish ? [...p.fishOwned, fishId] : p.fishOwned,
            fishSelected: p.fishSelected || fishId,
            catches: { ...p.catches, [fishId]: (p.catches[fishId] ?? 0) + 1 },
            decorOwned,
            decorShown,
            foods,
          },
        });
        return { newFish, unlocked };
      },

      toggleDecor: (id) =>
        set((s) => {
          const shown = s.progress.decorShown;
          return { progress: { ...s.progress, decorShown: shown.includes(id) ? shown.filter((d) => d !== id) : [...shown, id] } };
        }),

      recordSolve: () => {
        set((s) => ({ progress: { ...s.progress, solved: s.progress.solved + 1 } }));
        const { progress, earnSticker } = get();
        if (progress.solved === 1) earnSticker('matcha');
        if (progress.tokensEarned >= 50) earnSticker('bass');
      },

      finishSet: () => {
        set((s) => ({ progress: { ...s.progress, setsFinished: s.progress.setsFinished + 1 }, nudge: true }));
        get().earnSticker('goldstar');
      },

      earnSticker: (kind) => {
        if (get().progress.stickersEarned.includes(kind)) return;
        set((s) => ({ progress: { ...s.progress, stickersEarned: [...s.progress.stickersEarned, kind] } }));
        useUI.getState().toast(`New sticker: ${STICKER_BY_KIND[kind]?.name ?? 'something shiny'}. It's in your backpack.`);
      },

      earnStickers: (kinds) => {
        const have = get().progress.stickersEarned;
        const fresh = [...new Set(kinds)].filter((k) => !have.includes(k) && STICKER_BY_KIND[k]);
        if (!fresh.length) return [];
        set((s) => ({ progress: { ...s.progress, stickersEarned: [...s.progress.stickersEarned, ...fresh] } }));
        const names = fresh.map((k) => STICKER_BY_KIND[k].name);
        const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
        useUI.getState().toast(`New sticker${fresh.length > 1 ? 's' : ''}: ${list}. ${fresh.length > 1 ? 'They’re' : 'It’s'} in your backpack.`);
        return fresh;
      },

      selectFish: (id) => set((s) => ({ progress: { ...s.progress, fishSelected: id } })),

      setNudge: (on) => set({ nudge: on }),

      placeSticker: (kind, at, on) => {
        const id = uid('sticker');
        // Dropped onto a window: stick it there, where it landed.
        if (on && get().windows[on.winId]) {
          const st = { id, kind, x: Math.round(on.local.x), y: Math.round(on.local.y), rot: Math.round((Math.random() - 0.5) * 16), scale: 1, on: on.winId };
          set((s) => ({ stickers: [...s.stickers, st] }));
          return id;
        }
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        const prefer = at ?? { x: vw * (0.55 + Math.random() * 0.3), y: vh * (0.15 + Math.random() * 0.5) };
        // Stickers sit beneath windows, so never place one where something covers it.
        const s0 = get();
        const blockers = Object.values(s0.windows)
          .filter((w) => !w.minimized)
          .map((w) => {
            const meta = TOOLS[w.type];
            const h = meta.chrome === 'bare' && meta.aspect ? Math.round(w.w / meta.aspect) : w.maximized ? vh : w.h;
            return w.maximized ? { x: 0, y: 0, w: vw, h } : { x: w.x, y: w.y, w: w.w, h };
          });
        const btn = buttonXY(s0.settings.backpackPos ?? DEFAULT_POS, vw, vh);
        blockers.push({ x: btn.x, y: btn.y, w: BUTTON, h: BUTTON });
        const pos = findStickerSpot(blockers, s0.stickers, prefer, vw, vh);
        set((s) => ({
          stickers: [...s.stickers, { id, kind, x: Math.round(pos.x), y: Math.round(pos.y), rot: Math.round((Math.random() - 0.5) * 16), scale: 1 }],
        }));
        return id;
      },

      updateSticker: (id, patch) => set((s) => ({ stickers: s.stickers.map((k) => (k.id === id ? { ...k, ...patch } : k)) })),

      removeSticker: (id) => {
        const removed = get().stickers.find((k) => k.id === id);
        set((s) => ({ stickers: s.stickers.filter((k) => k.id !== id) }));
        if (removed) useUI.getState().toast('Sticker peeled off.', { label: 'Undo', run: () => set((s) => ({ stickers: [...s.stickers, removed] })) });
      },

      setStrokes: (strokes) => set({ strokes }),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      reset: (what) => {
        if (what === 'drawing' || what === 'everything') set({ strokes: [] });
        if (what === 'stickers' || what === 'everything') set({ stickers: [] });
        if (what === 'windows' || what === 'everything') set((s) => ({ windows: {}, recentlyClosed: [], zTop: 10, stickers: s.stickers.filter((k) => !k.on) }));
        if (what === 'progress' || what === 'everything') set({ progress: initialProgress });
        if (what === 'everything') set({ recent: [], mode: 'cheat', settings: initialSettings, nudge: false, introSeen: [], guideSeen: [] });
      },
    }),
    {
      name: 'uji.workspace',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // v1 → v2: points became tokens, the menu window moved into the backpack.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Record<string, any>;
        if (version < 2) {
          const prog = s.progress ?? {};
          if (prog.points != null) {
            prog.tokens = prog.points;
            prog.tokensEarned = prog.points;
            delete prog.points;
          }
          s.progress = prog;
          const windows: Record<string, Win> = {};
          for (const [id, w] of Object.entries((s.windows ?? {}) as Record<string, Win>)) if ((w.type as string) !== 'menu') windows[id] = w;
          s.windows = windows;
          s.recentlyClosed = ((s.recentlyClosed ?? []) as Win[]).filter((w) => (w.type as string) !== 'menu');
        }
        return s as WorkspaceState;
      },
      // Nested objects get defaults for any fields added since the save was written.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<WorkspaceState>;
        return {
          ...current,
          ...p,
          progress: { ...current.progress, ...p.progress, tickets: { ...current.progress.tickets, ...p.progress?.tickets } },
          settings: { ...current.settings, ...p.settings },
        };
      },
    },
  ),
);

export function useWindowData<T extends Record<string, unknown>>(id: string): [T, (patch: Partial<T> | ((d: T) => Partial<T>)) => void] {
  const data = useWorkspace((s) => s.windows[id]?.data) as T;
  const update = useWorkspace((s) => s.updateData);
  return [data ?? ({} as T), (patch) => update<T>(id, patch)];
}

/** Problem types the solvers handle; paused while a Challenge set is running. */
export const SOLVER_TYPES: WindowType[] = [
  'standardToSlope',
  'slopeFromPoints',
  'pointSlope',
  'systems',
  'quadratic',
  'factoring',
  'pythag',
  'area',
  'trig',
  'stats',
  'sequences',
  'nuclearDecay',
];

/** True while a Challenge set is in progress (even minimized), so the solvers can't be used to cheat. */
export function isPracticeRunning(windows: Record<string, Win>): boolean {
  return Object.values(windows).some((w) => w.type === 'challenge' && w.data.phase === 'playing');
}

export function usePracticeLock(): boolean {
  return useWorkspace((s) => isPracticeRunning(s.windows));
}
