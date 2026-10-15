import { useEffect, useRef, useState } from 'react';
import { Calculator, Lightbulb, NotebookPen, LineChart, ArrowRight, BookOpen, ChevronDown, Shuffle, Trophy } from 'lucide-react';
import type { LessonDecision } from '../../../math/lessons';
import type { LessonGuide } from '../../../math/teaching';
import { KhanLinks } from './KhanLinks';
import { useWorkspace } from '../../../state/store';
import type { LessonState } from './types';
import { MathView, RichText } from '../../ui/MathView';
import { HandArrow, HandCheck, HandUnderline } from '../../ui/HandDrawn';

interface Props {
  decisions: LessonDecision[];
  state: LessonState;
  onChange: (next: LessonState) => void;
  onHelper: (kind: 'calculator' | 'graph' | 'scratchpad', calc?: string) => void;
  onNext: () => void;
  answer: string;
  caption?: string;
  guide?: LessonGuide;
  /** A fresh problem of the same kind, to practise the method again. */
  onSimilar?: () => void;
  /** A practice set on this topic, for trying it alone. */
  onPractice?: () => void;
  /** Which tool this is, so its intro only opens by itself the first time. */
  tool?: string;
}

const HELPER_LABEL = { calculator: 'Use the calculator', graph: 'See it on a graph', scratchpad: 'Open scratch paper' } as const;
const HELPER_ICON = { calculator: Calculator, graph: LineChart, scratchpad: NotebookPen } as const;

/**
 * Lesson mode, built like a good lesson: say what we're doing and why, name
 * the words that matter, lay out the plan, then work through it one decision
 * at a time, with a short explanation before each question and the reason
 * after each answer (so the finished lesson reads as a worked solution).
 * Equations stay crisp; hints and corrections are hand-written. Unlimited
 * attempts, and "show me" is always available, so nobody gets stuck. It ends
 * with a recap, a way to check the answer, and more practice.
 */
