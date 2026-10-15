import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../../state/store';
import { FISH, FISH_BY_ID, FishSprite, fishLayers } from '../../data/fish';
import { DECOR, DECOR_BY_ID, FOOD_BY_ID } from '../../data/decor';
import { useUI } from '../../state/ui';
import { pixelRects } from '../../data/pixel';
import { rng } from '../../math/challenge';
import { ContextMenu, MenuChip, MenuChips, MenuLabel, MenuSeparator } from '../ui/ContextMenu';
import { PixelIcon } from '../ui/pixel-icons/PixelIcon';
import { ItemMenuFooter } from '../../items/ItemMenu';

const W = 80;
const H = 60;

/** Every bowl color is a theme token, so the bowl has its own night skin. */
const BOWL_PALETTE = {
  o: 'var(--bowl-glass)',
  r: 'var(--bowl-rim)',
  a: 'var(--bowl-air)',
  s: 'var(--bowl-surface)',
  '1': 'var(--bowl-water-1)',
  '2': 'var(--bowl-water-2)',
  '3': 'var(--bowl-water-3)',
  h: 'var(--bowl-glint)',
  g: 'var(--bowl-gravel-1)',
  G: 'var(--bowl-gravel-2)',
  n: 'var(--bowl-gravel-3)',
  N: 'var(--bowl-gravel-4)',
  S: 'var(--bowl-shadow)',
};

/** Generates the bowl pixel by pixel: glass outline, air, banded water, gravel, glint, and a soft shadow. */
function buildBowl(): string[] {
  const cx = 40;
  const cy = 30;
  const rx = 37;
  const ry = 25.5;
  const inside = (x: number, y: number) => y >= 8 && y < H && x >= 0 && x < W && ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  const shadow = (x: number, y: number) => ((x + 0.5 - cx) / 26) ** 2 + ((y + 0.5 - 56.6) / 1.4) ** 2 <= 1;
  const r = rng(7);
  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) {
        row += shadow(x, y) ? 'S' : '.';
        continue;
      }
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (edge || y === 8) row += 'o';
      else if (y === 9) row += 'r';
      else if (y < 14) row += 'a';
      else if (y === 14) row += 's';
      else if (y >= 47 - ((x * 7) % 3 === 0 ? 1 : 0)) row += 'gGnN'[Math.floor(r() * 4)];
      else if (y < 26 || (y === 26 && (x + y) % 2 === 0)) row += '1';
      else if (y < 38 || (y === 38 && (x + y) % 2 === 0)) row += '2';
      else row += '3';
    }
    rows.push(row);
  }
  for (let y = 16; y < 34; y++) {
    const x0 = rows[y].search(/[^.S]/);
    if (x0 >= 0) rows[y] = rows[y].slice(0, x0 + 2) + 'h' + rows[y].slice(x0 + 3);
  }
  return rows;
}

const PLANT_A = ['..p...', '.pP...', '.pP...', '..pP..', '..pP..', '.pP...', '.pP...', '..pP..', '..pP..', '.pP..p', '.pP.pP', '..pPP.', '..pP..', '.pP...', '.pP...', '..pP..'];
const PLANT_B = PLANT_A.map((r, i) => (i < 8 ? '.' + r.slice(0, -1) : r));
const PLANT_PAL = { p: 'var(--bowl-plant-1)', P: 'var(--bowl-plant-2)' };

/**
 * A frameless fishbowl that sits on the desk. Right-click (or long-press, or
 * the menu key) opens the tank options. Idle motion stays inside the bowl
 * and stops for reduced motion; the fish never does anything on its own.
 */
