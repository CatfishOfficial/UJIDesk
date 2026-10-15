import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Lightbulb, RotateCcw, SkipForward, Sparkles } from 'lucide-react';
import { useWindowData, useWorkspace } from '../../state/store';
import {
  ALL_TOPICS,
  challengeFields,
  challengeHints,
  checkChallenge,
  generateSet,
  pointsFor,
  problemPrompt,
  subjectStickersFor,
  TOPIC_LABEL,
  type ChallengeCheck,
  type ChallengeMix,
  type ChallengeProblem,
  type Difficulty,
} from '../../math/challenge';
import { parsePointsInput, solveSlopeFromPoints } from '../../math/slopeFromPoints';
import { solveStandardToSlope } from '../../math/standardToSlope';
import { detectProblem } from '../../math/detect';
import { TOPICS, type NewTopic } from '../../math/challengeTopics';
import { DotPlot, PointPlot, RightTriangle, ShapeFigure, TermStrip, type ShapeKind } from './figures';
import { Rational } from '../../math/rational';
import { SHAPES } from '../../math/geometry';
import { SIDE_NAME, type TrigSide } from '../../math/trig';
import { parseNumberList } from '../../math/surd';
import { aSub } from '../../math/sequences';
import { toPlain } from '../../math/markup';
import { STICKER_BY_KIND, subjectStickerKind } from '../../data/stickers';
import { MathView, RichText } from '../ui/MathView';
import { HandCheck, HandUnderline } from '../ui/HandDrawn';

interface Result {
  points: number;
  firstTry: boolean;
  skipped?: boolean;
  topic?: ChallengeProblem['topic'];
}

interface ChallengeData extends Record<string, unknown> {
  phase: 'setup' | 'playing' | 'summary';
  mix: ChallengeMix;
  difficulty: Difficulty;
  count: number;
  seed?: number;
  custom?: ChallengeProblem[];
  index?: number;
  answers?: Record<string, string>;
  attempts?: number;
  hints?: number;
  check?: ChallengeCheck | null;
  solved?: boolean;
  results?: Result[];
  /** Subject stickers earned by finishing this set, for the summary. */
  newStickers?: string[];
}

const MIXES: { id: ChallengeMix; label: string }[] = [{ id: 'mixed', label: 'Mixed' }, ...ALL_TOPICS.map((t) => ({ id: t, label: TOPIC_LABEL[t] }))];
const DIFFS: { id: Difficulty; label: string; tip: string }[] = [
  { id: 'gentle', label: 'Gentle', tip: 'Small whole numbers, friendly answers.' },
  { id: 'regular', label: 'Regular', tip: 'Fractions and negatives, the odd special case.' },
  { id: 'spicy', label: 'Spicy', tip: 'Bigger numbers and trickier forms.' },
];

/** Topics a typed problem can become; the slope and standard-form ones keep their own shapes. */
const DETECTED_TOPIC: Partial<Record<string, NewTopic>> = {
  pointSlope: 'pointSlope',
  systems: 'systems',
  quadratic: 'quadratic',
  factoring: 'factoring',
  pythag: 'pythag',
  area: 'area',
  trig: 'trig',
  stats: 'stats',
  sequences: 'sequences',
};

