/**
 * Hand-drawn guidance marks. Only used for hints, mistakes, emphasis and notes,
 * never for structural UI. Paths are deliberately a little wobbly.
 */
import type { CSSProperties } from 'react';

type Tone = 'accent' | 'green' | 'coral' | 'ink';
const toneVar = (t: Tone) => `var(--${t === 'ink' ? 'ink-2' : t})`;

export function HandUnderline({ tone = 'accent', width = 120, style }: { tone?: Tone; width?: number; style?: CSSProperties }) {
  return (
    <svg className="hand-underline" width={width} height="10" viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true" style={style}>
      <path d="M2 6.5 C 22 3.2, 44 7.8, 64 5.1 S 104 3.4, 118 5.8" fill="none" stroke={toneVar(tone)} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function HandCircle({ tone = 'coral', style }: { tone?: Tone; style?: CSSProperties }) {
  return (
    <svg className="hand-circle" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" style={style}>
      <path
        d="M54 4 C 82 3, 98 16, 96 32 C 94 50, 70 57, 46 56 C 20 55, 3 46, 4 29 C 5 14, 24 5, 48 6 C 60 6, 70 8, 76 11"
        fill="none"
        stroke={toneVar(tone)}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HandArrow({ tone = 'accent', style, flip }: { tone?: Tone; style?: CSSProperties; flip?: boolean }) {
  return (
    <svg className="hand-arrow" width="44" height="28" viewBox="0 0 44 28" aria-hidden="true" style={{ transform: flip ? 'scaleX(-1)' : undefined, ...style }}>
      <path d="M3 22 C 12 10, 24 6, 38 8" fill="none" stroke={toneVar(tone)} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M31 3.5 L 39 8 L 32.5 14" fill="none" stroke={toneVar(tone)} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HandCheck({ tone = 'green', size = 18 }: { tone?: Tone; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="hand-check">
      <path d="M3.5 10.8 C 5.5 12.2, 7 14, 8 16 C 10.5 10.5, 13.5 6.5, 17 3.5" fill="none" stroke={toneVar(tone)} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
