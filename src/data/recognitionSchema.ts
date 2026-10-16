import type { WindowType } from '../state/types';
// .js on purpose: api/recognize.ts runs this file as a plain ES module on Vercel (see there).
import { TOOLS } from './tools.js';

/**
 * Pure data, no React — this is imported by both the browser (RecognitionDialog,
 * for labels/placeholders) and the api/recognize.ts serverless function (to build
 * the model's prompt and response schema, and to validate whatever it comes back
 * with). Keeping it dependency-free is what makes that second import safe.
 */
export type RecognitionKind = 'equation' | 'points' | 'any' | 'nuclear' | 'pointSlope' | 'system' | 'quadratic' | 'factoring' | 'pythag' | 'area' | 'trig' | 'list' | 'sequence';

export interface RecognizableField {
  /** Short name for the review step ("Base 1: 4"). */
  label: string;
  /** What goes here and in what format. Sent to the model as this field's schema description. */
  hint: string;
  /** For a choice rather than free text: the only values the tool accepts ('' = left blank). */
  options?: readonly string[];
}

export interface RecognizableTool {
  type: WindowType;
  kind: RecognitionKind;
  /** What this tool's input is called, for the review step's field label. */
  label: string;
  placeholder: string;
  /** One concrete example, shown to the model as a format guide. */
  example: string;
  /** When the model should pick this tool over the others: what the problem asks for, not just what it mentions. */
  when: string;
  /** The exact field names this tool's Inputs use — read from the tool registry, not hand-copied. */
  fields: string[];
  /** A guide to every one of those fields (recognitionSchema.test.ts keeps the two in step). */
  spec: Record<string, RecognizableField>;
}

export interface UncertainSpan {
  /** 0-based [start, end) character indices into the reading. */
  start: number;
  end: number;
  note: string;
}

export interface StructuredGuess {
  type: WindowType;
  inputs: Record<string, string>;
}

function fieldsOf(type: WindowType): string[] {
  const data = TOOLS[type].initialData() as { inputs?: Record<string, string> };
  return Object.keys(data.inputs ?? {});
}

const NUM = 'A plain number as written: whole, decimal or fraction (4, -2.5, 3/4), no units.';
const num = (label: string, what: string): RecognizableField => ({ label, hint: `${what} ${NUM}` });

