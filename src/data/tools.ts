import type { WindowType } from '../state/types';

export interface ToolMeta {
  type: WindowType;
  title: string;
  description: string;
  /** Tooltip copy. A little wit is allowed here. */
  tip: string;
  size: { w: number; h: number };
  /** A different starting size depending on what it opens with (e.g. a calculator model). */
  sizeFor?: (data: Record<string, unknown>) => { w: number; h: number } | undefined;
  min: { w: number; h: number };
  resizable: boolean;
  /** Only one instance; opening again focuses it. */
  singleton?: boolean;
  /** Counts as active work for "what next?" suggestions. */
  isTask?: boolean;
  /**
   * 'bare' marks an *item*: a frameless, interactable object on the desk (the
   * fishbowl, the clock), drawn as itself with its own right-click menu.
   */
  chrome?: 'default' | 'sticky' | 'clear' | 'bare';
  /** Locked width/height ratio for bare objects. */
  aspect?: number;
  initialData: () => Record<string, unknown>;
  /** Whether closing would lose something worth an undo. */
  hasContent: (data: Record<string, unknown>) => boolean;
}

const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const hasArray = (v: unknown) => Array.isArray(v) && v.length > 0;

/** Shared shape for problem instruments built on ProblemShell. */
const problemTool = (type: WindowType, title: string, description: string, tip: string, inputs: Record<string, string>, size = { w: 440, h: 580 }): ToolMeta => ({
  type,
  title,
  description,
  tip,
  size,
  min: { w: 320, h: 300 },
  resizable: true,
  isTask: true,
  initialData: () => ({ inputs: { ...inputs }, solved: null, history: [], showWork: true, lesson: null, previous: null }),
  // Settings like a chosen shape or unit don't count as content on their own.
  hasContent: (d) =>
    hasArray(d.history) ||
    Object.entries((d.inputs as Record<string, string>) ?? {}).some(([k, v]) => !['shape', 'unit', 'mode'].includes(k) && nonEmpty(v)),
});

