import { describe, expect, it } from 'vitest';

// Earning stickers shows a message, which schedules a timer.
(globalThis as { window?: unknown }).window ??= { innerWidth: 1280, innerHeight: 800, setTimeout, clearTimeout };

const { STICKER_BY_KIND, SUBJECT_STICKERS, subjectStickerKind } = await import('./stickers');
const { ALL_TOPICS, subjectStickersFor } = await import('../math/challenge');
const { useWorkspace } = await import('../state/store');

describe('subject stickers', () => {
  it('every practice topic has its own sticker, made from its icon', () => {
    for (const t of ALL_TOPICS) {
      const def = STICKER_BY_KIND[subjectStickerKind(t)];
      expect(def, t).toBeTruthy();
      expect(def.earn).toBeTruthy();
      expect(def.render(48)).toBeTruthy();
    }
    expect(SUBJECT_STICKERS).toHaveLength(ALL_TOPICS.length);
  });

  it('only a perfect set earns stickers: all answered, first try, no answer shown', () => {
    const perfect = [
      { topic: 'slope' as const, attempts: 1 },
      { topic: 'area' as const, attempts: 1 },
      { topic: 'slope' as const, attempts: 1 },
    ];
    expect(subjectStickersFor(perfect, false, 3)).toEqual(['slope', 'area']);
    // Hints that don't give the answer away are fine.
    expect(subjectStickersFor(perfect.map((r) => ({ ...r, revealed: false })), false, 3)).toEqual(['slope', 'area']);
    // A wrong attempt, a shown answer, a skip, an unfinished set, or your own problems: nothing.
    expect(subjectStickersFor([...perfect.slice(0, 2), { topic: 'slope' as const, attempts: 2 }], false, 3)).toEqual([]);
    expect(subjectStickersFor([...perfect.slice(0, 2), { topic: 'slope' as const, attempts: 1, revealed: true }], false, 3)).toEqual([]);
    expect(subjectStickersFor([...perfect.slice(0, 2), { topic: 'slope' as const, skipped: true }], false, 3)).toEqual([]);
    expect(subjectStickersFor(perfect.slice(0, 2), false, 3)).toEqual([]);
    expect(subjectStickersFor(perfect, true, 3)).toEqual([]);
  });

  it('earning is once only', () => {
    useWorkspace.setState((s) => ({ progress: { ...s.progress, stickersEarned: [] } }));
    const earn = useWorkspace.getState().earnStickers;
    expect(earn(['subject-slope', 'subject-area', 'subject-slope'])).toEqual(['subject-slope', 'subject-area']);
    expect(earn(['subject-slope'])).toEqual([]);
    expect(useWorkspace.getState().progress.stickersEarned).toEqual(['subject-slope', 'subject-area']);
  });
});
