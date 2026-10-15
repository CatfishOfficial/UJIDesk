import { useEffect, useMemo, type ReactNode } from 'react';
import { Calculator, Check, ChevronUp, X } from 'lucide-react';
import { useWindowData, useWorkspace } from '../../../state/store';
import { guideKeys, type CalcModel } from './guide';
import { clearedForGuide } from './clear';

export interface GuideState {
  /** What to work out, e.g. "10 × sin(35)". */
  expr: string;
  /** How many keys have been pressed correctly. */
  pos: number;
  /** The key pressed instead of the expected one, if any. */
  miss?: string | null;
  /** When these directions were given; a new value means the screen was just cleared. */
  at?: number;
  /**
   * Walking through every key. On by default the first time on a model; after
   * that the strip just says what to work out, with the keys on request.
   */
  expanded?: boolean;
}

/** How long "Done" stays before it fades away. */
const DONE_FOR_MS = 5000;

const MODEL_NAME: Record<CalcModel, string> = { basic: 'Basic', scientific: 'Scientific', graphing: 'Graphing', exam: 'Exam' };
const TRIG = /sin|cos|tan/;

/**
 * Lesson key guide for a calculator window: which key to light up next, a
 * tracker to call on every key press, and the strip that shows the sequence.
 * Like the lesson intro, the key-by-key walkthrough happens once per
 * calculator model; after that it folds to "work out …" and waits to be asked.
 */
export function useCalcGuide(winId: string, model: CalcModel, angle: 'deg' | 'rad', onSwitchModel: (m: CalcModel) => void, onFixAngle?: () => void) {
  const [data, update] = useWindowData<{ guide?: GuideState | null } & Record<string, unknown>>(winId);
  const markGuideSeen = useWorkspace((s) => s.markGuideSeen);
  const g = data.guide ?? null;
  const walk = !!g && g.expanded !== false;
  const res = useMemo(() => (g ? guideKeys(g.expr, model) : null), [g?.expr, model]);
  const keys = res?.ok ? res.keys : [];
  const pos = Math.min(g?.pos ?? 0, keys.length);
  const done = !!g && res?.ok && pos >= keys.length;
  const target = walk && res?.ok && !done ? keys[pos].id : null;
  const needsDeg = !!g && TRIG.test(g.expr) && angle === 'rad';

  // Finishing a walkthrough counts as having learned this model's keys.
  useEffect(() => {
    if (done && walk) markGuideSeen(model);
  }, [done, walk, model]);

  // "Done" says its piece, fades, and goes (CSS fades it over the last moment).
  const at = g?.at;
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => update((d) => (d.guide?.at === at ? { guide: null } : {})), DONE_FOR_MS);
    return () => window.clearTimeout(t);
  }, [done, at]);

  const track = (id: string) => {
    if (!g) return;
    // AC / CLEAR: a finished guide goes away; one in progress starts over, since the screen it followed is gone.
    if (id === 'clear') {
      if (done) update({ guide: null });
      else if (g.pos > 0 || g.miss) update({ guide: { ...g, pos: 0, miss: null } });
      return;
    }
    if (!res?.ok || done) return;
    if (id === keys[pos].id) update({ guide: { ...g, pos: pos + 1, miss: null } });
    // Folded up, the student is working on their own: no nagging about keys.
    else if (walk) update({ guide: { ...g, miss: id } });
  };
  const close = () => {
    if (walk) markGuideSeen(model);
    update({ guide: null });
  };
  const fold = () => {
    markGuideSeen(model);
    update({ guide: { ...g!, expanded: false, miss: null } });
  };
  /** Asked for the keys: start the walkthrough over from a clean screen. */
  const showKeys = () => update({ ...clearedForGuide(data), guide: { ...g!, expanded: true, pos: 0, miss: null, at: Date.now() } });

  let bar: ReactNode = null;
  if (g && !walk) {
    bar = (
      <div className={`calc-guide is-folded ${done ? 'is-done' : ''}`} role="region" aria-label="What to work out">
        <div className="calc-guide-head">
          <span className="calc-guide-title">
            {done ? <Check size={13} /> : <Calculator size={13} />}
            <span>
              {done ? 'Done:' : 'Work out'} <span className="calc-guide-expr">{g.expr}</span>
            </span>
          </span>
          <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={close} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
        {!done && res?.ok && (
          <button type="button" className="link-btn calc-guide-show" onClick={showKeys}>
            Show me the keys
          </button>
        )}
        {res && !res.ok && (
          <p className="calc-guide-note">
            The {MODEL_NAME[model]} model can't do {res.needs}.{' '}
            <button type="button" className="link-btn" onClick={() => onSwitchModel(model === 'basic' ? 'scientific' : 'graphing')}>
              Switch to {model === 'basic' ? 'Scientific' : 'Graphing'}
            </button>
          </p>
        )}
        {needsDeg && !done && (
          <p className="calc-guide-note">
            This is in degrees, and the calculator is in radians.{' '}
            {onFixAngle ? (
              <button type="button" className="link-btn" onClick={onFixAngle}>
                Switch to degrees
              </button>
            ) : (
              'Change it in MODE first.'
            )}
          </p>
        )}
      </div>
    );
  } else if (g) {
    bar = (
      <div className={`calc-guide ${done ? 'is-done' : ''}`} role="region" aria-label="Keys to press">
        <div className="calc-guide-head">
          <span className="calc-guide-title">
            {done ? (
              <>
                <Check size={13} /> Done. The answer's on the screen.
              </>
            ) : (
              <>
                Keys for <span className="calc-guide-expr">{g.expr}</span>
              </>
            )}
          </span>
          {!done && res?.ok && (
            <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={fold} aria-label="I’ve got it: hide the keys" title="I’ve got it: hide the keys">
              <ChevronUp size={14} />
            </button>
          )}
          <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={close} aria-label="Dismiss the key guide">
            <X size={13} />
          </button>
        </div>
        {res && !res.ok ? (
          <p className="calc-guide-note">
            The {MODEL_NAME[model]} model can't do {res.needs}.{' '}
            <button type="button" className="link-btn" onClick={() => onSwitchModel(model === 'basic' ? 'scientific' : 'graphing')}>
              Switch to {model === 'basic' ? 'Scientific' : 'Graphing'}
            </button>
          </p>
        ) : (
          <>
            <ol className="calc-guide-keys" aria-label={keys.map((k) => k.label).join(', ')}>
              {keys.map((k, i) => (
                <li key={i} className={i < pos ? 'is-pressed' : i === pos ? 'is-next' : ''}>
                  {k.label}
                </li>
              ))}
            </ol>
            {needsDeg && !done && (
              <p className="calc-guide-note">
                This is in degrees, and the calculator is in radians.{' '}
                {onFixAngle ? (
                  <button type="button" className="link-btn" onClick={onFixAngle}>
                    Switch to degrees
                  </button>
                ) : (
                  'Change it in MODE first.'
                )}
              </p>
            )}
            {g.miss && !done && <p className="calc-guide-note is-miss">That was a different key. Next is {keys[pos]?.label}.</p>}
          </>
        )}
      </div>
    );
  }
  return { target, track, bar, active: !!g };
}
