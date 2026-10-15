import type { Step } from '../../../math/steps';
import { MathView } from '../../ui/MathView';

export function StepsList({ steps, onWhy }: { steps: Step[]; onWhy?: (lessonId: string) => void }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={s.id} className="step">
          <span className="step-n" aria-hidden="true">
            {i + 1}
          </span>
          <div className="step-body">
            <div className="step-title">
              {s.title}
              {onWhy && s.lesson && (
                <button type="button" className="why-link" onClick={() => onWhy(s.lesson!)} title="Walk through this step in Lesson mode">
                  why?
                </button>
              )}
            </div>
            <div className="step-eq">
              <MathView m={s.eq} />
            </div>
            {s.note && <p className="step-note">{s.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
