import { pixelRects } from '../../data/pixel';
import { PALETTE } from './pixel-icons/PixelIcon';

/** Three flicker frames of a small flame (r outer, o, y, u core); the dark outline is added below. */
const FRAMES = [
  ['....r....', '...rrr...', '...ror...', '..rooor..', '..royor..', '.rooyoor.', '.royyyor.', 'rooyuyoor', 'royyuyyor', 'royuuuyor', '.ryuuuyr.', '..ryyyr..'],
  ['...r.....', '...rr....', '..rror...', '..roor.r.', '.rooor.r.', '.roooorr.', '.royyoor.', 'rooyyyoor', 'royyuyyor', 'royuuuyor', '.ryuuuyr.', '..ryyyr..'],
  ['.....r...', '....rr...', '...rorr..', '.r.roor..', '.r.rooor.', '.rroooor.', '.rooyyor.', 'rooyyyoor', 'royyuyyor', 'royuuuyor', '.ryuuuyr.', '..ryyyr..'],
];

/** Pads a frame by a pixel and rings every flame pixel in the icons' dark outline. */
function outlined(rows: string[]): string[] {
  const w = rows[0].length + 2;
  const grid = ['.'.repeat(w), ...rows.map((r) => `.${r}.`), '.'.repeat(w)].map((r) => r.split(''));
  const filled = (x: number, y: number) => grid[y]?.[x] !== undefined && grid[y][x] !== '.' && grid[y][x] !== 'K';
  return grid.map((row, y) => row.map((c, x) => (c === '.' && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) ? 'K' : c)).join(''));
}

const ART = FRAMES.map(outlined);

/**
 * A little pixel flame that flickers through its frames. `phase` starts it on a
 * later frame and `flip` mirrors it, so flames side by side don't move in step.
 * Where and when it shows (now and then, or on hover) is up to the CSS around
 * it: see .fire-behind.
 */
export function PixelFire({ scale = 2, phase = 0, flip = false }: { scale?: number; phase?: number; flip?: boolean }) {
  const w = ART[0][0].length;
  const h = ART[0].length;
  const frames = ART.map((_, i) => ART[(i + phase) % ART.length]);
  return (
    <svg
      className="pixel pixel-fire"
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      {frames.map((rows, i) => (
        <g key={i} className={`fire-frame fire-frame-${i}`}>
          {pixelRects(rows, PALETTE, 0, 0, `f${i}-`)}
        </g>
      ))}
    </svg>
  );
}
