import type { ReactNode } from 'react';
import type { Markup } from '../../../math/markup';
import type { Step } from '../../../math/steps';
import type { Accepted, LessonDecision } from '../../../math/lessons';
import type { LessonGuide } from '../../../math/teaching';

export type Inputs = Record<string, string>;

export type SolvedView =
  | {
      ok: true;
      answer: Markup;
      answerPlain: string;
      /** Long answers (several values) read better a size smaller. */
      answerSize?: 'lg' | 'xl';
      caption?: string;
      steps: Step[];
      workHeader: string;
      /** Something the graph window can plot, plus any points to mark (and extra curves). */
      graph?: { text: string; points?: [number, number][]; more?: string[] };
      /** A diagram (triangle, shape, dot plot), shown with the answer and in lessons. */
      figure?: ReactNode;
      /** Secondary results under the answer, like the vertex or other forms. */
      details?: { label: string; value: Markup }[];
      decisions: (accepted: Accepted) => LessonDecision[];
      /** The teaching around the lesson: goal, idea, plan, how to check, Khan Academy links. */
      guide?: LessonGuide;
      /** Plain description of the problem, for history. */
      label: string;
    }
  | { ok: false; error: string; field?: string };

export interface LessonState {
  step: number;
  accepted: Accepted;
  log: Record<string, { feedback?: string; shown?: boolean; skipped?: boolean }>;
  hints: number;
  draft: string;
  feedback: { ok: boolean; text: string } | null;
  done: boolean;
}

export interface HistoryEntry {
  id: string;
  inputs: Inputs;
  label: string;
  answerPlain: string;
  ts: number;
}

export interface ProblemData extends Record<string, unknown> {
  inputs: Inputs;
  /** The inputs that were last solved. Results always reflect these. */
  solved: Inputs | null;
  history: HistoryEntry[];
  showWork: boolean;
  lesson: LessonState | null;
  previous: { label: string; answerPlain: string } | null;
  /** Set when the tool is opened with a problem already typed (e.g. from the backpack). */
  autoSolve?: boolean;
}

export const freshLesson = (): LessonState => ({ step: 0, accepted: {}, log: {}, hints: 0, draft: '', feedback: null, done: false });