export function LessonPanel({ decisions, state, onChange, onHelper, onNext, answer, caption, guide, onSimilar, onPractice, tool }: Props) {
  // The intro opens by itself only for a tool's first lesson, and folds away
  // once work begins. After that it waits, folded, for whenever it's wanted.
  const seen = useWorkspace((s) => (tool ? s.introSeen.includes(tool) : false));
  const markIntroSeen = useWorkspace((s) => s.markIntroSeen);
  const [introOpen, setIntroOpen] = useState(() => !seen && state.step === 0 && !state.done);
  const started = state.step > 0 || state.done;
  useEffect(() => {
    if (!started) return;
    setIntroOpen(false);
    if (tool) markIntroSeen(tool);
  }, [started]);
  const toggleIntro = () => {
    // Folding it by hand counts as having read it.
    if (introOpen && tool) markIntroSeen(tool);
    setIntroOpen(!introOpen);
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const current = state.done ? undefined : decisions[state.step];
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only move focus when this panel already has it, so we never steal it.
    if (!panelRef.current?.contains(document.activeElement)) return;
    (inputRef.current ?? firstChoiceRef.current)?.focus({ preventScroll: true });
  }, [state.step]);

  const advance = (d: LessonDecision, value: string | undefined, feedback: string | undefined, extra: { shown?: boolean; skipped?: boolean } = {}) => {
    const step = state.step + 1;
    onChange({
      ...state,
      step,
      accepted: { ...state.accepted, [d.id]: value },
      log: { ...state.log, [d.id]: { feedback, ...extra } },
      hints: 0,
      draft: '',
      feedback: null,
      done: step >= decisions.length,
    });
  };

  const submit = (d: LessonDecision, raw: string) => {
    if (!raw.trim()) return;
    const r = d.check(raw);
    if (r.ok) advance(d, r.value, r.feedback);
    else onChange({ ...state, draft: d.input.kind === 'number' ? raw : state.draft, feedback: { ok: false, text: r.feedback } });
  };

  const showMe = (d: LessonDecision) => {
    const r = d.check(d.answer);
    advance(d, r.ok ? r.value : undefined, undefined, { shown: true });
  };

  return (
    <div className="lesson" ref={panelRef}>
      {guide && <LessonIntro guide={guide} open={introOpen} onToggle={toggleIntro} />}
      {decisions.slice(0, state.done ? decisions.length : state.step).map((d) => {
        const log = state.log[d.id];
        return (
          <div key={d.id} className={`lesson-done ${log?.skipped ? 'is-skipped' : ''}`}>
            <span className="lesson-tick">{log?.skipped ? <span className="lesson-skip-dash" aria-hidden="true">–</span> : <HandCheck size={16} tone={log?.shown ? 'ink' : 'green'} />}</span>
            <div>
              {!log?.skipped && <MathView m={d.after} />}
              {log?.skipped && <span className="muted small">Bonus skipped. No harm done.</span>}
              {!log?.skipped && d.why && (
                <p className="lesson-why">
                  <RichText text={d.why} />
                </p>
              )}
              {log?.feedback && <p className="lesson-aside hand">{log.feedback}</p>}
            </div>
          </div>
        );
      })}

      {current && (
        <div className="lesson-current" key={current.id}>
          {current.teach && (
            <div className="lesson-teach">
              <RichText text={current.teach} />
            </div>
          )}
          <p className="lesson-prompt">
            <RichText text={current.prompt} />
          </p>
          {current.context && (
            <div className="lesson-context">
              <MathView m={current.context} size="lg" />
            </div>
          )}

          {current.input.kind === 'number' ? (
            <form
              className="lesson-answer"
              onSubmit={(e) => {
                e.preventDefault();
                submit(current, state.draft);
              }}
            >
              <label className="lesson-answer-label">
                <span className="sr-only">Your answer for {current.input.label}</span>
                {/^[a-z]$/.test(current.input.label) ? <MathView m={`${current.input.label} =`} /> : <span className="lesson-answer-word">{current.input.label}</span>}
              </label>
              <input
                ref={inputRef}
                className={`field field-math ${state.feedback && !state.feedback.ok ? 'is-invalid' : ''}`}
                value={state.draft}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="?"
                onChange={(e) => onChange({ ...state, draft: e.target.value })}
                aria-invalid={!!state.feedback && !state.feedback.ok}
              />
              <button type="submit" className="btn btn-primary" disabled={!state.draft.trim()}>
                Check
              </button>
            </form>
          ) : (
            <div className="lesson-choices" role="group" aria-label="Choose one">
              {current.input.options.map((o, i) => (
                <button key={o.id} ref={i === 0 ? firstChoiceRef : undefined} type="button" className="lesson-choice" onClick={() => submit(current, o.id)}>
                  <RichText text={o.label} />
                </button>
              ))}
            </div>
          )}

          {state.feedback && !state.feedback.ok && (
            <div className="lesson-feedback is-wrong" role="status">
              <HandArrow tone="coral" flip style={{ flex: 'none', marginTop: -2 }} />
              <p className="hand">{state.feedback.text}</p>
            </div>
          )}

          {state.hints > 0 && (
            <div className="lesson-hints">
              {current.hints.slice(0, state.hints).map((h, i) => (
                <p key={i} className="lesson-hint hand">
                  <RichText text={h} />
                </p>
              ))}
            </div>
          )}

          <div className="lesson-actions">
            {state.hints < current.hints.length ? (
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange({ ...state, hints: state.hints + 1 })}>
                <Lightbulb size={14} /> {state.hints === 0 ? 'Hint' : 'Another hint'}
              </button>
            ) : (
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => showMe(current)}>
                <ArrowRight size={14} /> Show me this step
              </button>
            )}
            {current.helper && (
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => onHelper(current.helper!, current.calc)} title={current.calc ? `Shows which keys to press for ${current.calc}` : undefined}>
                {(() => {
                  const I = HELPER_ICON[current.helper];
                  return <I size={14} />;
                })()}
                {HELPER_LABEL[current.helper]}
              </button>
            )}
            {current.optional && (
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => advance(current, undefined, undefined, { skipped: true })}>
                Skip bonus
              </button>
            )}
            <span className="lesson-progress muted small" aria-label={`Step ${state.step + 1} of ${decisions.length}`}>
              {state.step + 1} / {decisions.length}
            </span>
          </div>
        </div>
      )}

      {state.done && (
        <div className="lesson-finish">
          <div className="lesson-finish-answer">
            <MathView m={answer} size="xl" />
            <HandUnderline tone="green" width={160} />
          </div>
          {caption && <p className="muted small">{caption}</p>}
          <p className="lesson-finish-note hand">
            {Object.values(state.log).some((l) => l.shown) ? 'Got there. Next one will feel easier.' : 'All you. Nicely done.'}
          </p>
          {guide && (
            <>
              <div className="lesson-recap">
                <div className="lesson-label">What you did</div>
                <ol>
                  {guide.plan.map((p, i) => (
                    <li key={i}>
                      <RichText text={p} />
                    </li>
                  ))}
                </ol>
              </div>
              <div className="lesson-check">
                <div className="lesson-label">Check it</div>
                <p>
                  <RichText text={guide.check} />
                </p>
              </div>
            </>
          )}
          <div className="lesson-finish-actions">
            {onSimilar && (
              <button type="button" className="btn btn-primary" onClick={onSimilar} title="A new problem of the same kind, to practise the method again">
                <Shuffle size={14} /> Another like this
              </button>
            )}
            {onPractice && (
              <button type="button" className="btn" onClick={onPractice} title="A short Challenge set on this topic, with no guidance">
                <Trophy size={14} /> Try it on your own
              </button>
            )}
            <button type="button" className={`btn ${onSimilar ? 'btn-quiet' : 'btn-primary'}`} onClick={onNext}>
              {onSimilar ? 'Type my own' : 'Next problem'} <ArrowRight size={14} />
            </button>
          </div>
          {guide && guide.khan.length > 0 && <KhanLinks links={guide.khan} title="Learn more on Khan Academy" />}
        </div>
      )}
    </div>
  );
}

