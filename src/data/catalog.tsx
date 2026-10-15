import type { InventoryItem } from '../components/ui/InventoryGrid';
import { TOOL_ICONS } from '../components/ui/icons';
import { PixelIcon, type PixelIconName } from '../components/ui/pixel-icons/PixelIcon';
import { TOOLS } from './tools';
import type { WindowType } from '../state/types';

const icon = (t: WindowType, size = 32) => {
  const I = TOOL_ICONS[t];
  return <I size={size} />;
};

const X = (name: PixelIconName, size = 32) => <PixelIcon name={name} size={size} />;

/** Backpack contents. Launchers are never consumed. */
export interface BackpackItem extends InventoryItem {
  action: { kind: 'open'; type: WindowType; data?: Record<string, unknown> } | { kind: 'draw' } | { kind: 'stickers' };
}

const tool = (type: WindowType, category: string, extra: Partial<BackpackItem> = {}): BackpackItem => ({
  id: type,
  name: TOOLS[type].title,
  description: TOOLS[type].description,
  tip: TOOLS[type].tip,
  icon: icon(type, 34),
  category,
  action: { kind: 'open', type },
  ...extra,
});

export const BACKPACK_ITEMS: BackpackItem[] = [
  tool('standardToSlope', 'Lines', { name: 'Standard → y = mx + b', keywords: ['lineshift', 'standard form', 'slope intercept'] }),
  tool('slopeFromPoints', 'Lines', { name: 'Slope from points', keywords: ['riserun', 'rise over run'] }),
  tool('pointSlope', 'Lines', { keywords: ['point slope', 'equation of a line'] }),
  tool('systems', 'Lines', { name: 'Systems', keywords: ['simultaneous', 'elimination', 'substitution', 'intersection'] }),
  tool('quadratic', 'Algebra', { keywords: ['roots', 'zeros', 'discriminant', 'parabola'] }),
  tool('factoring', 'Algebra', { keywords: ['trinomial', 'gcf', 'ac method', 'factorise', 'factorize'] }),
  tool('sequences', 'Algebra', { name: 'Sequences', keywords: ['arithmetic', 'geometric', 'series', 'nth term'] }),
  tool('stats', 'Algebra', { name: 'Mean, median, mode', keywords: ['statistics', 'average', 'range', 'data'] }),
  tool('pythag', 'Geometry', { name: 'Pythagorean', keywords: ['hypotenuse', 'right triangle', 'legs'] }),
  tool('area', 'Geometry', { keywords: ['perimeter', 'circumference', 'circle', 'rectangle', 'triangle', 'trapezoid'] }),
  tool('trig', 'Geometry', { name: 'Triangle trig', keywords: ['sohcahtoa', 'sine', 'cosine', 'tangent', 'angle'] }),
  tool('calculator', 'Instruments'),
  tool('graph', 'Instruments', { name: 'Graph paper' }),
  tool('ruler', 'Instruments'),
  tool('timer', 'Instruments'),
  tool('periodicTable', 'Science', { keywords: ['chemistry', 'elements', 'electron configuration'] }),
  tool('nuclearDecay', 'Science', { keywords: ['alpha', 'beta', 'positron', 'radioactive', 'physics', 'chemistry'] }),
  {
    id: 'sciCalc',
    name: 'Scientific calculator',
    description: 'Trig, logs, powers and factorials.',
    tip: 'The calculator, with its sleeves rolled up.',
    icon: X('calcScientific', 34),
    category: 'Science',
    keywords: ['sin', 'cos', 'tan', 'log', 'trig'],
    action: { kind: 'open', type: 'calculator', data: { model: 'scientific' } },
  },
  {
    id: 'graphCalc',
    name: 'Graphing calculator',
    description: 'Practice the menus of a classroom graphing calculator.',
    tip: 'Y= to it. ENTER at your own risk.',
    icon: X('calcGraphing', 34),
    category: 'Instruments',
    keywords: ['graphing calculator', 'trace', 'table', 'zoom', 'window'],
    action: { kind: 'open', type: 'calculator', data: { model: 'graphing' } },
  },
  {
    id: 'examCalc',
    name: 'Exam calculator',
    description: 'A two-line scientific like the ones allowed on tests.',
    tip: 'Approved for use. Not approved for guessing.',
    icon: X('calcExam', 34),
    category: 'Instruments',
    keywords: ['test', 'sat', 'act', 'scientific', 'fraction'],
    action: { kind: 'open', type: 'calculator', data: { model: 'exam' } },
  },
  tool('scratchpad', 'Paper'),
  tool('sticky', 'Paper', { badge: '×∞' }),
  tool('reference', 'Paper'),
  {
    id: 'stickers',
    name: 'Stickers',
    description: 'Decorate the board a little.',
    tip: 'Personalization, in moderation.',
    icon: X('stickers', 34),
    category: 'Pockets',
    action: { kind: 'stickers' },
  },
  tool('fishbowl', 'Items'),
  tool('clock', 'Items'),
];

