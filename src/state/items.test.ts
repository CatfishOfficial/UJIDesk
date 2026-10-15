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

  it('with one already out, you can still take out another', () => {
    const ws = useWorkspace.getState();
    const a = ws.openWindow('clock');
    const b = useWorkspace.getState().openWindow('clock');
    expect(a).not.toBe(b);
    expect(Object.keys(useWorkspace.getState().windows)).toHaveLength(2);
  });
});
