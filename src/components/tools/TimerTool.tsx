import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useWindowData } from '../../state/store';

interface TimerData extends Record<string, unknown> {
  mode: 'countdown' | 'stopwatch';
  duration: number;
  /** Countdown: epoch ms when it ends, or null if paused. */
  endAt: number | null;
  remaining: number;
  /** Stopwatch: epoch ms when (re)started, or null if paused. */
  startedAt: number | null;
  elapsed: number;
  rang?: boolean;
}

const PRESETS = [1, 5, 10, 25];

function fmt(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** A soft two-note chime; no alarms, no modals. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* sound is optional */
  }
}

export function TimerTool({ winId }: { winId: string }) {
  const [d, update] = useWindowData<TimerData>(winId);
  const [, tick] = useState(0);
  const [custom, setCustom] = useState('');
  const rangRef = useRef(false);
  const running = d.mode === 'countdown' ? d.endAt != null : d.startedAt != null;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [running]);

  const now = Date.now();
  const remaining = d.endAt != null ? (d.endAt - now) / 1000 : d.remaining ?? d.duration;
  const elapsed = d.startedAt != null ? d.elapsed + (now - d.startedAt) / 1000 : d.elapsed ?? 0;

  useEffect(() => {
    if (d.mode === 'countdown' && d.endAt != null && remaining <= 0 && !rangRef.current) {
      rangRef.current = true;
      chime();
      update({ endAt: null, remaining: 0, rang: true });
    }
  });

  const start = () => {
    rangRef.current = false;
    if (d.mode === 'countdown') {
      const left = (d.remaining ?? d.duration) > 0 ? d.remaining ?? d.duration : d.duration;
      update({ endAt: Date.now() + left * 1000, rang: false });
    } else update({ startedAt: Date.now() });
  };
  const pause = () => {
    if (d.mode === 'countdown') update({ endAt: null, remaining: Math.max(0, remaining) });
    else update({ startedAt: null, elapsed });
  };
  const reset = () => update(d.mode === 'countdown' ? { endAt: null, remaining: d.duration, rang: false } : { startedAt: null, elapsed: 0 });
  const setDuration = (sec: number) => update({ duration: sec, remaining: sec, endAt: null, rang: false });

  const shown = d.mode === 'countdown' ? remaining : elapsed;
  const progress = d.mode === 'countdown' && d.duration ? 1 - Math.max(0, remaining) / d.duration : 0;

  return (
    <div className="timer">
      <div className="seg seg-sm" role="tablist" aria-label="Timer mode">
        <button type="button" role="tab" aria-selected={d.mode === 'countdown'} onClick={() => update({ mode: 'countdown' })}>
          Timer
        </button>
        <button type="button" role="tab" aria-selected={d.mode === 'stopwatch'} onClick={() => update({ mode: 'stopwatch' })}>
          Stopwatch
        </button>
      </div>
      <div className={`timer-face ${d.rang ? 'is-done' : ''}`} style={{ '--p': progress } as React.CSSProperties}>
        <span className="timer-digits" role="timer" aria-live="off">
          {fmt(shown)}
        </span>
        {d.rang && <span className="hand timer-done">time's up. no rush.</span>}
      </div>
      {d.mode === 'countdown' && !running && (
        <div className="timer-presets">
          {PRESETS.map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={d.duration === m * 60} onClick={() => setDuration(m * 60)}>
              {m}m
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = parseFloat(custom);
              if (n > 0) setDuration(Math.round(n * 60));
              setCustom('');
            }}
          >
            <input className="field timer-custom" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="min" aria-label="Custom minutes" inputMode="decimal" />
          </form>
        </div>
      )}
      <div className="timer-actions">
        {running ? (
          <button type="button" className="btn" onClick={pause}>
            <Pause size={14} /> Pause
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={start}>
            <Play size={14} /> Start
          </button>
        )}
        <button type="button" className="btn btn-quiet" onClick={reset} aria-label="Reset">
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