/** Before the first question: the goal, the idea, words to know, the plan, and slip-ups to avoid. */
function LessonIntro({ guide, open, onToggle }: { guide: LessonGuide; open: boolean; onToggle: () => void }) {
  const video = guide.khan.find((k) => k.kind === 'video');
  return (
    <section className={`lesson-intro ${open ? 'is-open' : ''}`} aria-label="About this lesson">
      <button type="button" className="lesson-intro-toggle" onClick={onToggle} aria-expanded={open}>
        <BookOpen size={14} aria-hidden="true" />
        <span className="lesson-intro-goal">{open ? guide.goal : 'Review the plan and key ideas'}</span>
        <ChevronDown size={14} aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div className="lesson-intro-body">
          <p className="lesson-idea">
            <RichText text={guide.idea} />
          </p>
          {guide.vocab && guide.vocab.length > 0 && (
            <>
              <div className="lesson-label">Words to know</div>
              <dl className="lesson-vocab">
                {guide.vocab.map((v) => (
                  <div key={v.term}>
                    <dt>{v.term}</dt>
                    <dd>{v.meaning}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          <div className="lesson-label">The plan</div>
          <ol className="lesson-plan">
            {guide.plan.map((p, i) => (
              <li key={i}>
                <RichText text={p} />
              </li>
            ))}
          </ol>
          {guide.watch && guide.watch.length > 0 && (
            <>
              <div className="lesson-label">Watch out for</div>
              <ul className="lesson-watch">
                {guide.watch.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </>
          )}
          {video && (
            <p className="lesson-video muted small">
              Rather watch it first?{' '}
              <a href={video.url} target="_blank" rel="noopener noreferrer">
                {video.title}
              </a>{' '}
              on Khan Academy.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
