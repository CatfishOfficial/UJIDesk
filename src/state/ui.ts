import type { Guide } from './snap';
import { create } from 'zustand';
import type { StrokeTool } from './types';

/** Ephemeral UI state. Never persisted. */
export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export type DrawTool = StrokeTool | 'eraser';
export type BagView = 'home' | 'catalog' | 'desks' | 'arcade' | 'stuff' | 'settings' | 'stickers';

interface UIState {
  backpackOpen: boolean;
  backpackView: BagView;
  drawMode: boolean;
  drawTool: DrawTool;
  drawColor: string;
  shapeAssist: boolean;
  focusedId: string | null;
  selectedSticker: string | null;
  toasts: Toast[];
  /** Ids of windows that should briefly highlight (e.g. a graph that just received an equation). */
  pulse: Record<string, number>;
  /** Alignment guides to draw while a window is being dragged or resized. */
  guides: Guide[];
  /** Briefly true while Tidy up slides windows into place. */
  arranging: boolean;

  setBackpack: (open: boolean, view?: BagView) => void;
  setDrawMode: (on: boolean) => void;
  setDrawTool: (t: DrawTool) => void;
  setDrawColor: (c: string) => void;
  setShapeAssist: (on: boolean) => void;
  setFocused: (id: string | null) => void;
  selectSticker: (id: string | null) => void;
  toast: (text: string, action?: Toast['action']) => void;
  dismissToast: (id: number) => void;
  pulseWindow: (id: string) => void;
  setGuides: (g: Guide[]) => void;
  setArranging: (on: boolean) => void;
}

let toastSeq = 1;

export const useUI = create<UIState>()((set, get) => ({
  backpackOpen: false,
  backpackView: 'home',
  drawMode: false,
  drawTool: 'pen',
  drawColor: 'graphite',
  shapeAssist: false,
  focusedId: null,
  selectedSticker: null,
  toasts: [],
  pulse: {},
  guides: [],
  arranging: false,
  // Only update when the lines actually change, so dragging stays cheap.
  setGuides: (g) => {
    const cur = get().guides;
    if (cur.length === g.length && cur.every((c, i) => c.axis === g[i].axis && c.at === g[i].at && c.from === g[i].from && c.to === g[i].to)) return;
    set({ guides: g });
  },
  setArranging: (on) => set({ arranging: on }),

  setBackpack: (open, view) => set({ backpackOpen: open, backpackView: view ?? (open ? get().backpackView : 'home') }),
  setDrawMode: (on) => set({ drawMode: on, backpackOpen: false, selectedSticker: null }),
  setDrawTool: (t) => set({ drawTool: t }),
  setDrawColor: (c) => set({ drawColor: c }),
  setShapeAssist: (on) => set({ shapeAssist: on }),
  setFocused: (id) => set({ focusedId: id }),
  selectSticker: (id) => set({ selectedSticker: id }),
  toast: (text, action) => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, action }] }));
    window.setTimeout(() => get().dismissToast(id), action ? 6000 : 3600);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  pulseWindow: (id) => {
    const token = Date.now();
    set((s) => ({ pulse: { ...s.pulse, [id]: token } }));
    window.setTimeout(() => set((s) => {
      if (s.pulse[id] !== token) return s;
      const pulse = { ...s.pulse };
      delete pulse[id];
      return { pulse };
    }), 900);
  },
}));
