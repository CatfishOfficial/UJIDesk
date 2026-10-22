import { beforeEach, describe, expect, it } from 'vitest';

// Window placement reads the screen size; a plain object is enough here.
(globalThis as { window?: unknown }).window ??= { innerWidth: 1280, innerHeight: 800, setTimeout, clearTimeout };
const { useWorkspace } = await import('./store');

beforeEach(() => useWorkspace.setState({ windows: {}, zTop: 10 }));

describe('desk items', () => {
  it('a tucked-away item comes back as it was, not as a new copy', () => {
    const ws = useWorkspace.getState();
    const id = ws.openWindow('clock');
    ws.updateData(id, { look: 'modern', h24: true });
    ws.setRect(id, { x: 700, y: 300 });
    ws.minimize(id);
    const again = useWorkspace.getState().openWindow('clock');
    const w = useWorkspace.getState().windows[again];
    expect(again).toBe(id);
    expect(w.minimized).toBe(false);
    expect(w.data).toMatchObject({ look: 'modern', h24: true });
    expect([w.x, w.y]).toEqual([700, 300]);
    expect(Object.keys(useWorkspace.getState().windows)).toHaveLength(1);
  });

  it('comes back on screen even if it was saved off it', () => {
    const inView = (id: string) => {
      const w = useWorkspace.getState().windows[id];
      return w.x >= 0 && w.y >= 0 && w.x + w.w <= 1280 && w.y + w.h <= 800;
    };
    // The bowl is one per desk, so asking for it again brings back the same one.
    const bowl = useWorkspace.getState().openWindow('fishbowl');
    useWorkspace.getState().setRect(bowl, { x: 1900, y: 1100 });
    useWorkspace.getState().minimize(bowl);
    expect(useWorkspace.getState().openWindow('fishbowl')).toBe(bowl);
    expect(inView(bowl)).toBe(true);
    // Even when it's already out, just hanging off the edge.
    useWorkspace.getState().setRect(bowl, { x: -150, y: 760 });
    useWorkspace.getState().openWindow('fishbowl');
    expect(inView(bowl)).toBe(true);

    const calc = useWorkspace.getState().openWindow('calculator');
    useWorkspace.getState().setRect(calc, { x: 1250, y: -40 });
    useWorkspace.getState().minimize(calc);
    useWorkspace.getState().restore(calc);
    expect(inView(calc)).toBe(true);
  });

  it('with one already out, you can still take out another', () => {
    const ws = useWorkspace.getState();
    const a = ws.openWindow('clock');
    const b = useWorkspace.getState().openWindow('clock');
    expect(a).not.toBe(b);
    expect(Object.keys(useWorkspace.getState().windows)).toHaveLength(2);
  });
});
