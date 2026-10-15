import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { useWindowData } from '../../state/store';
import { MathView } from '../ui/MathView';

interface Formula {
  name: string;
  m: string;
  note?: string;
  keywords?: string;
}

const TOPICS: { id: string; name: string; items: Formula[] }[] = [
  {
    id: 'lines',
    name: 'Lines',
    items: [
      { name: 'Slope', m: 'm = {y_2 - y_1/x_2 - x_1}', note: 'Rise over run. Undefined when x₁ = x₂.', keywords: 'gradient rise run' },
      { name: 'Slope-intercept form', m: 'y = mx + b', note: 'm is the slope, b is where it crosses the y-axis.' },
      { name: 'Point-slope form', m: 'y - y_1 = m(x - x_1)' },
      { name: 'Standard form', m: 'Ax + By = C', note: 'Slope is −A/B; y-intercept is C/B.' },
      { name: 'Horizontal line', m: 'y = b', note: 'Slope 0.' },
      { name: 'Vertical line', m: 'x = a', note: 'Slope undefined.' },
      { name: 'Parallel and perpendicular', m: 'm_1 = m_2,   m_1 · m_2 = -1', note: 'Perpendicular slopes are negative reciprocals.' },
    ],
  },
  {
    id: 'coordinates',
    name: 'Coordinates',
    items: [
      { name: 'Distance', m: 'd = √{(x_2 - x_1)^2 + (y_2 - y_1)^2}', keywords: 'length between points' },
      { name: 'Midpoint', m: 'M = ({x_1 + x_2/2}, {y_1 + y_2/2})' },
    ],
  },
  {
    id: 'algebra',
    name: 'Algebra',
    items: [
      { name: 'Distributive property', m: 'a(b + c) = ab + ac' },
      { name: 'Difference of squares', m: 'a² - b² = (a + b)(a - b)' },
      { name: 'Exponent rules', m: 'aᵐ · aⁿ = aᵐ⁺ⁿ,   (aᵐ)ⁿ = aᵐⁿ', keywords: 'powers' },
      { name: 'Quadratic formula', m: 'x = {-b ± √{b^2 - 4ac}/2a}', keywords: 'roots quadratics' },
      { name: 'Discriminant', m: 'D = b^2 - 4ac', note: 'Positive: two real roots. Zero: one. Negative: none.', keywords: 'roots quadratics' },
      { name: 'Vertex of a parabola', m: 'x = -{b/2a}' },
      { name: 'Perfect square', m: 'a^2 + 2ab + b^2 = (a + b)^2', keywords: 'factoring trinomial' },
      { name: 'AC method', m: 'pq = ac,   p + q = b', note: 'Split bx into px + qx, then group.', keywords: 'factoring trinomial' },
    ],
  },
  {
    id: 'stats',
    name: 'Statistics',
    items: [
      { name: 'Mean', m: 'mean = {"sum of the values"/"how many there are"}', keywords: 'average' },
      { name: 'Median', m: '"the middle value, once sorted"', note: 'With an even count, average the two middle values.' },
      { name: 'Mode', m: '"the value that shows up most"', note: 'There can be more than one, or none.' },
      { name: 'Range', m: 'range = max - min', keywords: 'spread' },
    ],
  },
  {
    id: 'sequences',
    name: 'Sequences',
    items: [
      { name: 'Arithmetic term', m: 'a_n = a_1 + (n - 1)d', keywords: 'common difference' },
      { name: 'Arithmetic sum', m: 'S_n = {n(a_1 + a_n)/2}', keywords: 'series' },
      { name: 'Geometric term', m: 'a_n = a_1 · r^{n-1}', keywords: 'common ratio' },
      { name: 'Geometric sum', m: 'S_n = {a_1(1 - r^n)/1 - r}', keywords: 'series' },
      { name: 'Infinite geometric sum', m: 'S = {a_1/1 - r}', note: 'Only when |r| < 1.', keywords: 'series converge' },
    ],
  },
  {
    id: 'geometry',
    name: 'Geometry',
    items: [
      { name: 'Pythagorean theorem', m: 'a^2 + b^2 = c^2', keywords: 'right triangle hypotenuse' },
      { name: 'Rectangle', m: 'A = lw,   P = 2l + 2w', keywords: 'area perimeter' },
      { name: 'Parallelogram', m: 'A = bh', keywords: 'area' },
      { name: 'Circle', m: 'A = πr^2,   C = 2πr', keywords: 'area circumference' },
      { name: 'Triangle area', m: 'A = {1/2}bh' },
      { name: 'Trapezoid area', m: 'A = {1/2}(b_1 + b_2)h' },
      { name: 'SOH CAH TOA', m: 'sin θ = {opp/hyp},  cos θ = {adj/hyp},  tan θ = {opp/adj}', keywords: 'trig trigonometry' },
    ],
  },
];

export function ReferenceTool({ winId }: { winId: string }) {
  const [data, update] = useWindowData<{ topic: string; q: string }>(winId);
  const q = (data.q ?? '').trim().toLowerCase();
  const topic = data.topic ?? 'lines';

  const shown = useMemo(() => {
    if (q) {
      return TOPICS.flatMap((t) => t.items.filter((f) => `${f.name} ${f.note ?? ''} ${f.keywords ?? ''} ${t.name}`.toLowerCase().includes(q)));
    }
    return TOPICS.find((t) => t.id === topic)?.items ?? [];
  }, [q, topic]);

  return (
    <div className="ref">
      <label className="inv-search ref-search">
        <Search size={15} aria-hidden="true" />
        <span className="sr-only">Search formulas</span>
        <input type="search" value={data.q ?? ''} onChange={(e) => update({ q: e.target.value })} placeholder="Search formulas" />
      </label>
      {!q && (
        <div className="inv-chips" role="group" aria-label="Topics">
          {TOPICS.map((t) => (
            <button key={t.id} type="button" className="chip" aria-pressed={topic === t.id} onClick={() => update({ topic: t.id })}>
              {t.name}
            </button>
          ))}
        </div>
      )}
      <dl className="ref-list">
        {shown.map((f) => (
          <div key={f.name} className="ref-item">
            <dt>{f.name}</dt>
            <dd>
              <MathView m={f.m} size="lg" />
              {f.note && <p className="muted small">{f.note}</p>}
            </dd>
          </div>
        ))}
        {shown.length === 0 && <p className="muted">No formula by that name. Perhaps you invented a new one.</p>}
      </dl>
    </div>
  );
}
