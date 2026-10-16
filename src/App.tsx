import { useEffect, useState } from 'react';
import { useWorkspace } from './state/store';
import { useUI } from './state/ui';
import { useApplyTheme } from './state/theme';
import { useApplyUIScale } from './state/uiScale';
import { WindowLayer } from './components/windows/WindowLayer';
import { BackpackButton } from './components/backpack/BackpackButton';
import { BackpackOverlay } from './components/backpack/BackpackOverlay';
import { Toasts } from './components/Toasts';
import { StickerLayer } from './components/StickerLayer';
import { InkLayer, DrawingSurface } from './components/drawing/DrawingLayer';
import { GuideLayer } from './components/windows/GuideLayer';
import { BoardMenu } from './components/BoardMenu';
import { AuthDialog } from './components/account/AuthDialog';
import { startAccount } from './state/account';
import { DEFAULT_ARRANGE } from './state/snap';
import type { CSSProperties } from 'react';

function useCompact() {
  const query = '(max-width: 720px), (max-height: 520px)';
  const [compact, setCompact] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setCompact(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
}

const isTyping = (el: Element | null) => !!el && (el.matches('input, textarea, select, [contenteditable="true"]') || !!el.closest('[contenteditable="true"]'));

export default function App() {
  const compact = useCompact();
  const grid = useWorkspace((s) => s.settings.grid);
  const motion = useWorkspace((s) => s.settings.motion);
  const drawMode = useUI((s) => s.drawMode);
  const arranging = useUI((s) => s.arranging);
  const arrange = useWorkspace((s) => s.settings.arrange ?? DEFAULT_ARRANGE);
  const [boardMenu, setBoardMenu] = useState<{ x: number; y: number } | null>(null);
  useApplyTheme();
  useApplyUIScale();

  // Very first visit: open the backpack once so the way in is obvious.
  // After that the board starts empty, with the backpack as the way in.
  useEffect(() => {
    const ws = useWorkspace.getState();
    if (!ws.seenWelcome) {
      useUI.getState().setBackpack(true, 'home');
      ws.setSeenWelcome();
    }
    ws.clampAll();
    startAccount();
  }, []);

  // Keep every window reachable when the screen size changes.
  useEffect(() => {
    let t = 0;
    const on = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => useWorkspace.getState().clampAll(), 120);
    };
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion = motion;
  }, [motion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const ui = useUI.getState();
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.setBackpack(true, 'catalog');
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        ui.setBackpack(!ui.backpackOpen);
      } else if (e.key === 'Escape') {
        if (ui.backpackOpen) ui.setBackpack(false);
        else if (ui.drawMode) ui.setDrawMode(false);
        else if (ui.selectedSticker && !isTyping(document.activeElement)) ui.selectSticker(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className={`workspace ${grid ? 'has-grid' : ''} ${arrange.grid ? 'snap-grid' : ''} ${drawMode ? 'is-drawing' : ''} ${compact ? 'is-compact' : ''} ${arranging ? 'is-arranging' : ''}`}
      style={{ '--snap': `${arrange.gridSize}px` } as CSSProperties}
    >
      {/* Everything below scales together via --ui-scale: a transform (GPU-composited,
          doesn't force layout) rather than `zoom` (a layout property — forces the
          whole page through layout/paint every frame, which read as "dead" transitions
          on a big screen with more pixels to redo that work for). ContextMenu's portal
          and InventoryGrid's drag ghost target this element by class so they scale too. */}
      <div className="stage">
        <h1 className="sr-only">UJI workspace</h1>
        <div
          className="board"
          onPointerDown={() => {
            useUI.getState().selectSticker(null);
            useUI.getState().setFocused(null);
          }}
          onContextMenu={(e) => {
            // Phones show one window at a time, so there's nothing to arrange there.
            if (compact) return;
            e.preventDefault();
            setBoardMenu({ x: e.clientX, y: e.clientY });
          }}
        />
        <InkLayer />
        <StickerLayer />
        <main className="desk" aria-label="Whiteboard">
          <WindowLayer compact={compact} />
          <GuideLayer />
        </main>
        {boardMenu && <BoardMenu x={boardMenu.x} y={boardMenu.y} onClose={() => setBoardMenu(null)} />}
        <DrawingSurface />
        <BackpackButton />
        <BackpackOverlay compact={compact} />
        <AuthDialog />
        <Toasts />
      </div>
    </div>
  );
}