/** The searchable math tool library in the main menu. Planned items are honest about it. */
export interface CatalogItem extends InventoryItem {
  opens?: WindowType;
  /** Initial window data, e.g. a calculator model. */
  data?: Record<string, unknown>;
}

export const MATH_CATALOG: CatalogItem[] = [
  {
    id: 'standardToSlope',
    name: 'Standard form → slope-intercept',
    description: 'Ax + By = C becomes y = mx + b, with exact fractions and steps.',
    icon: icon('standardToSlope'),
    category: 'Lines',
    keywords: ['linear', 'equation', 'rearrange', 'lineshift', 'y=mx+b', 'intercept'],
    opens: 'standardToSlope',
  },
  {
    id: 'slopeFromPoints',
    name: 'Slope from two points',
    description: 'Rise over run from two coordinates, including vertical and horizontal lines.',
    icon: icon('slopeFromPoints'),
    category: 'Lines',
    keywords: ['riserun', 'coordinates', 'gradient', 'rise', 'run'],
    opens: 'slopeFromPoints',
  },
  {
    id: 'graph',
    name: 'Graph paper',
    description: 'Plot lines and curves; pan and zoom.',
    icon: icon('graph'),
    category: 'Graphing',
    keywords: ['plot', 'function', 'axes', 'coordinate plane'],
    opens: 'graph',
  },
  {
    id: 'calculator',
    name: 'Basic calculator',
    description: 'Arithmetic with exact fractions on request and a tape.',
    icon: icon('calculator'),
    category: 'Instruments',
    keywords: ['arithmetic', 'compute'],
    opens: 'calculator',
  },
  {
    id: 'graphCalc',
    name: 'Graphing calculator',
    description: 'Practice a classroom graphing calculator: Y=, WINDOW, ZOOM, TRACE, TABLE, MODE and MATH.',
    icon: X('calcGraphing'),
    category: 'Instruments',
    keywords: ['trace', 'table', 'zoom', 'window', 'ti'],
    opens: 'calculator',
    data: { model: 'graphing' },
  },
  {
    id: 'examCalc',
    name: 'Exam calculator',
    description: 'A two-line scientific like the ones allowed on standardized tests.',
    icon: X('calcExam'),
    category: 'Instruments',
    keywords: ['test', 'sat', 'act', 'fraction', 'two line'],
    opens: 'calculator',
    data: { model: 'exam' },
  },
  {
    id: 'reference',
    name: 'Formula sheet',
    description: 'Slope, lines, geometry and quadratics at a glance.',
    icon: icon('reference'),
    category: 'Instruments',
    keywords: ['formulas', 'reference', 'cheat sheet'],
    opens: 'reference',
  },
  {
    id: 'periodicTable',
    name: 'Periodic table',
    description: 'All 118 elements: masses, categories and electron configurations.',
    icon: icon('periodicTable'),
    category: 'Science',
    keywords: ['chemistry', 'elements', 'atomic number', 'electron configuration'],
    opens: 'periodicTable',
  },
  {
    id: 'nuclearDecay',
    name: 'Nuclear decay',
    description: 'Alpha, beta and positron decay with balanced equations and steps.',
    icon: icon('nuclearDecay'),
    category: 'Science',
    keywords: ['alpha', 'beta', 'positron', 'radioactive', 'isotope', 'physics', 'chemistry'],
    opens: 'nuclearDecay',
  },
  {
    id: 'sciCalc',
    name: 'Scientific calculator',
    description: 'Trig in degrees or radians, logs, powers, factorials, ×10ⁿ.',
    icon: X('calcScientific'),
    category: 'Science',
    keywords: ['sin', 'cos', 'tan', 'log', 'ln', 'trig'],
    opens: 'calculator',
    data: { model: 'scientific' },
  },
  {
    id: 'pointSlope',
    name: 'Point-slope form',
    description: 'y − y₁ = m(x − x₁) from a point and a slope, or from two points. Also gives y = mx + b and standard form.',
    icon: icon('pointSlope'),
    category: 'Lines',
    keywords: ['equation of a line', 'point slope'],
    opens: 'pointSlope',
  },
  {
    id: 'systems',
    name: 'Systems of equations',
    description: 'Two lines, one intersection (usually). Elimination or substitution, plus parallel and same-line cases.',
    icon: icon('systems'),
    category: 'Systems',
    keywords: ['simultaneous', 'elimination', 'substitution', 'intersection'],
    opens: 'systems',
  },
  {
    id: 'quadratic',
    name: 'Quadratic formula',
    description: 'Roots of ax² + bx + c = 0 as simplified radicals, the discriminant, and the vertex.',
    icon: icon('quadratic'),
    category: 'Quadratics',
    keywords: ['roots', 'zeros', 'discriminant', 'parabola', 'solve'],
    opens: 'quadratic',
  },
  {
    id: 'factoring',
    name: 'Factoring trinomials',
    description: 'ax² + bx + c into two friendly brackets: GCF first, then the AC method, step by step.',
    icon: icon('factoring'),
    category: 'Quadratics',
    keywords: ['trinomial', 'gcf', 'ac method', 'difference of squares', 'perfect square'],
    opens: 'factoring',
  },
  {
    id: 'pythag',
    name: 'Pythagorean theorem',
    description: 'Missing sides of right triangles, exact roots and decimals, or check if three sides make one.',
    icon: icon('pythag'),
    category: 'Geometry',
    keywords: ['hypotenuse', 'legs', 'right triangle'],
    opens: 'pythag',
  },
  {
    id: 'area',
    name: 'Area & perimeter',
    description: 'Rectangles, squares, triangles, parallelograms, trapezoids and circles, with units.',
    icon: icon('area'),
    category: 'Geometry',
    keywords: ['perimeter', 'circumference', 'circle', 'shapes', 'units'],
    opens: 'area',
  },
  {
    id: 'trig',
    name: 'Right-triangle trig',
    description: 'SOH CAH TOA, with a diagram: missing sides from an angle, or angles from two sides.',
    icon: icon('trig'),
    category: 'Trigonometry',
    keywords: ['sohcahtoa', 'sine', 'cosine', 'tangent', 'inverse'],
    opens: 'trig',
  },
  {
    id: 'stats',
    name: 'Mean, median, mode',
    description: 'Summary statistics for a list, with a dot plot.',
    icon: icon('stats'),
    category: 'Statistics',
    keywords: ['average', 'range', 'data'],
    opens: 'stats',
  },
  {
    id: 'sequences',
    name: 'Sequences & series',
    description: 'Arithmetic and geometric patterns: the rule, the nth term, and sums.',
    icon: icon('sequences'),
    category: 'Algebra',
    keywords: ['arithmetic', 'geometric', 'nth term', 'common difference', 'common ratio'],
    opens: 'sequences',
  },
];

/** Calculator models, sharing the same inventory pattern. */
export const CALCULATOR_MODELS: InventoryItem[] = [
  { id: 'basic', name: 'Basic', description: 'Four functions, roots, percent, and a tape.', icon: X('calculator'), category: 'Models' },
  { id: 'scientific', name: 'Scientific', description: 'Trig (degrees or radians), inverses, logs, powers, factorials, ×10ⁿ and Ans.', icon: X('calcScientific'), category: 'Models' },
  { id: 'graphing', name: 'Graphing', description: 'Practice a classroom graphing calculator: MODE, Y=, WINDOW, ZOOM, GRAPH, TRACE, TABLE and MATH.', icon: X('calcGraphing'), category: 'Models' },
  { id: 'exam', name: 'Exam practice', description: 'A two-line scientific like the ones allowed on tests: n/d fractions, f◂▸d, and its own (−) key.', icon: X('calcExam'), category: 'Models' },
];
