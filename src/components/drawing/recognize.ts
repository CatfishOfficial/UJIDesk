/**
 * Gentle shape assist. Only snaps strokes that are clearly a line, ellipse or
 * rectangle; anything expressive (handwriting, arrows, doodles) is left alone.
 */
export type Recognized = { tool: 'line' | 'rect' | 'ellipse'; pts: number[] } | null;

export function recognizeShape(flat: number[]): Recognized {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i + 1 < flat.length; i += 3) {
    xs.push(flat[i]);
    ys.push(flat[i + 1]);
  }
  const n = xs.length;
  if (n < 8) return null;
  let L = 0;
  for (let i = 1; i < n; i++) L += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  const chord = Math.hypot(xs[n - 1] - xs[0], ys[n - 1] - ys[0]);
  if (L < 30) return null;

  if (chord / L > 0.95) return { tool: 'line', pts: [xs[0], ys[0], 0.5, xs[n - 1], ys[n - 1], 0.5] };

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  const closed = chord < Math.max(24, 0.15 * L);
  if (!closed || L < 90 || w < 20 || h < 20) return null;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // Normalized radial distance: 1.0 everywhere for a perfect ellipse.
  const radial = xs.map((x, i) => Math.hypot((x - cx) / (w / 2), (ys[i] - cy) / (h / 2)));
  const mean = radial.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(radial.reduce((a, r) => a + (r - mean) ** 2, 0) / n);
  const box = [minX, minY, 0.5, maxX, maxY, 0.5];
  if (sd / mean < 0.09) return { tool: 'ellipse', pts: box };

  const tol = 0.12;
  const nearEdge = xs.filter((x, i) => {
    const y = ys[i];
    return Math.abs(x - minX) < w * tol || Math.abs(x - maxX) < w * tol || Math.abs(y - minY) < h * tol || Math.abs(y - maxY) < h * tol;
  }).length;
  if (nearEdge / n > 0.9) return { tool: 'rect', pts: box };
  return null;
}
