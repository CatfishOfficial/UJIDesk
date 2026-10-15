import { useUI } from '../../state/ui';

/** Thin periwinkle lines showing what a moving window lines up with. */
export function GuideLayer() {
  const guides = useUI((s) => s.guides);
  if (!guides.length) return null;
  return (
    <div className="guide-layer" aria-hidden="true">
      {guides.map((g, i) =>
        g.axis === 'v' ? (
          <span key={i} className="guide is-v" style={{ left: g.at, top: g.from, height: g.to - g.from }} />
        ) : (
          <span key={i} className="guide is-h" style={{ top: g.at, left: g.from, width: g.to - g.from }} />
        ),
      )}
    </div>
  );
}
