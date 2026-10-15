import { useWorkspace, uid } from '../../state/store';
import { useUI } from '../../state/ui';
import type { WindowType } from '../../state/types';
import { clearedForGuide } from './calc/clear';

/** Graph line colors: muted, distinguishable, never neon. */
export const GRAPH_COLORS = ['#6d74cf', '#cf6b52', '#4f8f6c', '#b0883a', '#8a5fb0', '#3f8aa6'];

export interface GraphEquation {
  id: string;
  text: string;
  color: string;
  visible: boolean;
  points?: [number, number][];
}

/**
 * Sends an equation to the front-most graph window, opening one beside the
 * source window if needed. Tools never make the student retype what they solved.
 */
export function sendToGraph(fromWindowId: string, text: string, points?: [number, number][]) {
  const ws = useWorkspace.getState();
  const graphs = Object.values(ws.windows)
    .filter((w) => w.type === 'graph')
    .sort((a, b) => b.z - a.z);
  let target = graphs[0]?.id;
  if (!target) target = ws.openWindow('graph', { near: fromWindowId, focus: false });
  else if (ws.windows[target].minimized) ws.restore(target);

  ws.updateData<{ equations: GraphEquation[] }>(target, (d) => {
    const existing = d.equations ?? [];
    if (existing.some((e) => e.text === text)) {
      return { equations: existing.map((e) => (e.text === text ? { ...e, visible: true, points: points ?? e.points } : e)) };
    }
    const color = GRAPH_COLORS[existing.length % GRAPH_COLORS.length];
    return { equations: [...existing, { id: uid('eq'), text, color, visible: true, points }] };
  });
  // Raise the graph so it's visible, but keep keyboard focus with the student's work.
  const g = useWorkspace.getState().windows[target];
  if (g) useWorkspace.getState().focusWindow(target);
  useUI.getState().setFocused(fromWindowId);
  useUI.getState().pulseWindow(target);
}

/**
 * Brings a helper tool up next to the current work. An existing instance is
 * revealed where it is rather than moved, since the student may have placed it.
 */
export function openHelper(fromWindowId: string, type: WindowType, calc?: string) {
  const ws = useWorkspace.getState();
  const existing = Object.values(ws.windows)
    .filter((w) => w.type === type)
    .sort((a, b) => b.z - a.z)[0];
  let id: string;
  if (existing) {
    ws.restore(existing.id);
    useUI.getState().setFocused(fromWindowId);
    id = existing.id;
  } else id = ws.openWindow(type, { near: fromWindowId, focus: false });
  // On whichever calculator model the student uses, light up the keys for this step.
  if (type === 'calculator' && calc) {
    const win = useWorkspace.getState().windows[id];
    // Key by key the first time on a model; after that, just what to work out, with the keys on request.
    const model = String(win?.data.model ?? 'basic');
    const expanded = !useWorkspace.getState().guideSeen.includes(model);
    // The strip needs room; grow the window once rather than squeezing the keypad.
    if (win && !win.data.guide && !win.maximized) {
      const room = window.innerHeight - win.y - 16;
      if (room > win.h) ws.setRect(id, { h: Math.min(room, win.h + (expanded ? 104 : 48)) });
    }
    // Start from a clean screen every time, so the directions match what's showing.
    const data = useWorkspace.getState().windows[id]?.data ?? {};
    ws.updateData(id, { ...clearedForGuide(data), guide: { expr: calc, pos: 0, miss: null, at: Date.now(), expanded } });
  }
  useUI.getState().pulseWindow(id);
  return id;
}

export async function copyText(text: string, what = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    useUI.getState().toast(`${what}.`);
  } catch {
    useUI.getState().toast("Couldn't reach the clipboard. Select and copy it by hand.");
  }
}