const BASE: Omit<RecognizableTool, 'fields'>[] = [
  {
    type: 'standardToSlope',
    kind: 'equation',
    label: 'The equation',
    placeholder: '3x + 4y = 12',
    example: '3x + 4y = 12',
    when: 'One linear equation in x and y to rewrite as y = mx + b, or to find its slope and y-intercept.',
    spec: { eq: { label: 'Equation', hint: 'The linear equation as written, with x and y (e.g. 3x + 4y = 12).' } },
  },
  {
    type: 'slopeFromPoints',
    kind: 'points',
    label: 'The two points',
    placeholder: '(2, 3) and (4, 7)',
    example: '(2, 3) and (4, 7)',
    when: 'Two points, when all it asks for is the slope.',
    spec: {
      x1: num('x₁', 'x of the first point.'),
      y1: num('y₁', 'y of the first point.'),
      x2: num('x₂', 'x of the second point.'),
      y2: num('y₂', 'y of the second point.'),
    },
  },
  {
    type: 'pointSlope',
    kind: 'pointSlope',
    label: 'The point and slope',
    placeholder: '(2, 3), slope 4',
    example: '(2, 3), slope 4',
    when: 'The equation of a line through a point with a given slope, or through two points.',
    spec: {
      mode: { label: 'Given', hint: '"slope" when the problem gives one point and a slope; "points" when it gives two points.', options: ['slope', 'points'] },
      x1: num('x₁', 'x of the (first) point.'),
      y1: num('y₁', 'y of the (first) point.'),
      m: { label: 'Slope', hint: 'The slope when mode is "slope": a number or fraction (2, -3/4), or "undefined" for a vertical line. Empty when mode is "points".' },
      x2: num('x₂', 'x of the second point when mode is "points"; empty otherwise.'),
      y2: num('y₂', 'y of the second point when mode is "points"; empty otherwise.'),
    },
  },
  {
    type: 'systems',
    kind: 'system',
    label: 'The two equations',
    placeholder: '2x + 3y = 12, x − y = 1',
    example: '2x + 3y = 12, x - y = 1',
    when: 'Two linear equations in x and y to solve together.',
    spec: {
      eq1: { label: 'Equation 1', hint: 'The first equation in x and y (e.g. 2x + 3y = 12).' },
      eq2: { label: 'Equation 2', hint: 'The second equation in x and y (e.g. x - y = 1).' },
    },
  },
  {
    type: 'quadratic',
    kind: 'quadratic',
    label: 'The equation',
    placeholder: 'x² − 5x + 6 = 0',
    example: 'x^2 - 5x + 6 = 0',
    when: 'A quadratic equation (an x² term and an = sign) to solve: its roots, zeros or solutions.',
    spec: { eq: { label: 'Equation', hint: 'The quadratic equation to solve, with an = sign and ^ for powers (e.g. x^2 - 5x + 6 = 0).' } },
  },
  {
    type: 'factoring',
    kind: 'factoring',
    label: 'The expression',
    placeholder: 'x² + 5x + 6',
    example: '2x^2 + 7x + 3',
    when: 'A quadratic expression to factor (no = sign, or it says to factor).',
    spec: { expr: { label: 'Expression', hint: 'The polynomial to factor, with no = sign and ^ for powers (e.g. 2x^2 + 7x + 3).' } },
  },
  {
    type: 'pythag',
    kind: 'pythag',
    label: 'The sides',
    placeholder: 'legs 3 and 4',
    example: 'legs 5 and 12',
    when: 'A right triangle where only sides matter: a missing side, or whether three lengths make a right triangle. No angle besides the right angle is given or asked for.',
    spec: {
      a: num('Leg a', 'One leg: a side touching the right angle. Empty if it is the side to find.'),
      b: num('Leg b', 'The other leg. Empty if it is the side to find.'),
      c: num('Hypotenuse c', 'The hypotenuse: the side across from the right angle, not touching it. Empty if it is the side to find.'),
    },
  },
  {
    type: 'area',
    kind: 'area',
    label: 'The shape and sizes',
    placeholder: 'circle with radius 5 cm',
    example: 'area of a rectangle 6 by 4 cm',
    when: 'The area, perimeter or circumference of a rectangle, square, triangle, parallelogram, trapezoid or circle, including a right triangle\'s area.',
    spec: {
      shape: { label: 'Shape', hint: 'Which shape the problem is about.', options: ['rectangle', 'square', 'triangle', 'parallelogram', 'trapezoid', 'circle'] },
      unit: { label: 'Units', hint: 'The length unit given, or empty if none is.', options: ['', 'mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'] },
      l: num('Length', 'Rectangle only: the length.'),
      w: num('Width', 'Rectangle only: the width.'),
      s: num('Side', 'Square only: the side.'),
      b: num('Base', 'Triangle or parallelogram: the base.'),
      h: num('Height', 'Triangle, parallelogram or trapezoid: the perpendicular height.'),
      s1: num('Side', 'Optional, for the perimeter: a triangle\'s second side, a parallelogram\'s slanted side, or a trapezoid\'s first leg.'),
      s2: num('Side', 'Optional, for the perimeter: a triangle\'s third side or a trapezoid\'s second leg.'),
      b1: num('Base 1', 'Trapezoid only: one of the parallel sides.'),
      b2: num('Base 2', 'Trapezoid only: the other parallel side.'),
      r: num('Radius', 'Circle only: the radius.'),
      d: num('Diameter', 'Circle only: the diameter, when no radius is given.'),
    },
  },
  {
    type: 'trig',
    kind: 'trig',
    label: 'The angle and side',
    placeholder: 'angle 35°, hypotenuse 10',
    example: 'angle 35 degrees, hypotenuse 10',
    when: 'A right triangle with an acute angle given or asked for: a side from an angle and a side, or an angle from two sides (SOH CAH TOA).',
    spec: {
      angle: num('Angle A', 'Angle A: the acute angle the problem gives, in degrees, no ° sign. Empty when the problem asks for the angle; then A is the angle it asks for. opp and adj are named from A.'),
      opp: num('Opposite', 'The side across from angle A: with lettered corners, the side that touches the right angle but not A. Empty if not given.'),
      adj: num('Adjacent', 'The side between angle A and the right angle: with lettered corners, the side joining those two corners. Empty if not given.'),
      hyp: num('Hypotenuse', 'The side across from the right angle: with lettered corners, the side that doesn\'t touch it. Empty if not given.'),
    },
  },
  {
    type: 'stats',
    kind: 'list',
    label: 'The numbers',
    placeholder: '3, 7, 7, 2, 9',
    example: 'mean of 3, 7, 7, 2, 9',
    when: 'The mean, median, mode or range of a list of numbers.',
    spec: { list: { label: 'Numbers', hint: 'All the data values, comma-separated (e.g. 3, 7, 7, 2, 9).' } },
  },
  {
    type: 'sequences',
    kind: 'sequence',
    label: 'The terms',
    placeholder: '3, 7, 11, 15, …',
    example: '3, 7, 11, 15, …',
    when: 'An arithmetic or geometric sequence: the next term, the nth term, or a sum.',
    spec: {
      terms: { label: 'Terms', hint: 'The given terms in order, comma-separated (e.g. 3, 7, 11, 15).' },
      n: { label: 'Find term', hint: 'Which term number the problem asks for, as a whole number (10 for "the 10th term"). Empty if it doesn\'t ask for one.' },
    },
  },
  {
    type: 'nuclearDecay',
    kind: 'nuclear',
    label: 'The nuclide and decay',
    placeholder: 'Po-210 alpha decay',
    example: 'Po-210 alpha decay',
    when: 'Alpha, beta-minus or positron decay of a given nuclide.',
    spec: {
      el: { label: 'Element', hint: 'The parent element\'s symbol (e.g. Po).' },
      a: { label: 'Mass number', hint: 'The parent\'s mass number, a whole number (e.g. 210).' },
      type: { label: 'Decay', hint: '"alpha"; "beta" for beta-minus (electron) emission; "positron" for beta-plus (positron) emission.', options: ['alpha', 'beta', 'positron'] },
    },
  },
];

