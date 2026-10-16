import { useMemo, useRef, useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { useWorkspace } from '../../state/store';
import { useUI } from '../../state/ui';
import { detectProblem, extractPoints, type DetectedProblem } from '../../math/detect';
import { LayoutGrid } from 'lucide-react';
import { PixelIcon } from '../ui/pixel-icons/PixelIcon';
import { PixelFire } from '../ui/PixelFire';
import { TOOL_ICONS } from '../ui/icons';
import { TOOLS } from '../../data/tools';
import { UI_EXAMPLES } from '../../data/recognitionSchema';
import type { WindowType } from '../../state/types';

type ProblemTool = DetectedProblem['type'];
const PINNED: ProblemTool[] = ['standardToSlope', 'slopeFromPoints'];

const SHORT: Record<string, string> = {
  standardToSlope: 'Standard → y = mx + b',
  slopeFromPoints: 'Slope from two points',
  nuclearDecay: 'Nuclear decay',
  pointSlope: 'Point-slope form',
  systems: 'Systems of equations',
  quadratic: 'Quadratic formula',
  factoring: 'Factoring',
  pythag: 'Pythagorean theorem',
  area: 'Area & perimeter',
  trig: 'Right-triangle trig',
  stats: 'Mean, median, mode',
  sequences: 'Sequences & series',
};

/**
 * "Just type it": always at the top of the backpack. The problem type is
 * detected from what's typed; students can also pick a tool. If that tool is
 * already open, the problem loads into it instead of opening another window.
 */
export function QuickProblem({ onImport, paused }: { onImport: () => void; paused?: boolean }) {
  const openWindow = useWorkspace((s) => s.openWindow);
  const restore = useWorkspace((s) => s.restore);
  const updateData = useWorkspace((s) => s.updateData);
  const setBackpack = useUI((s) => s.setBackpack);
  const [text, setText] = useState('');
  const [unsure, setUnsure] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const detected = useMemo(() => detectProblem(text), [text]);

  const launch = (type: WindowType, inputs?: Record<string, string>) => {
    const existing = Object.values(useWorkspace.getState().windows)
      .filter((w) => w.type === type)
      .sort((a, b) => b.z - a.z)[0];
    if (existing) {
      if (inputs) updateData(existing.id, { inputs, autoSolve: true });
      restore(existing.id);
    } else openWindow(type, { data: inputs ? { inputs, autoSolve: true } : undefined });
    setText('');
    setBackpack(false);
  };

  const pick = (type: ProblemTool) => {
    const t = text.trim();
    if (!t) return launch(type);
    if (detected?.type === type) return launch(type, detected.inputs);
    // Hand over what was typed even if it doesn't parse yet; the tool explains what's wrong.
    if (type === 'standardToSlope') return launch(type, { eq: t });
    if (type === 'slopeFromPoints') return launch(type, extractPoints(t) ?? undefined);
    return launch(type);
  };
  // The two classics stay put; a detected tool joins them so the row shows what Enter will do.
  const shown: ProblemTool[] = detected && !PINNED.includes(detected.type) ? [detected.type, ...PINNED] : PINNED;

  return (
    <section className={`quick ${paused ? 'is-paused' : ''}`} aria-label="Start a problem">
      <form
        className="quick-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (detected) launch(detected.type, detected.inputs);
          else if (text.trim()) setUnsure(true);
          else inputRef.current?.focus();
        }}
      >
        <input
          ref={inputRef}
          className="field field-math quick-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setUnsure(false);
          }}
          placeholder={paused ? 'Paused while you practice' : 'Type a problem…'}
          disabled={paused}
          aria-label="Type a problem, like 3x + 4y = 12, x² − 5x + 6 = 0, or (2, 3) and (4, 7)"
          autoComplete="off"
          spellCheck={false}
          autoFocus={!paused}
        />
        <button type="button" className="quick-import glisten" disabled={paused} onClick={onImport} title="Photo, upload, or paste a screenshot" aria-label="Import a problem from a photo or screenshot">
          <PixelIcon name="camera" size={24} />
        </button>
        <button type="submit" className="btn btn-primary quick-go" disabled={paused || !text.trim()} aria-label="Solve">
          <CornerDownLeft size={15} />
        </button>
      </form>

      <p className="quick-hint" aria-live="polite">
        {paused ? (
          <span className="muted">Solvers are taking a break until your practice set is done.</span>
        ) : detected ? (
          <>
            {(() => {
              const I = TOOL_ICONS[detected.type];
              return <I size={16} />;
            })()}
            <span>
              Enter opens <strong>{SHORT[detected.type]}</strong>
            </span>
          </>
        ) : unsure ? (
          <span className="hand quick-unsure">Not sure which tool that is. Pick one:</span>
        ) : (
          <span className="muted">Like {UI_EXAMPLES.bag}. Or pick a tool:</span>
        )}
      </p>

      <div className="quick-tools">
        {shown.map((t) => {
          const I = TOOL_ICONS[t];
          return (
            <button key={t} type="button" className={`quick-tool ${detected?.type === t ? 'is-match' : ''}`} disabled={paused} onClick={() => pick(t)} title={TOOLS[t].description}>
              <I size={26} />
              <span>{SHORT[t]}</span>
            </button>
          );
        })}
        <button type="button" className="quick-tool has-fire" onClick={() => launch('challenge')} title={TOOLS.challenge.description}>
          <span className="fire-behind" aria-hidden="true">
            <PixelFire phase={1} />
            <PixelFire />
            <PixelFire phase={2} flip />
          </span>
          <PixelIcon name="challenge" size={26} />
          <span>Practice</span>
        </button>
        {shown.length < 3 && (
          <button type="button" className="quick-tool is-more" onClick={() => setBackpack(true, 'catalog')} title="Every math tool, searchable">
            <LayoutGrid size={20} aria-hidden="true" />
            <span>All tools</span>
          </button>
        )}
      </div>
    </section>
  );
}
