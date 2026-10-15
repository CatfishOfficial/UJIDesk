import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Camera, Copy, ClipboardList, History, LineChart, RotateCcw, ArrowRight, ChevronDown, CornerDownLeft, Sparkles } from 'lucide-react';
import { useWorkspace, useWindowData, uid, usePracticeLock } from '../../../state/store';
import { PixelIcon } from '../../ui/pixel-icons/PixelIcon';
import { stepsToPlain } from '../../../math/steps';
import { MathView } from '../../ui/MathView';
import { HandArrow } from '../../ui/HandDrawn';
import { StepsList } from './StepsList';
import { LessonPanel } from './LessonPanel';
import { RecognitionDialog, type RecognitionKind } from './RecognitionDialog';
import { copyText, openHelper, sendToGraph } from '../bridge';
import { freshLesson, type Inputs, type LessonState, type ProblemData, type SolvedView } from './types';
import type { WindowType } from '../../../state/types';
import { PRACTICE_TOPIC, similarProblem } from '../../../math/similar';
import type { ProblemType } from '../../../math/detect';
import { KhanLinks } from './KhanLinks';

export interface InputRenderArgs {
  inputs: Inputs;
  setInput: (key: string, value: string) => void;
  setInputs: (inputs: Inputs) => void;
  invalidField?: string;
  firstRef: RefObject<HTMLInputElement>;
}

interface Props {
  winId: string;
  type: WindowType;
  solve: (inputs: Inputs) => SolvedView;
  renderInputs: (args: InputRenderArgs) => ReactNode;
  emptyInputs: Inputs;
  examples: Inputs[];
  recognition: RecognitionKind;
  fromRecognized: (text: string) => Inputs | null;
}

const sameInputs = (a: Inputs | null, b: Inputs) => !!a && Object.keys(b).every((k) => (a[k] ?? '').trim() === (b[k] ?? '').trim());

/**
 * Shared shell for reusable problem instruments: input, solve, result, work,
 * lesson, next problem and history. A single window handles problem after problem.
 */