export const RECOGNIZABLE_TOOLS: RecognizableTool[] = BASE.map((t) => ({ ...t, fields: fieldsOf(t.type) }));

export const RECOGNIZABLE_BY_KIND: Partial<Record<RecognitionKind, RecognizableTool>> = Object.fromEntries(RECOGNIZABLE_TOOLS.map((t) => [t.kind, t]));

/**
 * Checks a reader's tool guess against the real registry before anything trusts
 * it: a known tool, only that tool's own fields, and every field present, blank
 * if not given. A choice field has to hold one of its choices — a shape the
 * area tool doesn't know would break it, and a made-up default would quietly
 * open the wrong problem — so otherwise the whole guess goes. Null when there's
 * nothing left worth opening a tool for.
 */
export function checkGuess(type: unknown, inputs: unknown): StructuredGuess | null {
  const tool = RECOGNIZABLE_TOOLS.find((t) => t.type === type);
  if (!tool || !inputs || typeof inputs !== 'object') return null;
  const given = inputs as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const f of tool.fields) {
    const v = typeof given[f] === 'string' ? (given[f] as string).trim() : '';
    const options = tool.spec[f].options;
    if (options && !options.includes(v)) return null;
    out[f] = v;
  }
  // A shape or mode with no numbers to go with it isn't a problem yet.
  return tool.fields.some((f) => !tool.spec[f].options && out[f]) ? { type: tool.type, inputs: out } : null;
}

/**
 * Inputs for a tool the student picked by hand when nothing recognized the
 * problem: the text goes in the tool's one text box if it has exactly one (the
 * tool then says what doesn't fit), otherwise the tool opens blank.
 */
export function handPickedInputs(type: WindowType, text: string): Record<string, string> {
  const blank = { ...((TOOLS[type].initialData() as { inputs?: Record<string, string> }).inputs ?? {}) };
  const tool = RECOGNIZABLE_TOOLS.find((t) => t.type === type);
  const free = tool ? tool.fields.filter((f) => !tool.spec[f].options) : [];
  return free.length === 1 ? { ...blank, [free[0]]: text } : blank;
}

/**
 * Turns the reader's unsure bits, quoted back as exact snippets of its own text
 * (models can't count characters reliably, but they can quote), into spans.
 * Searches forward so a repeated snippet lands on the right occurrence; a
 * snippet that isn't in the text is dropped rather than guessed at.
 */
export function locateUncertain(text: string, items: { snippet: string; note: string }[]): UncertainSpan[] {
  const spans: UncertainSpan[] = [];
  let from = 0;
  for (const { snippet, note } of items) {
    if (!snippet) continue;
    let at = text.indexOf(snippet, from);
    if (at < 0) at = text.indexOf(snippet);
    if (at < 0) continue;
    spans.push({ start: at, end: at + snippet.length, note });
    from = at + snippet.length;
  }
  return spans;
}
