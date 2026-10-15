/**
 * Tiny pixel-art toolkit. Sprites are string rows where each character maps
 * to a palette color and "." is transparent. Placeholder art built to be
 * swapped for a pixel artist's sprites later (keep the same grid size).
 */
export type Palette = Record<string, string>;

/** Rects for a sprite, merging horizontal runs to keep the DOM small. */
export function pixelRects(rows: string[], palette: Palette, ox = 0, oy = 0, keyPrefix = ''): JSX.Element[] {
  const rects: JSX.Element[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === '.' || c === ' ' || !palette[c]) continue;
      let run = 1;
      while (x + run < row.length && row[x + run] === c) run++;
      const color = palette[c];
      // Theme-aware colors ("var(--token)") must go through style; SVG fill attributes don't resolve var().
      const paint = color.startsWith('var(') ? { style: { fill: color } } : { fill: color };
      rects.push(<rect key={`${keyPrefix}${x}-${y}`} x={ox + x} y={oy + y} width={run} height={1} {...paint} />);
      x += run - 1;
    }
  });
  return rects;
}

export function Pixel({ rows, palette, size, title, className }: { rows: string[]; palette: Palette; size: number; title?: string; className?: string }) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  return (
    <svg
      width={size}
      height={(size * h) / w}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={`pixel ${className ?? ''}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {pixelRects(rows, palette)}
    </svg>
  );
}

/** Adds a 1px outline (key "@") around every filled pixel: the classic die-cut sticker edge. */
export function withOutline(rows: string[]): string[] {
  const w = Math.max(...rows.map((r) => r.length)) + 2;
  const h = rows.length + 2;
  const grid = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => rows[y - 1]?.[x - 1] ?? '.'));
  const filled = (x: number, y: number) => {
    const c = grid[y]?.[x];
    return !!c && c !== '.' && c !== '@';
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] !== '.') continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) grid[y][x] = '@';
    }
  }
  return grid.map((r) => r.join(''));
}

/** Maps every color in a palette to a flat gray, for "not collected yet". */
export function silhouette(palette: Palette): Palette {
  return Object.fromEntries(Object.keys(palette).map((k) => [k, k === 'K' ? '#a9a7b2' : '#c9c7d0']));
}

/** Writes characters into a copy of the grid at (x, y). "." in the patch is skipped. */
export function stamp(rows: string[], patch: string[], x: number, y: number): string[] {
  const out = rows.map((r) => r.split(''));
  patch.forEach((line, dy) => {
    for (let dx = 0; dx < line.length; dx++) {
      const c = line[dx];
      if (c === '.') continue;
      const row = out[y + dy];
      if (row && x + dx < row.length) row[x + dx] = c;
    }
  });
  return out.map((r) => r.join(''));
}
