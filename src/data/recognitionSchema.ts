import type { WindowType } from '../state/types';
import { TOOLS } from './tools';

/**
 * Pure data, no React — this is imported by both the browser (RecognitionDialog,
 * for labels/placeholders) and the api/recognize.ts serverless function (to build
 * the model's prompt and to validate whatever it comes back with). Keeping it
 * dependency-free is what makes that second import safe.
 */
export type RecognitionKind = 'equation' | 'points' | 'any' | 'nuclear' | 'pointSlope' | 'system' | 'quadratic' | 'factoring' | 'pythag' | 'area' | 'trig' | 'list' | 'sequence';

export interface RecognizableTool {
  type: WindowType;
  kind: RecognitionKind;
  /** What this tool's input is called, for the review step's field label. */
  label: string;
  placeholder: string;
  /** One concrete example, shown to the model as a format guide. */
  example: string;
  /** The exact field names this tool's Inputs use — read from the tool registry, not hand-copied. */
  fields: string[];
}

function fieldsOf(type: WindowType): string[] {
  const data = TOOLS[type].initialData() as { inputs?: Record<string, string> };
  return Object.keys(data.inputs ?? {});
}

const BASE: Omit<RecognizableTool, 'fields'>[] = [
  { type: 'standardToSlope', kind: 'equation', label: 'The equation', placeholder: '3x + 4y = 12', example: '3x + 4y = 12' },
  { type: 'slopeFromPoints', kind: 'points', label: 'The two points', placeholder: '(2, 3) and (4, 7)', example: '(2, 3) and (4, 7)' },
  { type: 'pointSlope', kind: 'pointSlope', label: 'The point and slope', placeholder: '(2, 3), slope 4', example: '(2, 3), slope 4' },
  { type: 'systems', kind: 'system', label: 'The two equations', placeholder: '2x + 3y = 12, x − y = 1', example: '2x + 3y = 12, x - y = 1' },
  { type: 'quadratic', kind: 'quadratic', label: 'The equation', placeholder: 'x² − 5x + 6 = 0', example: 'x^2 - 5x + 6 = 0' },
  { type: 'factoring', kind: 'factoring', label: 'The expression', placeholder: 'x² + 5x + 6', example: '2x^2 + 7x + 3' },
  { type: 'pythag', kind: 'pythag', label: 'The sides', placeholder: 'legs 3 and 4', example: 'legs 5 and 12' },
  { type: 'area', kind: 'area', label: 'The shape and sizes', placeholder: 'circle with radius 5 cm', example: 'rectangle 6 by 4 cm' },
  { type: 'trig', kind: 'trig', label: 'The angle and side', placeholder: 'angle 35°, hypotenuse 10', example: 'angle 35 degrees, hypotenuse 10' },
  { type: 'stats', kind: 'list', label: 'The numbers', placeholder: '3, 7, 7, 2, 9', example: '3, 7, 7, 2, 9' },
  { type: 'sequences', kind: 'sequence', label: 'The terms', placeholder: '3, 7, 11, 15, …', example: '3, 7, 11, 15' },
  { type: 'nuclearDecay', kind: 'nuclear', label: 'The nuclide and decay', placeholder: 'Po-210 alpha decay', example: 'Po-210 alpha decay' },
];

export const RECOGNIZABLE_TOOLS: RecognizableTool[] = BASE.map((t) => ({ ...t, fields: fieldsOf(t.type) }));

export const RECOGNIZABLE_BY_KIND: Partial<Record<RecognitionKind, RecognizableTool>> = Object.fromEntries(RECOGNIZABLE_TOOLS.map((t) => [t.kind, t]));
