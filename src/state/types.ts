import type { ArrangeSettings } from './snap';

export type WindowType =
  | 'standardToSlope'
  | 'slopeFromPoints'
  | 'calculator'
  | 'graph'
  | 'scratchpad'
  | 'sticky'
  | 'reference'
  | 'timer'
  | 'ruler'
  | 'fishbowl'
  | 'challenge'
  | 'tripOnDaShip'
  | 'clock'
  | 'periodicTable'
  | 'nuclearDecay'
  | 'electronConfig'
  | 'pointSlope'
  | 'systems'
  | 'quadratic'
  | 'factoring'
  | 'pythag'
  | 'area'
  | 'trig'
  | 'stats'
  | 'sequences';

export interface Win {
  id: string;
  type: WindowType;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  data: Record<string, unknown>;
}

export type AssistMode = 'cheat' | 'lesson';

export interface PlacedSticker {
  id: string;
  kind: string;
  /** Centre: board coordinates, or relative to the window's top-left when stuck on one. */
  x: number;
  y: number;
  rot: number;
  scale: number;
  /** The window (or item) it's stuck to, if any. It moves and stacks with it. */
  on?: string;
}

export type StrokeTool = 'pen' | 'highlighter' | 'line' | 'rect' | 'ellipse';

export interface Stroke {
  id: string;
  tool: StrokeTool;
  color: string;
  size: number;
  /** Flat [x, y, pressure, x, y, pressure, …] in board coordinates. */
  pts: number[];
}

export interface RecentProblem {
  windowId: string;
  type: WindowType;
  label: string;
  /** Raw tool input, so the problem can be reopened even if the window is gone. */
  input: Record<string, string>;
  ts: number;
}

export interface Progress {
  /** Spendable tokens, earned in Challenge practice. Never real money. */
  tokens: number;
  /** Lifetime tokens earned, for achievements (spending doesn't lower it). */
  tokensEarned: number;
  solved: number;
  setsFinished: number;
  stickersEarned: string[];
  fishOwned: string[];
  fishSelected: string;
  /** How many of each fish have been caught. */
  catches: Record<string, number>;
  decorOwned: string[];
  /** Decor currently placed in the bowl. */
  decorShown: string[];
  foods: string[];
  /** Unused tickets for da Ship. */
  tickets: { day: number; night: number };
  trips: number;
}

export type ScreenEdge = 'left' | 'right' | 'top' | 'bottom';

/** Where the backpack button sits: an edge of the screen and how far along it (0–1). */
export interface EdgePosition {
  edge: ScreenEdge;
  t: number;
}

export type ThemeChoice = 'light' | 'dark' | 'dynamic';

export interface Settings {
  /** Dynamic follows the clock: dark from 7pm to 6am, like da Ship's night. */
  theme: ThemeChoice;
  grid: boolean;
  motion: 'system' | 'reduced';
  backpackPos?: EdgePosition;
  /** Window arrangement: grid snapping, window snapping, alignment guides. All off by default. */
  arrange: ArrangeSettings;
  /** Overall UI scale (1 = 100%), set by Settings → Text size. */
  uiScale: number;
  /** A tip along the bottom of the screen when UJI opens (see LaunchTip). On unless turned off. */
  tips: boolean;
}
