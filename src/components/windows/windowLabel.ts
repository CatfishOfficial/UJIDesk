import type { Win } from '../../state/types';
import { TOOLS } from '../../data/tools';

/** Short label for tray chips and switchers, using content where helpful. */
export function windowLabel(w: Win): string {
  const d = w.data;
  if (w.type === 'sticky' && typeof d.text === 'string' && d.text.trim()) return truncate(d.text.trim().split('\n')[0], 18);
  if (w.type === 'timer' && typeof d.endAt === 'number') {
    const left = Math.max(0, Math.round((d.endAt - Date.now()) / 1000));
    return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  }
  if (w.type === 'standardToSlope') return 'Standard → y=mx+b';
  if (w.type === 'slopeFromPoints') return 'Slope from points';
  return TOOLS[w.type].title;
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
