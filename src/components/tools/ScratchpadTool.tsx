import { useRef, useState } from 'react';
import { Eraser, PenLine, Type, Trash2 } from 'lucide-react';
import { useWindowData, uid } from '../../state/store';
import { useUI } from '../../state/ui';
import { INKS, freehandPath, strokeHit } from '../drawing/ink';

interface PadStroke {
  id: string;
  color: string;
  pts: number[];
}

interface PadData extends Record<string, unknown> {
  text: string;
  strokes: PadStroke[];
  mode: 'type' | 'pen' | 'eraser';
  color?: string;
}

/** Lined paper you can type on or sketch on. Clearing is separate from closing. */
export function ScratchpadTool({ winId }: { winId: string }) {
  const [data, update] = useWindowData<PadData>(winId);
  const toast = useUI((s) => s.toast);
  const [live, setLive] = useState<number[] | null>(null);
  const liveRef = useRef<number[] | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const mode = data.mode ?? 'type';
  const color = data.color ?? 'graphite';
  const strokes = data.strokes ?? [];

  const local = (e: React.PointerEvent) => {
    const r = surface.current!.getBoundingClientRect();
    return [e.clientX - r.left + surface.current!.scrollLeft, e.clientY - r.top + surface.current!.scrollTop];
  };

  const erase = (x: number, y: number) => {
    const keep = strokes.filter((s) => !strokeHit(s.pts, x, y, 8));
    if (keep.length !== strokes.length) update({ strokes: keep });
  };

  const clear = () => {
    const before = { text: data.text, strokes };
    update({ text: '', strokes: [] });
    toast('Page cleared.', { label: 'Undo', run: () => update(before) });
  };

  return (
    <div className="pad">
      <div className="pad-tools" role="toolbar" aria-label="Scratchpad tools">
        <div className="seg">
          <button type="button" aria-pressed={mode === 'type'} onClick={() => update({ mode: 'type' })} title="Type">
            <Type size={14} /> <span>Type</span>
          </button>
          <button type="button" aria-pressed={mode === 'pen'} onClick={() => update({ mode: 'pen' })} title="Sketch">
            <PenLine size={14} /> <span>Sketch</span>
          </button>
          <button type="button" aria-pressed={mode === 'eraser'} onClick={() => update({ mode: 'eraser' })} title="Erase sketches" aria-label="Eraser">
            <Eraser size={14} />
          </button>
        </div>
        {mode === 'pen' && (
          <div className="ink-swatches" role="radiogroup" aria-label="Ink color">
            {['graphite', 'periwinkle', 'coral', 'green'].map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                className="ink-swatch"
                style={{ '--c': INKS[c] } as React.CSSProperties}
                onClick={() => update({ color: c })}
              />
            ))}
          </div>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={clear} disabled={!data.text && !strokes.length} aria-label="Clear this page" title="Clear page (you can undo)">
          <Trash2 size={14} />
        </button>
      </div>
      <div
        ref={surface}
        className={`pad-surface mode-${mode}`}
        onPointerDown={(e) => {
          if (mode === 'type' || e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const [x, y] = local(e);
          if (mode === 'eraser') return erase(x, y);
          liveRef.current = [x, y, e.pressure || 0.5];
          setLive(liveRef.current);
        }}
        onPointerMove={(e) => {
          if (mode === 'type' || !(e.buttons & 1)) return;
          const [x, y] = local(e);
          if (mode === 'eraser') return erase(x, y);
          if (!liveRef.current) return;
          liveRef.current = [...liveRef.current, x, y, e.pressure || 0.5];
          setLive(liveRef.current);
        }}
        onPointerUp={() => {
          if (liveRef.current && liveRef.current.length >= 3) {
            update({ strokes: [...strokes, { id: uid('ps'), color, pts: liveRef.current.map((n) => Math.round(n * 10) / 10) }] });
          }
          liveRef.current = null;
          setLive(null);
        }}
      >
        <textarea
          className="pad-text"
          value={data.text ?? ''}
          onChange={(e) => update({ text: e.target.value })}
          placeholder="Work it out here…"
          aria-label="Scratchpad text"
          spellCheck={false}
          readOnly={mode !== 'type'}
          autoFocus={mode === 'type' && !data.text}
          tabIndex={mode === 'type' ? 0 : -1}
        />
        <svg className="pad-ink" aria-hidden="true">
          {strokes.map((s) => (
            <path key={s.id} d={freehandPath(s.pts, 3.2)} fill={INKS[s.color] ?? INKS.graphite} />
          ))}
          {live && <path d={freehandPath(live, 3.2)} fill={INKS[color]} />}
        </svg>
      </div>
    </div>
  );
}