export function FishbowlTool({ winId }: { winId: string }) {
  const owned = useWorkspace((s) => s.progress.fishOwned);
  const selected = useWorkspace((s) => s.progress.fishSelected);
  const decorOwned = useWorkspace((s) => s.progress.decorOwned);
  const decorShown = useWorkspace((s) => s.progress.decorShown);
  const foods = useWorkspace((s) => s.progress.foods);
  const toggleDecor = useWorkspace((s) => s.toggleDecor);
  const openWindow = useWorkspace((s) => s.openWindow);
  const setBackpack = useUI((s) => s.setBackpack);
  const selectFish = useWorkspace((s) => s.selectFish);
  const [beat, setBeat] = useState(0);
  const [food, setFood] = useState<{ at: number; color: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const press = useRef<{ t: number; x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // The bowl starts empty; fish arrive from da Ship.
  const fish = owned.includes(selected) ? FISH_BY_ID[selected] : owned.length ? FISH_BY_ID[owned[0]] : undefined;

  const bowl = useMemo(() => pixelRects(buildBowl(), BOWL_PALETTE, 0, 0, 'bowl'), []);
  const layers = useMemo(() => (fish ? fishLayers(fish) : null), [fish]);
  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!beat) return;
    const t = setTimeout(() => setBeat(0), 3200);
    return () => clearTimeout(t);
  }, [beat]);

  useEffect(() => {
    if (!food) return;
    const t = setTimeout(() => setFood(null), 3400);
    return () => clearTimeout(t);
  }, [food]);

  const openMenuAtCenter = () => {
    const r = rootRef.current?.getBoundingClientRect();
    if (r) setMenu({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  const sayHi = () => fish && setBeat(Date.now());
  const feed = (foodId: string) => {
    setFood({ at: Date.now(), color: FOOD_BY_ID[foodId]?.color ?? '#c98a5a' });
    if (fish) setTimeout(() => setBeat(Date.now()), 900);
  };
  const goFishing = () => {
    openWindow('tripOnDaShip');
    setBackpack(false);
  };

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.t);
    press.current = null;
  };

  return (
    <div
      ref={rootRef}
      className="bowl-object"
      tabIndex={0}
      aria-label={`${fish ? `${fish.name} in a fishbowl` : 'An empty fishbowl'}. Enter says hi; the menu key or Shift+F10 opens tank options; arrow keys move it.`}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      onKeyDown={(e) => {
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault();
          openMenuAtCenter();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          sayHi();
        }
      }}
      onPointerDown={(e) => {
        // Long-press opens the menu on touch screens.
        if (e.pointerType !== 'touch') return;
        const { clientX: x, clientY: y } = e;
        press.current = { x, y, t: window.setTimeout(() => setMenu({ x, y }), 550) };
      }}
      onPointerMove={(e) => {
        if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 6) cancelPress();
      }}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
    >
      <svg viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" className="pixel bowl-svg" aria-hidden="true">
        {bowl}
        <g className="plant-a">{pixelRects(PLANT_A, PLANT_PAL, 14, 31, 'pa')}</g>
        <g className="plant-b">{pixelRects(PLANT_B, PLANT_PAL, 14, 31, 'pb')}</g>
        <g className="plant-a">{pixelRects(PLANT_A.slice(6), PLANT_PAL, 63, 37, 'qa')}</g>
        <g className="plant-b">{pixelRects(PLANT_B.slice(6), PLANT_PAL, 63, 37, 'qb')}</g>
        {decorShown.map((id) => {
          const dd = DECOR_BY_ID[id];
          return dd ? <g key={id}>{pixelRects(dd.rows, dd.palette, dd.x, dd.y, id)}</g> : null;
        })}
        <rect className="bubble b1" x="56" y="40" width="1" height="1" fill="#fff" />
        <rect className="bubble b2" x="58" y="42" width="1" height="1" fill="#fff" />
        <rect className="bubble b3" x="24" y="43" width="1" height="1" fill="#fff" />
        {food && (
          <g className="food-flakes" key={food.at}>
            {[28, 34, 39, 45, 50].map((x, i) => (
              <rect key={x} x={x} y={11} width="1" height="1" fill={food.color} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </g>
        )}
        {layers && (
        <g className={`bowl-fish-path ${beat ? 'is-beat' : ''}`}>
          <g className="bowl-fish-flip">
            <g className="bowl-fish-hit" onClick={sayHi}>
              <rect width="20" height="15" fill="transparent" />
              <g>{layers.body}</g>
              <g className="fish-tail-a">{layers.tailA}</g>
              <g className="fish-tail-b">{layers.tailB}</g>
              <g className="fish-blink">{layers.blink}</g>
            </g>
          </g>
        </g>
        )}
      </svg>
      {beat > 0 && fish && (
        <p className="bowl-quip" role="status">
          {fish.quip}
        </p>
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} label="Fish tank options" onClose={closeMenu}>
          {fish ? (
            <div className="ctx-head">
              <FishSprite fish={fish} scale={2} />
              <div>
                <div className="ctx-head-name">{fish.name}</div>
                <div className="ctx-head-desc">{fish.description}</div>
              </div>
            </div>
          ) : (
            <div className="ctx-head">
              <div>
                <div className="ctx-head-name">An empty bowl</div>
                <div className="ctx-head-desc">Fish come from Trip on da Ship. Tickets cost tokens; tokens come from practice.</div>
              </div>
            </div>
          )}
          <MenuChips label="Things to do">
            {fish && <MenuChip onSelect={() => (sayHi(), closeMenu())}>Say hi</MenuChip>}
            {foods.map((f) => (
              <MenuChip key={f} onSelect={() => (feed(f), closeMenu())} title={`Feed ${FOOD_BY_ID[f]?.name.toLowerCase() ?? f}`}>
                Feed{foods.length > 1 ? ` ${(FOOD_BY_ID[f]?.name ?? f).replace(/^fish /i, '').toLowerCase()}` : ''}
              </MenuChip>
            ))}
            <MenuChip icon={<PixelIcon name="boat" size={16} />} onSelect={() => (goFishing(), closeMenu())} title="Go fishing on da Ship">
              Fishing
            </MenuChip>
          </MenuChips>
          {owned.length > 0 && (
            <>
              <MenuSeparator />
              <MenuLabel>
                Fish · {owned.length} of {FISH.length}
              </MenuLabel>
              <div className="ctx-fish-grid" role="group" aria-label="Choose a fish">
                {FISH.filter((f) => owned.includes(f.id)).map((f) => (
                  <MenuChip key={f.id} kind="menuitemradio" checked={f.id === fish?.id} title={f.name} icon={<FishSprite fish={f} scale={1} />} onSelect={() => (selectFish(f.id), closeMenu())} />
                ))}
              </div>
            </>
          )}
          {decorOwned.length > 0 && (
            <>
              <MenuLabel>Decor</MenuLabel>
              <MenuChips label="Decor">
                {DECOR.filter((dd) => decorOwned.includes(dd.id)).map((dd) => (
                  <MenuChip key={dd.id} kind="menuitemcheckbox" checked={decorShown.includes(dd.id)} onSelect={() => toggleDecor(dd.id)}>
                    {dd.name}
                  </MenuChip>
                ))}
              </MenuChips>
            </>
          )}
          <ItemMenuFooter winId={winId} onClose={closeMenu} putAwayLabel="Put bowl away" />
        </ContextMenu>
      )}
    </div>
  );
}