export function ProblemShell({ winId, type, solve, renderInputs, emptyInputs, examples, recognition, fromRecognized }: Props) {
  const [data, update] = useWindowData<ProblemData>(winId);
  const mode = useWorkspace((s) => s.mode);
  const setMode = useWorkspace((s) => s.setMode);
  const pushRecent = useWorkspace((s) => s.pushRecent);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [importing, setImporting] = useState<{ image: string | null } | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const locked = usePracticeLock();
  const lessonRef = useRef<HTMLDivElement>(null);

  const inputs = data.inputs ?? emptyInputs;
  const solvedView = useMemo(() => (data.solved ? solve(data.solved) : null), [data.solved, solve]);
  const lesson = data.lesson ?? freshLesson();
  const decisions = useMemo(() => (solvedView?.ok ? solvedView.decisions(lesson.accepted) : []), [solvedView, lesson.accepted]);
  const edited = !!data.solved && !sameInputs(data.solved, inputs);
  const isEmpty = Object.values(inputs).every((v) => !v.trim());

  const setInputs = (next: Inputs) => {
    update({ inputs: next });
    if (error) setError(null);
  };

  const submit = (override?: Inputs) => {
    const target = override ?? inputs;
    if (Object.values(target).every((v) => !v.trim())) {
      firstRef.current?.focus();
      return;
    }
    const view = solve(target);
    if (!view.ok) {
      setError({ text: view.error, field: view.field });
      return;
    }
    setError(null);
    const changed = !sameInputs(data.solved, target);
    const entry = { id: uid('h'), inputs: target, label: view.label, answerPlain: view.answerPlain, ts: Date.now() };
    update((d) => ({
      inputs: target,
      solved: target,
      lesson: changed ? freshLesson() : d.lesson,
      history: changed ? [entry, ...(d.history ?? []).filter((h) => h.label !== view.label)].slice(0, 15) : d.history,
    }));
    pushRecent({ windowId: winId, type, label: view.label, input: target, ts: Date.now() });
  };

  /** Clears for the next problem, but keeps the last answer visible until a new one replaces it. */
  const nextProblem = () => {
    update({
      inputs: { ...emptyInputs },
      solved: null,
      lesson: null,
      previous: solvedView?.ok ? { label: solvedView.label, answerPlain: solvedView.answerPlain } : data.previous,
    });
    setError(null);
    requestAnimationFrame(() => firstRef.current?.focus());
  };

  const setLesson = (next: LessonState) => update({ lesson: next });

  /** Another problem of the same kind, solved straight away so the lesson starts over on it. */
  const trySimilar = () => {
    const next = similarProblem(type as ProblemType, data.solved ?? inputs);
    if (next) submit(next);
    requestAnimationFrame(() => lessonRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };
  const practiceTopic = PRACTICE_TOPIC[type as ProblemType];
  /** A Challenge set on this topic: the "on your own" step. */
  const practice = () => {
    const ws = useWorkspace.getState();
    const existing = Object.values(ws.windows).find((w) => w.type === 'challenge');
    if (existing) {
      if (existing.data.phase !== 'playing') ws.updateData(existing.id, { mix: practiceTopic, phase: 'setup' });
      ws.restore(existing.id);
    } else ws.openWindow('challenge', { near: winId, data: { mix: practiceTopic } });
  };

  const why = (lessonId: string) => {
    const idx = decisions.findIndex((d) => d.id === lessonId);
    setMode('lesson');
    if (idx >= 0) {
      const cur = data.lesson ?? freshLesson();
      update({ lesson: { ...cur, step: idx, done: false, hints: 0, feedback: null, draft: '' } });
    }
    requestAnimationFrame(() => lessonRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  // A problem typed in the backpack (on open, or into this already-open tool): solve it straight away.
  useEffect(() => {
    if (!data.autoSolve) return;
    update({ autoSolve: false });
    submit(data.inputs);
  }, [data.autoSolve]);

  // Paste a screenshot straight into the tool to start an import.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-window-id="${winId}"]`);
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      if (importing) return;
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        setImporting({ image: URL.createObjectURL(file) });
      }
    };
    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  }, [winId, importing]);

  if (locked) return <PracticePause />;

  return (
    <div className="problem">
      <div className="problem-top">
        <button
          type="button"
          className={`mode-pill is-${mode}`}
          onClick={() => setMode(mode === 'cheat' ? 'lesson' : 'cheat')}
          title="Switch help style (also in your backpack). Your problem stays put."
        >
          <span className="mode-pill-dot" aria-hidden="true" />
          {mode === 'cheat' ? 'Cheat' : 'Lesson'}
          <span className="sr-only">mode. Switch to {mode === 'cheat' ? 'Lesson' : 'Cheat'}.</span>
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setImporting({ image: null })} title="Photo, upload, or paste a screenshot">
          <Camera size={14} /> Import
        </button>
        {(data.history?.length ?? 0) > 0 && (
          <button type="button" className={`btn btn-quiet btn-sm ${showHistory ? 'is-on' : ''}`} onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}>
            <History size={14} /> Recent
          </button>
        )}
      </div>

      {showHistory && (
        <ul className="history">
          {data.history.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="history-item"
                onClick={() => {
                  submit(h.inputs);
                  setShowHistory(false);
                }}
                title="Bring this problem back"
              >
                <span className="history-label">{h.label}</span>
                <span className="history-answer">{h.answerPlain}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="problem-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {renderInputs({
          inputs,
          setInputs,
          setInput: (k, v) => setInputs({ ...inputs, [k]: v }),
          invalidField: error?.field,
          firstRef,
        })}
        <div className="problem-actions">
          <button type="submit" className="btn btn-primary">
            {mode === 'cheat' ? 'Solve' : 'Guide me'} <CornerDownLeft size={13} aria-hidden="true" style={{ opacity: 0.7 }} />
          </button>
          {(data.solved || !isEmpty) && (
            <button type="button" className="btn btn-quiet" onClick={nextProblem} title="Clear the inputs for a new problem">
              <RotateCcw size={14} /> Next problem
            </button>
          )}
          {isEmpty && !data.solved && (
            <button
              type="button"
              className="btn btn-quiet btn-sm try-example"
              onClick={() => {
                // An example is for seeing how it's done, so it always walks through the lesson.
                if (mode !== 'lesson') setMode('lesson');
                submit(examples[Math.floor(Math.random() * examples.length)]);
              }}
            >
              <Sparkles size={13} /> Try an example
            </button>
          )}
        </div>
        {error && (
          <div className="problem-error" role="alert">
            <HandArrow tone="coral" flip style={{ flex: 'none' }} />
            <p className="hand">{error.text}</p>
          </div>
        )}
      </form>

      {!data.solved && data.previous && (
        <div className="previous">
          <span className="muted small">Previous</span>
          <span className="previous-label">{data.previous.label}</span>
          <span className="previous-answer">{data.previous.answerPlain}</span>
          <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={() => copyText(data.previous!.answerPlain, 'Answer copied')} aria-label="Copy previous answer">
            <Copy size={13} />
          </button>
        </div>
      )}

      {solvedView && !solvedView.ok && <p className="problem-error hand">{solvedView.error}</p>}

      {solvedView?.ok && (
        <div className="result-area">
          {edited && (
            <p className="edited-note">
              Showing the last solved problem. Press <kbd>Enter</kbd> to solve your edit.
            </p>
          )}

          {mode === 'cheat' ? (
            <>
              <div className="result-card">
                <div className="result-answer">
                  <MathView m={solvedView.answer} size={solvedView.answerSize ?? 'xl'} />
                </div>
                {solvedView.caption && <p className="result-caption">{solvedView.caption}</p>}
                {solvedView.details && solvedView.details.length > 0 && (
                  <dl className="result-details">
                    {solvedView.details.map((d) => (
                      <div key={d.label} className="result-detail">
                        <dt>{d.label}</dt>
                        <dd>
                          <MathView m={d.value} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {solvedView.figure && <div className="result-figure">{solvedView.figure}</div>}
                <div className="result-actions">
                  <button type="button" className="btn btn-sm" onClick={() => copyText(solvedView.answerPlain, 'Answer copied')}>
                    <Copy size={13} /> Copy answer
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => copyText(stepsToPlain(solvedView.workHeader, solvedView.steps, solvedView.answerPlain), 'Work copied')}
                  >
                    <ClipboardList size={13} /> Copy work
                  </button>
                  {solvedView.graph && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        const g = solvedView.graph!;
                        for (const t of g.more ?? []) sendToGraph(winId, t);
                        sendToGraph(winId, g.text, g.points);
                      }}
                    >
                      <LineChart size={13} /> Graph it
                    </button>
                  )}
                </div>
              </div>
              <button type="button" className="work-toggle" onClick={() => update({ showWork: !data.showWork })} aria-expanded={data.showWork}>
                <ChevronDown size={14} style={{ transform: data.showWork ? 'none' : 'rotate(-90deg)' }} /> Show your work
              </button>
              {data.showWork && (
                <>
                  <StepsList steps={solvedView.steps} onWhy={why} />
                  {solvedView.guide && solvedView.guide.khan.length > 0 && <KhanLinks links={solvedView.guide.khan.slice(0, 2)} title="Learn it on Khan Academy" compact />}
                </>
              )}
            </>
          ) : (
            <div ref={lessonRef}>
              <LessonPanel
                decisions={decisions}
                state={lesson}
                onChange={setLesson}
                onHelper={(k, calc) => openHelper(winId, k, calc)}
                onNext={nextProblem}
                answer={solvedView.answer}
                caption={solvedView.caption}
                guide={solvedView.guide}
                onSimilar={trySimilar}
                onPractice={practiceTopic ? practice : undefined}
                tool={type}
              />
              {!lesson.done && (
                <button type="button" className="work-toggle subtle" onClick={() => setMode('cheat')}>
                  Just show me the answer <ArrowRight size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {importing && (
        <RecognitionDialog
          kind={recognition}
          initialImage={importing.image}
          onClose={() => setImporting(null)}
          onUse={(result) => {
            setImporting(null);
            // A confident structured guess for a *different* tool opens that tool instead of
            // force-fitting it into this one; for this tool, its fields are more reliable than
            // re-parsing the text through fromRecognized.
            if (result.structured) {
              if (result.structured.type === type) {
                const next = { ...emptyInputs, ...result.structured.inputs };
                setInputs(next);
                submit(next);
              } else {
                useWorkspace.getState().openWindow(result.structured.type, { data: { inputs: result.structured.inputs, autoSolve: true } });
              }
              return;
            }
            const parsed = fromRecognized(result.text);
            if (parsed) submit(parsed);
            else {
              setInputs({ ...emptyInputs, ...(recognition === 'equation' ? { eq: result.text } : {}) });
              setError({ text: "Couldn't turn that into a problem. Check the inputs above." });
            }
          }}
        />
      )}
    </div>
  );
}

/** Shown instead of a solver while a Challenge set is running, so practice stays honest. */
function PracticePause() {
  const windows = useWorkspace((s) => s.windows);
  const restore = useWorkspace((s) => s.restore);
  const practice = Object.values(windows).find((w) => w.type === 'challenge' && w.data.phase === 'playing');
  return (
    <div className="practice-pause">
      <PixelIcon name="challenge" size={48} />
      <p className="practice-pause-title">Paused for practice</p>
      <p className="muted small">
        Solvers take a break while a Challenge set is going. The calculator, graph paper, scratch paper and formulas still work.
      </p>
      {practice && (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => restore(practice.id)}>
          Back to practice
        </button>
      )}
      <p className="hand practice-pause-note">it'll be right here when you're done.</p>
    </div>
  );
}