export function ChallengeTool({ winId }: { winId: string }) {
  const [d, update] = useWindowData<ChallengeData>(winId);
  const addTokens = useWorkspace((s) => s.addTokens);
  const recordSolve = useWorkspace((s) => s.recordSolve);
  const finishSet = useWorkspace((s) => s.finishSet);
  const earnStickers = useWorkspace((s) => s.earnStickers);
  const totalPoints = useWorkspace((s) => s.progress.tokens);

  const problems = useMemo<ChallengeProblem[]>(
    () => d.custom ?? (d.seed != null ? generateSet(d.mix, d.difficulty, d.count, d.seed) : []),
    [d.custom, d.seed, d.mix, d.difficulty, d.count],
  );

  const start = (custom?: ChallengeProblem[]) =>
    update({
      phase: 'playing',
      seed: custom ? undefined : Math.floor(Math.random() * 1e9),
      custom,
      index: 0,
      answers: {},
      attempts: 0,
      hints: 0,
      check: null,
      solved: false,
      results: [],
    });

  if (d.phase === 'setup' || problems.length === 0) return <Setup d={d} update={update} start={start} totalPoints={totalPoints} />;

  if (d.phase === 'summary') {
    const results = d.results ?? [];
    const earned = results.reduce((a, r) => a + r.points, 0);
    const firstTry = results.filter((r) => r.firstTry).length;
    return (
      <div className="chal chal-summary">
        <h3 className="chal-done-title">
          Set complete.
          <HandUnderline tone="green" width={150} />
        </h3>
        <p>
          {firstTry} of {results.length} on the first try. <strong>+{earned}</strong> tokens.
        </p>
        <p className="hand chal-note">{firstTry === results.length ? 'Clean sweep. Very tidy.' : 'Every attempt counted. Nothing was lost.'}</p>
        {(d.newStickers?.length ?? 0) > 0 && (
          <div className="chal-stickers" aria-label="New stickers">
            <div className="lesson-label">New sticker{d.newStickers!.length > 1 ? 's' : ''}</div>
            <ul>
              {d.newStickers!.map((k) => (
                <li key={k} title={STICKER_BY_KIND[k]?.description}>
                  {STICKER_BY_KIND[k]?.render(48)}
                  <span>{STICKER_BY_KIND[k]?.name}</span>
                </li>
              ))}
            </ul>
            <p className="muted small">They’re in your backpack, under Stickers.</p>
          </div>
        )}
        <div className="chal-actions">
          <button type="button" className="btn btn-primary" onClick={() => (update({ newStickers: [] }), start(d.custom))}>
            <RotateCcw size={14} /> Another set
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => update({ phase: 'setup' })}>
            Change settings
          </button>
        </div>
      </div>
    );
  }

  const index = d.index ?? 0;
  const problem = problems[Math.min(index, problems.length - 1)];
  return (
    <Play
      key={problem.id}
      d={d}
      update={update}
      problem={problem}
      index={index}
      total={problems.length}
      onSolved={(pts, firstTry) => {
        addTokens(pts);
        recordSolve();
        update((cur) => ({ solved: true, results: [...(cur.results ?? []), { points: pts, firstTry, topic: problem.topic }] }));
      }}
      onNext={(skipped) => {
        const results = skipped ? [...(d.results ?? []), { points: 0, firstTry: false, skipped: true }] : d.results ?? [];
        if (index + 1 >= problems.length) {
          const fresh = earnStickers(subjectStickersFor(results, !!d.custom).map(subjectStickerKind));
          update({ phase: 'summary', results, newStickers: fresh });
          finishSet();
        } else {
          update({ index: index + 1, answers: {}, attempts: 0, hints: 0, check: null, solved: false, results });
        }
      }}
    />
  );
}

