import { ExternalLink, FileText, LayoutGrid, PencilLine, PlayCircle } from 'lucide-react';
import type { KhanLink } from '../../../data/khan';

const ICON = { video: PlayCircle, article: FileText, practice: PencilLine, unit: LayoutGrid } as const;
const KIND = { video: 'Video', article: 'Article', practice: 'Practice', unit: 'Unit' } as const;

/** Links out to Khan Academy, opening in a new tab. */
export function KhanLinks({ links, title, compact }: { links: KhanLink[]; title: string; compact?: boolean }) {
  return (
    <div className={`khan ${compact ? 'is-compact' : ''}`}>
      <div className="lesson-label">{title}</div>
      <ul>
        {links.map((k) => {
          const I = ICON[k.kind];
          return (
            <li key={k.url}>
              <a href={k.url} target="_blank" rel="noopener noreferrer" title={`${KIND[k.kind]} on Khan Academy (opens a new tab)`}>
                <I size={14} aria-hidden="true" />
                <span className="khan-title">{k.title}</span>
                <span className="khan-kind">{KIND[k.kind]}</span>
                <ExternalLink size={12} aria-hidden="true" className="khan-out" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
