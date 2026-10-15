import type { WindowType } from '../../state/types';
import { PixelIcon, type PixelIconName } from './pixel-icons/PixelIcon';

const TOOL_XP: Record<WindowType, PixelIconName> = {
  standardToSlope: 'standardToSlope',
  slopeFromPoints: 'slopeFromPoints',
  calculator: 'calculator',
  graph: 'graph',
  scratchpad: 'scratchpad',
  sticky: 'sticky',
  reference: 'reference',
  timer: 'timer',
  ruler: 'ruler',
  fishbowl: 'fishbowl',
  challenge: 'challenge',
  tripOnDaShip: 'boat',
  clock: 'clock',
  periodicTable: 'periodic',
  nuclearDecay: 'atom',
  pointSlope: 'pointSlope',
  systems: 'systems',
  quadratic: 'quadratic',
  factoring: 'factoring',
  pythag: 'pythag',
  area: 'area',
  trig: 'trig',
  stats: 'stats',
  sequences: 'sums',
};

export const TOOL_ICONS = Object.fromEntries(
  (Object.keys(TOOL_XP) as WindowType[]).map((t) => [t, ({ size = 16 }: { size?: number }) => <PixelIcon name={TOOL_XP[t]} size={size} />]),
) as Record<WindowType, (p: { size?: number }) => JSX.Element>;

export { PixelIcon };
