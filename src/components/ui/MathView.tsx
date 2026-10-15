import { Fragment, useMemo, type ReactNode } from 'react';
import { parseMarkup, toPlain, type MathNode } from '../../math/markup';

function renderNodes(nodes: MathNode[], keyPrefix = ''): ReactNode[] {
  return nodes.map((n, i) => {
    // Spaces next to operators are handled by operator padding; others are kept.
    if (n.k === 'text' && !n.s.trim() && (i === 0 || i === nodes.length - 1 || nodes[i - 1].k === 'op' || nodes[i + 1].k === 'op')) return null;
    const key = `${keyPrefix}${i}`;
    switch (n.k) {
      case 'var':
        return <i key={key} className="m-var">{n.s}</i>;
      case 'op':
        return <span key={key} className={n.s === '=' ? 'm-eq' : 'm-op'}>{n.s}</span>;
      case 'sub':
        return (
          <span key={key} className="m-subwrap">
            {renderNodes([n.base], `${key}b`)}
            <sub className="m-sub">{n.sub}</sub>
          </span>
        );
      case 'sup':
        return (
          <span key={key} className="m-supwrap">
            {renderNodes([n.base], `${key}b`)}
            <sup className="m-sup">{renderNodes(n.sup, `${key}s`)}</sup>
          </span>
        );
      case 'sqrt':
        return (
          <span key={key} className="m-sqrt">
            <span className="m-radical" aria-hidden="true">√</span>
            <span className="m-radicand">{renderNodes(n.inner, `${key}r`)}</span>
          </span>
        );
      case 'nuc':
        // Nuclide notation: mass number above, atomic number below, both left of the symbol.
        return (
          <span key={key} className="m-nuc">
            <span className="m-nuc-scripts">
              <span className="m-nuc-a">{n.a}</span>
              <span className="m-nuc-z">{n.z.replace('-', '−')}</span>
            </span>
            <span className="m-nuc-sym">{n.sym}</span>
          </span>
        );
      case 'frac':
        return (
          <span key={key} className="m-frac" role="presentation">
            <span className="m-num">{renderNodes(n.num, `${key}n`)}</span>
            <span className="m-den">{renderNodes(n.den, `${key}d`)}</span>
          </span>
        );
      default: {
        // Operators carry their own padding, so trim spaces that touch them.
        let t = n.s;
        if (nodes[i - 1]?.k === 'op') t = t.trimStart();
        if (nodes[i + 1]?.k === 'op') t = t.trimEnd();
        return (
          <span key={key} className="m-text">
            {t}
          </span>
        );
      }
    }
  });
}

/** Crisp math. Screen readers get the plain-text version. */
export function MathView({ m, className = '', size }: { m: string; className?: string; size?: 'sm' | 'lg' | 'xl' }) {
  const nodes = useMemo(() => parseMarkup(m), [m]);
  const plain = useMemo(() => toPlain(m).replace(/-/g, '−'), [m]);
  return (
    <span className={`math ${size ? `math-${size}` : ''} ${className}`} aria-label={plain} role="math">
      <span aria-hidden="true">{renderNodes(nodes)}</span>
    </span>
  );
}

/** Prose with inline $math$ and **bold**. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => text.split(/(\$[^$]+\$|\*\*[^*]+\*\*)/g).filter(Boolean), [text]);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.startsWith('$') ? (
          <MathView key={i} m={p.slice(1, -1)} className="math-inline" />
        ) : p.startsWith('**') ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </span>
  );
}
