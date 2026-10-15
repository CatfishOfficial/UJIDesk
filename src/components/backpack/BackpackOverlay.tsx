import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { useWorkspace } from '../../state/store';
import { useUI, type BagView } from '../../state/ui';
import { PixelIcon, type PixelIconName } from '../ui/pixel-icons/PixelIcon';
import { RecognitionDialog } from '../tools/problem/RecognitionDialog';
import { detectProblem } from '../../math/detect';
import { BUTTON, DEFAULT_POS, buttonXY } from './geometry';
import type { EdgePosition } from '../../state/types';
import { ArcadeView, CatalogView, HomeView, SettingsView, StickersView, StuffView } from './views';
import { DesksView } from './DesksView';

/** Opens toward the middle of the screen from wherever the button sits. */
function panelStyle(pos: EdgePosition, panelH: number, uiScale: number): CSSProperties {
  const vw = window.innerWidth / uiScale;
  const vh = window.innerHeight / uiScale;
  const { x, y } = buttonXY(pos, vw, vh);
  const gap = 10;
  const s: CSSProperties = {};
  const leftHalf = x + BUTTON / 2 < vw / 2;
  const topHalf = y + BUTTON / 2 < vh / 2;
  if (pos.edge === 'left' || pos.edge === 'right') {
    if (pos.edge === 'left') s.left = x + BUTTON + gap;
    else s.right = vw - x + gap;
    const h = Math.min(panelH || 480, vh - 24);
    s.top = Math.min(Math.max(12, y + BUTTON / 2 - h / 2), vh - h - 12);
    s.maxHeight = vh - 24;
  } else {
    if (pos.edge === 'bottom') {
      s.bottom = vh - y + gap;
      s.maxHeight = y - gap - 12;
    } else {
      s.top = y + BUTTON + gap;
      s.maxHeight = vh - (s.top as number) - 12;
    }
    if (leftHalf) s.left = Math.max(12, x);
    else s.right = Math.max(12, vw - x - BUTTON);
  }
  s.transformOrigin = `${leftHalf ? 'left' : 'right'} ${topHalf ? 'top' : 'bottom'}`;
  return s;
}

/** The bag's top bar. Views switch in place; activities open their own windows. */
const BAR: { id: BagView | 'challenge' | 'trip'; icon: PixelIconName; label: string }[] = [
  { id: 'home', icon: 'backpack', label: 'Backpack' },
  { id: 'catalog', icon: 'mathTools', label: 'Math tools (Ctrl+K)' },
  { id: 'desks', icon: 'desks', label: 'Desks' },
  { id: 'challenge', icon: 'challenge', label: 'Challenge practice' },
  { id: 'trip', icon: 'boat', label: 'Trip on da Ship' },
  { id: 'arcade', icon: 'arcade', label: 'Arcade' },
  { id: 'stuff', icon: 'myStuff', label: 'My stuff' },
  { id: 'settings', icon: 'settings', label: 'Settings' },
];

/**
 * The backpack is the whole menu: an inventory that pops out of its button.
 * Closing it never touches what's on the board.
 */
export function BackpackOverlay({ compact }: { compact: boolean }) {
  const open = useUI((s) => s.backpackOpen);
  const view = useUI((s) => s.backpackView);
  const setBackpack = useUI((s) => s.setBackpack);
  const setDrawMode = useUI((s) => s.setDrawMode);
  const openWindow = useWorkspace((s) => s.openWindow);
  const nudge = useWorkspace((s) => s.nudge);
  const setNudge = useWorkspace((s) => s.setNudge);
  const tokens = useWorkspace((s) => s.progress.tokens);
  const pos = useWorkspace((s) => s.settings.backpackPos) ?? DEFAULT_POS;
  // Subscribed (not just read via currentScale()) so the panel re-renders at its
  // new position/size the moment the Display size slider moves.
  const uiScale = useWorkspace((s) => s.settings.uiScale) ?? 1;
  const [importing, setImporting] = useState(false);
  const [nudged, setNudged] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelH, setPanelH] = useState(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [, bumpViewport] = useState(0);

  useLayoutEffect(() => {
    const h = panelRef.current?.offsetHeight ?? 0;
    if (h && Math.abs(h - panelH) > 1) setPanelH(h);
  });

  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement;
      // Opening the bag answers the "what next?" dot; remember it for the greeting.
      setNudged(nudge);
      if (nudge) setNudge(false);
    } else {
      setImporting(false);
      if (returnFocus.current?.isConnected && panelRef.current?.contains(document.activeElement)) returnFocus.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const on = () => bumpViewport((n) => n + 1);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (panelRef.current?.contains(t) || t.closest('.bp-button')) return;
      setBackpack(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open, setBackpack]);

  if (!open) return null;

  const pick = (id: (typeof BAR)[number]['id']) => {
    if (id === 'challenge') {
      openWindow('challenge');
      setBackpack(false);
    } else if (id === 'trip') {
      openWindow('tripOnDaShip');
      setBackpack(false);
    } else setBackpack(true, id);
  };

  return (
    <div className={`backpack ${compact ? 'is-sheet' : ''}`} id="backpack">
      <div
        ref={panelRef}
        className="backpack-panel"
        style={compact ? undefined : panelStyle(pos, panelH, uiScale)}
        role="dialog"
        aria-label="Backpack"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !importing) setBackpack(false);
        }}
      >
        <header className="bag-bar">
          <nav className="bag-tabs" aria-label="Backpack sections">
            {BAR.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`bag-tab ${view === b.id || (b.id === 'home' && view === 'stickers') ? 'is-active' : ''}`}
                onClick={() => pick(b.id)}
                title={b.label}
                aria-label={b.label}
                aria-current={view === b.id ? 'page' : undefined}
              >
                <PixelIcon name={b.icon} size={32} />
              </button>
            ))}
          </nav>
          <div className="bag-bar-end">
            <button type="button" className="bag-tab" onClick={() => setDrawMode(true)} title="Draw on the whiteboard" aria-label="Draw on the whiteboard">
              <PixelIcon name="pen" size={32} />
            </button>
            <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={() => setBackpack(false)} aria-label="Close backpack">
              <X size={15} />
            </button>
          </div>
        </header>
        <div className="bag-tokens" title="Tokens: earned in Challenge practice, spent on tickets for da Ship">
          <PixelIcon name="token" size={16} /> {tokens}
        </div>

        <div className="backpack-scroll">
          {view === 'home' && <HomeView compact={compact} nudged={nudged} onImport={() => setImporting(true)} />}
          {view === 'catalog' && <CatalogView />}
          {view === 'desks' && <DesksView />}
          {view === 'arcade' && <ArcadeView />}
          {view === 'stuff' && <StuffView />}
          {view === 'settings' && <SettingsView />}
          {view === 'stickers' && <StickersView compact={compact} />}
        </div>

        {importing && (
          <RecognitionDialog
            kind="any"
            onClose={() => setImporting(false)}
            onUse={(text) => {
              const d = detectProblem(text);
              setImporting(false);
              // Unclear input goes to the equation tool, whose error explains what to fix.
              openWindow(d?.type ?? 'standardToSlope', { data: { inputs: d?.inputs ?? { eq: text }, autoSolve: true } });
              setBackpack(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