function Setup({ d, update, start, totalPoints }: { d: ChallengeData; update: (p: Partial<ChallengeData>) => void; start: (c?: ChallengeProblem[]) => void; totalPoints: number }) {
  const [own, setOwn] = useState<{ text: string; error?: string } | null>(null);

  /** Any problem the tools recognise can be practised; it's checked by the same solver. */
  const startOwn = () => {
    if (!own) return;
    const d = detectProblem(own.text);
    const id = `own-${Date.now()}`;
    if (!d) return setOwn({ ...own, error: "Couldn't tell what kind of problem that is. Try 3x + 4y = 12, x² − 5x + 6 = 0, or legs 3 and 4." });
    if (d.type === 'standardToSlope') {
      const r = solveStandardToSlope(d.inputs.eq);
      if (r.kind === 'error') return setOwn({ ...own, error: r.message });
      return start([{ id, topic: 'standard', equation: d.inputs.eq }]);
    }
    if (d.type === 'slopeFromPoints') {
      const { x1, y1, x2, y2 } = d.inputs;
      const p = parsePointsInput({ x1, y1, x2, y2 });
      if (!p.ok) return setOwn({ ...own, error: p.error });
      if (solveSlopeFromPoints(p.value).kind === 'error') return setOwn({ ...own, error: 'Those are the same point twice.' });
      return start([{ id, topic: 'slope', x1, y1, x2, y2 }]);
    }
    const topic = DETECTED_TOPIC[d.type];
    if (!topic) return setOwn({ ...own, error: 'That one has a tool, but no practice mode yet.' });
    const spec = { ...d.inputs };
    // A typed trig problem asks for the first unknown; a point-slope one needs a slope.
    if (topic === 'trig') spec.want = spec.angle ? (['opp', 'adj', 'hyp'].find((k) => !spec[k]) ?? 'opp') : 'A';
    if (topic === 'pointSlope' && spec.mode === 'points') return setOwn({ ...own, error: 'Give a point and a slope, like (2, 3), slope 4.' });
    const problem: ChallengeProblem = { id, topic, spec };
    const fields = challengeFields(problem);
    if (!fields.length || !challengeHints(problem).length || !Object.keys(TOPICS[topic].answers(spec)).length)
      return setOwn({ ...own, error: "That one can't be checked as practice. Open its tool instead." });
    start([problem]);
  };

  return (
    <div className="chal chal-setup">
      <p className="chal-intro">
        Unlimited attempts. Hints whenever you want them. Each correct answer earns tokens for tickets on da Ship.
        {totalPoints > 0 && <span className="chal-points-quiet"> You have {totalPoints}.</span>}
      </p>

      <fieldset className="chal-group">
        <legend className="field-label">Practice</legend>
        <div className="inv-chips">
          {MIXES.map((m) => (
            <button key={m.id} type="button" className="chip" aria-pressed={d.mix === m.id} onClick={() => update({ mix: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="chal-group">
        <legend className="field-label">Difficulty</legend>
        <div className="inv-chips">
          {DIFFS.map((x) => (
            <button key={x.id} type="button" className="chip" title={x.tip} aria-pressed={d.difficulty === x.id} onClick={() => update({ difficulty: x.id })}>
              {x.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="chal-group">
        <legend className="field-label">Length</legend>
        <div className="inv-chips">
          {[5, 10].map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={d.count === n} onClick={() => update({ count: n })}>
              {n} problems
            </button>
          ))}
        </div>
      </fieldset>
      <button type="button" className="btn btn-primary chal-start" onClick={() => start()}>
        Start practice <ArrowRight size={14} />
      </button>

      <div className="chal-own">
        {own ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startOwn();
            }}
          >
            <input
              className={`field field-math ${own.error ? 'is-invalid' : ''}`}
              autoFocus
              value={own.text}
              onChange={(e) => setOwn({ text: e.target.value })}
              placeholder="x² − 5x + 6 = 0, or legs 3 and 4"
              aria-label="Your problem"
            />
            {own.error && <p className="field-error">{own.error}</p>}
            <button type="submit" className="btn btn-sm">
              Practice this one
            </button>
          </form>
        ) : (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOwn({ text: '' })}>
            <Sparkles size={13} /> Bring your own problem
          </button>
        )}
      </div>
    </div>
  );
}

function Play({
  d,
  update,
  problem,
  index,
  total,
  onSolved,
  onNext,
}: {
  d: ChallengeData;
  update: (p: Partial<ChallengeData>) => void;
  problem: ChallengeProblem;
  index: number;
  total: number;
  onSolved: (points: number, firstTry: boolean) => void;
  onNext: (skipped: boolean) => void;
}) {
  const fields = useMemo(() => challengeFields(problem), [problem]);
  const hints = useMemo(() => challengeHints(problem), [problem]);
  const prompt = useMemo(() => problemPrompt(problem), [problem]);
  const answers = d.answers ?? {};
  const hintsUsed = d.hints ?? 0;
  const revealed = hintsUsed >= hints.length;
  const firstRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [gained, setGained] = useState<number | null>(null);

  useEffect(() => {
    if (d.solved) nextRef.current?.focus();
    else firstRef.current?.focus({ preventScroll: true });
  }, [d.solved]);

  const check = () => {
    if (d.solved) return onNext(false);
    if (fields.some((f) => !(answers[f.key] ?? '').trim())) return;
    const res = checkChallenge(problem, answers);
    const attempts = (d.attempts ?? 0) + 1;
    update({ check: res, attempts });
    if (res.correct) {
      // Your own problems are for practice only, so they can't be farmed for tickets.
      const pts = revealed || d.custom ? 0 : pointsFor(hintsUsed, attempts);
      setGained(pts);
      onSolved(pts, attempts === 1 && hintsUsed === 0);
    }
  };

  return (
    <div className="chal chal-play">
      <div className="chal-progress" aria-label={`Problem ${index + 1} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`chal-dot ${i < index ? 'is-done' : i === index ? 'is-now' : ''}`} />
        ))}
      </div>
      <p className="chal-prompt">{prompt.text}</p>
      <ChallengeFigure problem={problem} />
      <div className="chal-problem">
        <MathView m={prompt.math} size="xl" />
      </div>

      <form
        className="chal-form"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <div className="chal-fields">
          {fields.map((f, i) => {
            const fc = d.check?.fields[f.key];
            return (
              <div key={f.key} className="chal-field">
                <label className={`chal-label ${f.label ? '' : 'is-wide'}`}>
                  {f.label ? <MathView m={`${f.label} =`} /> : <span className="sr-only">Your answer</span>}
                  <input
                    ref={i === 0 ? firstRef : undefined}
                    className={`field field-math ${fc && !fc.ok ? 'is-invalid' : ''} ${fc?.ok ? 'is-right' : ''}`}
                    value={answers[f.key] ?? ''}
                    disabled={d.solved}
                    onChange={(e) => update({ answers: { ...answers, [f.key]: e.target.value }, check: d.check ? { ...d.check, correct: false } : null })}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={fc ? !fc.ok : undefined}
                  />
                </label>
                {fc && !fc.ok && !d.solved && <p className="chal-field-note hand">{fc.note ?? 'Not quite yet.'}</p>}
              </div>
            );
          })}
        </div>

        {d.solved ? (
          <div className="chal-correct" role="status">
            <HandCheck size={22} />
            <span>Correct.</span>
            {gained != null && gained > 0 && <span className="chal-gain">+{gained}</span>}
            <span style={{ flex: 1 }} />
            <button ref={nextRef} type="submit" className="btn btn-primary">
              {index + 1 >= total ? 'Finish' : 'Next'} <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className="chal-actions">
            <button type="submit" className="btn btn-primary">
              Check
            </button>
            {!revealed && (
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => update({ hints: hintsUsed + 1 })}>
                <Lightbulb size={14} /> {hintsUsed === hints.length - 1 ? 'Show the answer' : hintsUsed ? 'Another hint' : 'Hint'}
              </button>
            )}
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => onNext(true)} title="Skip with no penalty">
              <SkipForward size={14} /> Skip
            </button>
            {(d.attempts ?? 0) > 0 && !d.check?.correct && <span className="muted small chal-again">Try again, as many times as you like.</span>}
          </div>
        )}
      </form>

      {hintsUsed > 0 && (
        <div className="lesson-hints">
          {hints.slice(0, hintsUsed).map((h, i) => (
            <p key={i} className="lesson-hint hand">
              <RichText text={h} />
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A picture for the question, when it helps without giving the answer away:
 * triangles, shapes, plotted points, a dot plot, the terms in boxes. Systems,
 * quadratics, factoring and standard form stay as text: a graph would show
 * the answer.
 */
function ChallengeFigure({ problem }: { problem: ChallengeProblem }) {
  const num = (t?: string) => {
    const r = t?.trim() ? Rational.parse(t.replace(/−/g, '-')) : null;
    return r && r.sign() > 0 ? r.toNumber() : null;
  };
  let fig: ReactNode = null;
  if (problem.topic === 'slope') {
    const pts = [Rational.parse(problem.x1), Rational.parse(problem.y1), Rational.parse(problem.x2), Rational.parse(problem.y2)];
    if (pts.every(Boolean))
      fig = (
        <PointPlot
          points={[
            [pts[0]!.toNumber(), pts[1]!.toNumber()],
            [pts[2]!.toNumber(), pts[3]!.toNumber()],
          ]}
        />
      );
  } else if ('spec' in problem) {
    const s = problem.spec;
    switch (problem.topic) {
      case 'pointSlope': {
        const x = Rational.parse(s.x1);
        const y = Rational.parse(s.y1);
        const m = Rational.parse(s.m);
        if (x && y) fig = <PointPlot points={[[x.toNumber(), y.toNumber()]]} note={m ? `slope ${m.toString().replace('-', '−')}` : undefined} />;
        break;
      }
      case 'pythag': {
        const [a, b, c] = [num(s.a), num(s.b), num(s.c)];
        const shape = a && b ? { base: b, height: a } : c && a && c > a ? { base: Math.sqrt(c * c - a * a), height: a } : c && b && c > b ? { base: b, height: Math.sqrt(c * c - b * b) } : { base: 4, height: 3 };
        const lab = (k: 'a' | 'b' | 'c') => ({ text: s[k] ? `${k} = ${s[k]}` : `${k} = ?`, unknown: !s[k] });
        fig = <RightTriangle base={shape.base} height={shape.height} baseLabel={lab('b')} heightLabel={lab('a')} hypLabel={lab('c')} />;
        break;
      }
      case 'trig': {
        const A = num(s.angle);
        const [o, a, h] = [num(s.opp), num(s.adj), num(s.hyp)];
        const shape = A
          ? { base: Math.cos((A * Math.PI) / 180), height: Math.sin((A * Math.PI) / 180) }
          : o && a
            ? { base: a, height: o }
            : h && o && h > o
              ? { base: Math.sqrt(h * h - o * o), height: o }
              : h && a && h > a
                ? { base: a, height: Math.sqrt(h * h - a * a) }
                : { base: 4, height: 3 };
        const side = (k: TrigSide) => (s[k] ? { text: `${SIDE_NAME[k]} ${s[k]}` } : { text: s.want === k ? `${SIDE_NAME[k]} = ?` : SIDE_NAME[k], unknown: s.want === k });
        fig = (
          <RightTriangle
            base={shape.base}
            height={shape.height}
            baseLabel={side('adj')}
            heightLabel={side('opp')}
            hypLabel={side('hyp')}
            angleLabel={A ? { text: `A = ${s.angle}°` } : { text: 'A = ?', unknown: true }}
          />
        );
        break;
      }
      case 'area': {
        const def = SHAPES.find((x) => x.id === s.shape);
        if (def) {
          const labels = Object.fromEntries(def.fields.map((f) => [f.key, s[f.key] ? `${s[f.key]}${s.unit ? ` ${s.unit}` : ''}` : '']));
          fig = <ShapeFigure shape={s.shape as ShapeKind} labels={labels} />;
        }
        break;
      }
      case 'stats': {
        const l = parseNumberList(s.list);
        if (l.ok) fig = <DotPlot values={l.values} />;
        break;
      }
      case 'sequences': {
        const l = parseNumberList(s.terms);
        if (l.ok) fig = <TermStrip terms={l.values.map((v) => v.toString().replace('-', '−'))} next={s.n ? `${toPlain(aSub(s.n))} = ?` : '?'} skip={!!s.n} />;
        break;
      }
    }
  }
  return fig ? (
    <div className="chal-figure">
      {fig}
    </div>
  ) : null;
}
