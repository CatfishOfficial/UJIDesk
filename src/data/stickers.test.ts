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

  it('a finished set earns the topics answered correctly, never skipped ones or your own problems', () => {
    const results = [
      { topic: 'slope' as const },
      { topic: 'trig' as const, skipped: true },
      { topic: 'area' as const },
      { topic: 'slope' as const },
    ];
    expect(subjectStickersFor(results, false).sort()).toEqual(['area', 'slope']);
    expect(subjectStickersFor(results, true)).toEqual([]);
    expect(subjectStickersFor([{ points: 0 } as never], false)).toEqual([]);
  });

  it('earning is once only', () => {
    useWorkspace.setState((s) => ({ progress: { ...s.progress, stickersEarned: [] } }));
    const earn = useWorkspace.getState().earnStickers;
    expect(earn(['subject-slope', 'subject-area', 'subject-slope'])).toEqual(['subject-slope', 'subject-area']);
    expect(earn(['subject-slope'])).toEqual([]);
    expect(useWorkspace.getState().progress.stickersEarned).toEqual(['subject-slope', 'subject-area']);
  });
});
