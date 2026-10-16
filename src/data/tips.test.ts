import { describe, expect, it } from 'vitest';
import { TIPS, tipText } from './tips';

describe('launch tips', () => {
  it('stay short enough for one line along the bottom of the screen', () => {
    for (const t of TIPS) expect(t.length, t).toBeLessThanOrEqual(110);
  });

  it('use the right modifier key, and wrap around after the last tip', () => {
    const k = TIPS.findIndex((t) => t.includes('{mod}'));
    expect(tipText(k, true)).toContain('⌘+K');
    expect(tipText(k, false)).toContain('Ctrl+K');
    expect(tipText(k + TIPS.length, false)).toBe(tipText(k, false));
  });
});
