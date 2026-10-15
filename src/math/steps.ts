import type { Markup } from './markup';
import { toPlain } from './markup';

export interface Step {
  id: string;
  title: string;
  eq: Markup;
  note?: string;
  /** Id of the lesson decision this step corresponds to, for "why?" links. */
  lesson?: string;
}

export function stepsToPlain(header: string, steps: Step[], answer: string): string {
  const lines = [header, ''];
  steps.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.title}`);
    lines.push(`   ${toPlain(s.eq)}`);
    if (s.note) lines.push(`   (${s.note})`);
  });
  lines.push('', `Answer: ${answer}`);
  return lines.join('\n');
}
