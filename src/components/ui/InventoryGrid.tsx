import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { currentScale } from '../../state/scale';

/**
 * One inventory vocabulary for every collection in UJI: the backpack, the math
 * tool catalog, calculator models, stickers, and (later) collectibles.
 */
export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  icon: ReactNode;
  category?: string;
  status?: 'ready' | 'planned' | 'locked';
  /** Small label in the corner, e.g. "New", "×∞", "Later". */
  badge?: string;
  keywords?: string[];
  tip?: string;
}

interface Props {
  items: InventoryItem[];
  variant: 'slots' | 'cards';
  label: string;
  onActivate: (item: InventoryItem) => void;
  /** Enables drag-to-place; called with the drop point in viewport coordinates. */
  onDrop?: (item: InventoryItem, at: { x: number; y: number }) => void;
  search?: boolean;
  searchPlaceholder?: string;
  chips?: boolean;
  /** Group into labelled sections instead of filter chips. */
  sections?: boolean;
  selectedId?: string;
  autoFocus?: boolean;
  emptyText?: string;
}

export function InventoryGrid({
  items,
  variant,
  label,
  onActivate,
  onDrop,
  search,
  searchPlaceholder = 'Search',
  chips,
  sections,
  selectedId,
  autoFocus,
  emptyText = 'Nothing matches that. Yet.',
}: Props) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const el = search ? searchRef.current : listRef.current?.querySelector<HTMLElement>('[data-inv-item]');
    el?.focus({ preventScroll: true });
  }, [autoFocus, search]);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))] as string[], [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (cat && i.category !== cat) return false;
      if (!needle) return true;
      const hay = [i.name, i.description, i.category, ...(i.keywords ?? [])].join(' ').toLowerCase();
      return needle.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [items, q, cat]);

  const groups = useMemo(() => {
    if (!sections) return [{ name: '', items: filtered }];
    const order = categories;
    return order.map((c) => ({ name: c, items: filtered.filter((i) => i.category === c) })).filter((g) => g.items.length);
  }, [filtered, sections, categories]);

  /** Arrow keys move between items by on-screen position. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = dirs[e.key];
    if (!d) return;
    const current = document.activeElement as HTMLElement | null;
    if (!current?.dataset.invItem) return;
    const all = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-inv-item]') ?? [])];
    const a = current.getBoundingClientRect();
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of all) {
      if (el === current) continue;
      const b = el.getBoundingClientRect();
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const along = d[0] ? dx * d[0] : dy * d[1];
      if (along <= 4) continue;
      const across = d[0] ? Math.abs(dy) : Math.abs(dx);
      const score = along + across * 3;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) {
      e.preventDefault();
      best.focus();
    }
  };

  return (
    <div className={`inv inv-${variant}`}>
      {(search || (chips && categories.length > 1)) && (
        <div className="inv-tools">
          {search && (
            <label className="inv-search">
              <Search size={15} aria-hidden="true" />
              <span className="sr-only">{searchPlaceholder}</span>
              <input
                ref={searchRef}
                type="search"
                value={q}
                placeholder={searchPlaceholder}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filtered[0]) onActivate(filtered[0]);
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    listRef.current?.querySelector<HTMLElement>('[data-inv-item]')?.focus();
                  }
                }}
              />
            </label>
          )}
          {chips && categories.length > 1 && (
            <div className="inv-chips" role="group" aria-label="Filter by category">
              <button type="button" className="chip" aria-pressed={cat === null} onClick={() => setCat(null)}>
                All
              </button>
              {categories.map((c) => (
                <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(cat === c ? null : c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div ref={listRef} className="inv-list" role="group" aria-label={label} onKeyDown={onKeyDown}>
        {groups.map((g) => (
          <div key={g.name || 'all'} className="inv-group" role="presentation">
            {g.name && <div className="inv-group-name">{g.name}</div>}
            <div className="inv-items" role="presentation">
              {g.items.map((item) => (
                <InventorySlot key={item.id} item={item} variant={variant} selected={item.id === selectedId} onActivate={onActivate} onDrop={onDrop} />
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="inv-empty muted">{emptyText}</p>}
      </div>
    </div>
  );
}

function InventorySlot({
  item,
  variant,
  selected,
  onActivate,
  onDrop,
}: {
  item: InventoryItem;
  variant: 'slots' | 'cards';
  selected: boolean;
  onActivate: (item: InventoryItem) => void;
  onDrop?: (item: InventoryItem, at: { x: number; y: number }) => void;
}) {
  const drag = useRef<{ x: number; y: number; ghost: HTMLElement | null; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const status = item.status ?? 'ready';
  const canDrag = !!onDrop && status === 'ready';

  const onPointerDown = (e: RPointerEvent<HTMLButtonElement>) => {
    if (!canDrag || e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, ghost: null, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
    if (!d.moved) {
      d.moved = true;
      const ghost = document.createElement('div');
      ghost.className = 'inv-ghost';
      ghost.innerHTML = e.currentTarget.querySelector('.inv-icon')?.innerHTML ?? '';
      document.body.appendChild(ghost);
      d.ghost = ghost;
      document.body.classList.add('is-placing');
    }
    // The ghost renders through the page zoom, so its translate needs logical px to track the real cursor.
    if (d.ghost) {
      const scale = currentScale();
      d.ghost.style.transform = `translate(${(e.clientX - 22) / scale}px, ${(e.clientY - 22) / scale}px)`;
    }
  };
  const onPointerUp = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    d.ghost?.remove();
    document.body.classList.remove('is-placing');
    if (d.moved && onDrop) {
      suppressClick.current = true;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      // Only place when released over the board, not back inside the backpack.
      if (!target?.closest('.backpack-panel')) onDrop(item, { x: e.clientX, y: e.clientY });
    }
  };

  return (
    <button
      type="button"
      data-inv-item={item.id}
      className={`inv-item status-${status} ${selected ? 'is-selected' : ''}`}
      title={item.tip ?? item.description}
      aria-disabled={status === 'locked' || undefined}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onActivate(item);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current?.ghost?.remove();
        drag.current = null;
        document.body.classList.remove('is-placing');
      }}
    >
      <span className="inv-icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="inv-text">
        <span className="inv-name">{item.name}</span>
        {variant === 'cards' && item.description && <span className="inv-desc">{item.description}</span>}
      </span>
      {(item.badge || status !== 'ready') && (
        <span className={`inv-badge ${status !== 'ready' ? 'is-muted' : ''}`}>{item.badge ?? (status === 'planned' ? 'Later' : 'Locked')}</span>
      )}
    </button>
  );
}
