import { useEffect, useRef, useState } from 'react';
import { useWindowData } from '../../state/store';

/** CSS reference pixels per unit. Screens vary, so these are "screen" units. */
const PX = { cm: 96 / 2.54, in: 96 };

export function RulerTool({ winId }: { winId: string }) {
  const [d, update] = useWindowData<{ unit: 'cm' | 'in' }>(winId);
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(400);
  const unit = d.unit ?? 'cm';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const per = PX[unit];
  const sub = unit === 'cm' ? 10 : 8;
  const ticks: JSX.Element[] = [];
  for (let i = 0; i * (per / sub) <= w; i++) {
    const x = 8 + i * (per / sub);
    const major = i % sub === 0;
    const mid = !major && i % (sub / 2) === 0;
    ticks.push(<line key={i} x1={x} x2={x} y1={0} y2={major ? 22 : mid ? 15 : 9} className={major ? 'r-major' : 'r-minor'} />);
    if (major && i > 0) ticks.push(<text key={`t${i}`} x={x} y={34} textAnchor="middle" className="r-label">{i / sub}</text>);
  }

  return (
    <div className="ruler" ref={ref}>
      <svg width="100%" height="44" aria-hidden="true">
        {ticks}
      </svg>
      <button type="button" className="ruler-unit" onClick={() => update({ unit: unit === 'cm' ? 'in' : 'cm' })} title="Switch units">
        {unit}
      </button>
    </div>
  );
}
