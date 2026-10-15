import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A small right-click menu, rendered at the pointer (clamped on screen).
 * Arrow keys move between items, Escape or an outside click closes it.
 */
export function ContextMenu({ x, y, label, onClose, children }: { x: number; y: number; label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Keep the whole menu on screen: measured before it paints, and again
  // whenever its size or the window changes. Layout sizes ignore the
  // opening animation's scale, so the measurement is the real one.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const m = 8;
      const nx = x + w > window.innerWidth - m ? Math.max(m, window.innerWidth - w - m) : Math.max(m, x);
      // Not enough room below: open upwards from the pointer if that fits better.
      let ny = y;
      if (y + h > window.innerHeight - m) ny = y - h >= m ? y - h : window.innerHeight - h - m;
      setPos({ x: nx, y: Math.max(m, ny) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [x, y]);

  useLayoutEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="ctx-menu"
      role="menu"
      aria-label={label}
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      // React events bubble through portals; keep the menu's gestures and keys
      // from reaching the object it belongs to (which would drag or move it).
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? [])];
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function MenuItem({
  children,
  onSelect,
  checked,
  disabled,
  icon,
  hint,
}: {
  children: ReactNode;
  onSelect?: () => void;
  checked?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <button
      type="button"
      className={`ctx-item ${checked ? 'is-checked' : ''}`}
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      onClick={() => !disabled && onSelect?.()}
    >
      <span className="ctx-icon">{icon}</span>
      <span className="ctx-label">{children}</span>
      {hint && <span className="ctx-hint">{hint}</span>}
    </button>
  );
}

/** A row of small chip buttons inside a menu, for compact choices. */
export function MenuChips({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="ctx-chips" role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function MenuChip({
  children,
  onSelect,
  checked,
  icon,
  title,
  kind = 'menuitem',
}: {
  children?: ReactNode;
  onSelect: () => void;
  checked?: boolean;
  icon?: ReactNode;
  title?: string;
  kind?: 'menuitem' | 'menuitemradio' | 'menuitemcheckbox';
}) {
  return (
    <button
      type="button"
      className={`ctx-chip ${checked ? 'is-checked' : ''} ${children ? '' : 'is-icon'}`}
      role={kind}
      aria-checked={kind === 'menuitem' ? undefined : !!checked}
      aria-label={children ? undefined : title}
      title={title}
      tabIndex={-1}
      onClick={onSelect}
    >
      {icon}
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="ctx-section">{children}</div>;
}

export function MenuSeparator() {
  return <div className="ctx-sep" role="separator" />;
}