export const TOOLS: Record<WindowType, ToolMeta> = {
  standardToSlope: {
    type: 'standardToSlope',
    title: 'Standard → slope-intercept',
    description: 'Rewrite Ax + By = C as y = mx + b, with steps.',
    tip: 'LineShift, all grown up. Turns Ax + By = C into y = mx + b.',
    size: { w: 440, h: 560 },
    min: { w: 320, h: 300 },
    resizable: true,
    isTask: true,
    initialData: () => ({ inputs: { eq: '' }, solved: null, history: [], showWork: true, lesson: null, previous: null }),
    hasContent: (d) => hasArray(d.history) || Object.values((d.inputs as Record<string, string>) ?? {}).some(nonEmpty),
  },
  slopeFromPoints: {
    type: 'slopeFromPoints',
    title: 'Slope from two points',
    description: 'Rise over run from (x₁, y₁) and (x₂, y₂).',
    tip: 'RiseRun, now with feelings about vertical lines.',
    size: { w: 440, h: 580 },
    min: { w: 320, h: 300 },
    resizable: true,
    isTask: true,
    initialData: () => ({ inputs: { x1: '', y1: '', x2: '', y2: '' }, solved: null, history: [], showWork: true, lesson: null, previous: null }),
    hasContent: (d) => hasArray(d.history) || Object.values((d.inputs as Record<string, string>) ?? {}).some(nonEmpty),
  },
  calculator: {
    type: 'calculator',
    title: 'Calculator',
    description: 'A basic calculator that remembers its tape.',
    tip: 'Does arithmetic. Will not do your taxes.',
    size: { w: 300, h: 460 },
    sizeFor: (d) => ({ scientific: { w: 320, h: 610 }, graphing: { w: 350, h: 760 }, exam: { w: 320, h: 600 } })[d.model as string],
    min: { w: 240, h: 380 },
    resizable: true,
    initialData: () => ({ model: 'basic', expr: '', tape: [] }),
    hasContent: (d) => hasArray(d.tape),
  },
  graph: {
    type: 'graph',
    title: 'Graph',
    description: 'Plot y = … lines and curves, pan and zoom.',
    tip: 'Graph paper that never runs out of squares.',
    size: { w: 480, h: 440 },
    min: { w: 300, h: 280 },
    resizable: true,
    initialData: () => ({ equations: [], view: { cx: 0, cy: 0, scale: 32 } }),
    hasContent: (d) => hasArray(d.equations),
  },
  scratchpad: {
    type: 'scratchpad',
    title: 'Scratchpad',
    description: 'Lined paper for typing or sketching work.',
    tip: 'For the work that happens between the problem and the answer.',
    size: { w: 380, h: 360 },
    min: { w: 240, h: 200 },
    resizable: true,
    initialData: () => ({ text: '', strokes: [], mode: 'type' }),
    hasContent: (d) => nonEmpty(d.text) || hasArray(d.strokes),
  },
  sticky: {
    type: 'sticky',
    title: 'Sticky note',
    description: 'A small note. Make as many as you like.',
    tip: 'Infinite supply. Physics was not consulted.',
    size: { w: 220, h: 200 },
    min: { w: 160, h: 140 },
    resizable: true,
    chrome: 'sticky',
    initialData: () => ({ text: '', color: 'sun' }),
    hasContent: (d) => nonEmpty(d.text),
  },
  reference: {
    type: 'reference',
    title: 'Formulas',
    description: 'Slope, lines, geometry and more at a glance.',
    tip: 'The cheat sheet your teacher would actually allow.',
    size: { w: 380, h: 480 },
    min: { w: 280, h: 260 },
    resizable: true,
    initialData: () => ({ topic: 'lines', q: '' }),
    hasContent: () => false,
  },
  timer: {
    type: 'timer',
    title: 'Timer',
    description: 'A quiet countdown or stopwatch.',
    tip: 'Counts down without counting on you.',
    size: { w: 260, h: 250 },
    min: { w: 220, h: 220 },
    resizable: true,
    initialData: () => ({ mode: 'countdown', duration: 300, endAt: null, remaining: 300, startedAt: null, elapsed: 0 }),
    hasContent: (d) => d.endAt != null || d.startedAt != null,
  },
  ruler: {
    type: 'ruler',
    title: 'Ruler',
    description: 'A see-through ruler for measuring on screen.',
    tip: 'Measures in screen centimetres, which are close enough.',
    size: { w: 460, h: 104 },
    min: { w: 200, h: 104 },
    resizable: true,
    chrome: 'clear',
    initialData: () => ({ unit: 'cm' }),
    hasContent: () => false,
  },
  fishbowl: {
    type: 'fishbowl',
    title: 'Fishbowl',
    description: 'Your selected fish, idling quietly.',
    tip: 'Low maintenance. Emotionally, medium maintenance.',
    size: { w: 300, h: 225 },
    min: { w: 140, h: 105 },
    resizable: true,
    chrome: 'bare',
    aspect: 80 / 60,
    // One bowl per desk: it shows your one collection.
    singleton: true,
    initialData: () => ({}),
    hasContent: () => false,
  },
  challenge: {
    type: 'challenge',
    title: 'Challenge',
    description: 'Practice sets with unlimited attempts and hints.',
    tip: 'Practice with no punishment, only points.',
    size: { w: 440, h: 560 },
    min: { w: 320, h: 380 },
    resizable: true,
    isTask: true,
    initialData: () => ({ phase: 'setup', mix: 'slope', difficulty: 'regular', count: 5 }),
    // Closing a set ends it (no undo), so it can't be closed, solved elsewhere, and reopened.
    hasContent: () => false,
  },
  tripOnDaShip: {
    type: 'tripOnDaShip',
    title: 'Trip on da Ship',
    description: 'Buy a ticket, sail out, and catch fish for your bowl.',
    tip: 'Tickets cost tokens. Tokens come from practice. Fish come from patience.',
    size: { w: 480, h: 520 },
    min: { w: 340, h: 360 },
    resizable: true,
    singleton: true,
    initialData: () => ({ phase: 'shop' }),
    hasContent: (d) => d.phase === 'trip',
  },
  clock: {
    type: 'clock',
    title: 'Clock',
    description: 'A desk clock: 80s LED or modern. Right-click to switch.',
    tip: 'Tells time. Judges nothing.',
    size: { w: 240, h: 102 },
    min: { w: 120, h: 51 },
    resizable: true,
    chrome: 'bare',
    aspect: 80 / 34,
    initialData: () => ({ look: 'retro', h24: false }),
    hasContent: () => false,
  },
  periodicTable: {
    type: 'periodicTable',
    title: 'Periodic table',
    description: 'All 118 elements, with masses and electron configurations.',
    tip: 'Every element, alphabetized by physics.',
    size: { w: 840, h: 540 },
    min: { w: 520, h: 380 },
    resizable: true,
    initialData: () => ({ selected: [], q: '', highlight: [], overlay: 'category', compare: 'radius' }),
    hasContent: () => false,
  },
  nuclearDecay: {
    type: 'nuclearDecay',
    title: 'Nuclear decay',
    description: 'Alpha, beta and positron decay, balanced step by step.',
    tip: 'Atoms, but make it dramatic.',
    size: { w: 460, h: 600 },
    min: { w: 330, h: 320 },
    resizable: true,
    isTask: true,
    initialData: () => ({ inputs: { el: '', a: '', type: '' }, solved: null, history: [], showWork: true, lesson: null, previous: null }),
    hasContent: (d) => hasArray(d.history) || Object.values((d.inputs as Record<string, string>) ?? {}).some(nonEmpty),
  },
  electronConfig: {
    type: 'electronConfig',
    title: 'Electron configuration',
    description: 'Atoms and ions, long form and noble-gas short form, with steps.',
    tip: 'Where every electron lives, and why it moved in there.',
    size: { w: 480, h: 660 },
    min: { w: 340, h: 340 },
    resizable: true,
    isTask: true,
    initialData: () => ({ inputs: { el: '', charge: '', form: 'long' }, solved: null, history: [], showWork: true, lesson: null, previous: null }),
    // The Long/Short choice is a setting, not content.
    hasContent: (d) => hasArray(d.history) || Object.entries((d.inputs as Record<string, string>) ?? {}).some(([k, v]) => k !== 'form' && nonEmpty(v)),
  },
  pointSlope: problemTool(
    'pointSlope',
    'Point-slope form',
    'y − y₁ = m(x − x₁) from a point and a slope, or two points.',
    'For when the line gives you one point and an attitude.',
    { mode: 'slope', x1: '', y1: '', m: '', x2: '', y2: '' },
  ),
  systems: problemTool('systems', 'Systems of equations', 'Where two lines meet, by elimination or substitution.', 'Two lines walk into a graph. Usually they meet.', { eq1: '', eq2: '' }, { w: 460, h: 620 }),
  quadratic: problemTool('quadratic', 'Quadratic formula', 'Roots of ax² + bx + c = 0, exact and simplified.', 'The song you learned it to still works.', { eq: '' }, { w: 460, h: 620 }),
  factoring: problemTool('factoring', 'Factoring', 'ax² + bx + c into brackets: GCF, then the AC method.', 'Un-multiplying, with receipts.', { expr: '' }),
  pythag: problemTool('pythag', 'Pythagorean theorem', 'The missing side of a right triangle, or check if it is one.', 'a² + b² = c², since roughly 500 BC.', { a: '', b: '', c: '' }, { w: 440, h: 600 }),
  area: problemTool('area', 'Area & perimeter', 'Rectangles, triangles, trapezoids, circles, with units.', 'How much paint, and how much tape.', { shape: 'rectangle', unit: '', l: '', w: '', s: '', b: '', h: '', s1: '', s2: '', b1: '', b2: '', r: '', d: '' }, { w: 460, h: 620 }),
  trig: problemTool('trig', 'Right-triangle trig', 'SOH CAH TOA: missing sides and angles.', 'Some Old Horse Caught Another Horse Taking Oats Away.', { angle: '', opp: '', adj: '', hyp: '' }, { w: 460, h: 640 }),
  stats: problemTool('stats', 'Mean, median, mode', 'Summary statistics for a list of numbers.', 'Three kinds of average walk into a bar. They disagree.', { list: '' }),
  sequences: problemTool('sequences', 'Sequences & series', 'Arithmetic and geometric: next term, nth term, sums.', 'Spot the pattern before it spots you.', { terms: '', n: '' }),
};
