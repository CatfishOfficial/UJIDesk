import type { EdgePosition, ScreenEdge } from '../../state/types';

export const BUTTON = 48;
export const EDGE_GAP = 14;
const CORNER_PULL = 90;

export const DEFAULT_POS: EdgePosition = { edge: 'bottom', t: 0 };

/** Top-left of the button for a stored edge position. */
export function buttonXY(pos: EdgePosition, vw = window.innerWidth, vh = window.innerHeight): { x: number; y: number } {
  const t = Math.min(1, Math.max(0, pos.t));
  const spanX = vw - BUTTON - EDGE_GAP * 2;
  const spanY = vh - BUTTON - EDGE_GAP * 2;
  switch (pos.edge) {
    case 'bottom':
      return { x: EDGE_GAP + t * spanX, y: vh - BUTTON - EDGE_GAP };
    case 'top':
      return { x: EDGE_GAP + t * spanX, y: EDGE_GAP };
    case 'left':
      return { x: EDGE_GAP, y: EDGE_GAP + t * spanY };
    case 'right':
      return { x: vw - BUTTON - EDGE_GAP, y: EDGE_GAP + t * spanY };
  }
}

/** Snaps a free drop point (button centre) to the nearest screen edge, pulling into corners. */
export function snapToEdge(cx: number, cy: number, vw = window.innerWidth, vh = window.innerHeight): EdgePosition {
  const d: [ScreenEdge, number][] = [
    ['left', cx],
    ['right', vw - cx],
    ['top', cy],
    ['bottom', vh - cy],
  ];
  const edge = d.sort((a, b) => a[1] - b[1])[0][0];
  const horizontal = edge === 'top' || edge === 'bottom';
  const span = horizontal ? vw - BUTTON - EDGE_GAP * 2 : vh - BUTTON - EDGE_GAP * 2;
  const along = (horizontal ? cx : cy) - BUTTON / 2 - EDGE_GAP;
  let t = Math.min(1, Math.max(0, along / span));
  if (t * span < CORNER_PULL) t = 0;
  if ((1 - t) * span < CORNER_PULL) t = 1;
  return { edge, t };
}

/** Which corner the button is nearest, for keyboard nudging. */
export function cornerOf(pos: EdgePosition, vw = window.innerWidth, vh = window.innerHeight) {
  const { x, y } = buttonXY(pos, vw, vh);
  return { left: x + BUTTON / 2 < vw / 2, top: y + BUTTON / 2 < vh / 2 };
}

export function cornerPos(left: boolean, top: boolean): EdgePosition {
  return { edge: top ? 'top' : 'bottom', t: left ? 0 : 1 };
}
