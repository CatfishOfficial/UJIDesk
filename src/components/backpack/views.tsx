import { useMemo } from 'react';
import { ChevronRight, Clock, LayoutGrid, Undo2 } from 'lucide-react';
import { SOLVER_TYPES, useWorkspace, usePracticeLock } from '../../state/store';
import { useUI } from '../../state/ui';
import { MATH_CATALOG, BACKPACK_ITEMS, type BackpackItem } from '../../data/catalog';
import { STICKERS } from '../../data/stickers';
import { FISH, FishSprite } from '../../data/fish';
import { DECOR } from '../../data/decor';
import { ARCADE } from '../../data/arcade';
import { TOOLS } from '../../data/tools';
import { RARITY } from '../../game/ship';
import { InventoryGrid, type InventoryItem } from '../ui/InventoryGrid';
import { AccountSection } from '../account/AccountSection';
import { ArmedButton } from '../ui/ArmedButton';
import { ModeSwitch } from '../ModeSwitch';
import { PixelIcon } from '../ui/pixel-icons/PixelIcon';
import { TOOL_ICONS } from '../ui/icons';
import { HandUnderline } from '../ui/HandDrawn';
import { Pixel } from '../../data/pixel';
import { windowLabel } from '../windows/windowLabel';
import { QuickProblem } from './QuickProblem';
import { DEFAULT_ARRANGE, type ArrangeSettings } from '../../state/snap';
import { localPoint, windowAt } from '../StickerLayer';

const PROBLEM_TYPES = new Set<string>([...SOLVER_TYPES, 'challenge']);
const pausedDuringPractice = (id: string) => (SOLVER_TYPES as string[]).includes(id);

/* ── Home: the bag itself ───────────────────────── */

export function HomeView({ compact, nudged, onImport }: { compact: boolean; nudged: boolean; onImport: () => void }) {
  const windows = useWorkspace((s) => s.windows);
  const recent = useWorkspace((s) => s.recent);
  const closed = useWorkspace((s) => s.recentlyClosed);
  const openWindow = useWorkspace((s) => s.openWindow);
  const restore = useWorkspace((s) => s.restore);
  const reopenClosed = useWorkspace((s) => s.reopenClosed);
  const focusedId = useUI((s) => s.focusedId);
  const setBackpack = useUI((s) => s.setBackpack);
  const setDrawMode = useUI((s) => s.setDrawMode);

  const practicing = usePracticeLock();
  const all = Object.values(windows).sort((a, b) => b.z - a.z);
  const problemOpen = practicing || all.some((w) => PROBLEM_TYPES.has(w.type) && !w.minimized);
  const toast = useUI((s) => s.toast);
  const items: InventoryItem[] = practicing ? BACKPACK_ITEMS.map((i) => (pausedDuringPractice(i.id) ? { ...i, status: 'locked', badge: 'Paused', tip: 'Paused while a practice set is going' } : i)) : BACKPACK_ITEMS;
  const desk = compact ? all : all.filter((w) => w.minimized);
  const last = recent[0];

  const activate = (item: BackpackItem, at?: { x: number; y: number }) => {
    if (practicing && pausedDuringPractice(item.id)) return toast('Solvers are paused while a practice set is going.');
    const a = item.action;
    if (a.kind === 'open') {
      // Place helpers beside the window you're working in, so nothing gets covered.
      const near = !at && focusedId && a.type !== 'sticky' ? focusedId : undefined;
      openWindow(a.type, { at, near, data: a.data });
      setBackpack(false);
    } else if (a.kind === 'draw') setDrawMode(true);
    else setBackpack(true, 'stickers');
  };

  const resume = () => {
    if (!last) return;
    const w = windows[last.windowId];
    if (w) restore(w.id);
    else if (closed.some((c) => c.id === last.windowId)) reopenClosed(last.windowId);
    else openWindow(last.type, { data: { inputs: last.input, solved: last.input } });
    setBackpack(false);
  };

  return (
    <>
      {!problemOpen && (
        <h2 className="bag-hello">
          {nudged ? (
            <>
              nice work. <span className="bag-hello-mark">what next?<HandUnderline tone="green" width={92} /></span>
            </>
          ) : (
            <>
              let's get <span className="bag-hello-mark">started.<HandUnderline tone="accent" width={70} /></span>
            </>
          )}
        </h2>
      )}
      {/* Always here: type a problem from anywhere. Paused (but visible) during practice. */}
      <QuickProblem onImport={onImport} paused={practicing} />
      {!problemOpen && last && (
        <button type="button" className="bag-resume" onClick={resume}>
          {(() => {
            const I = TOOL_ICONS[last.type];
            return <I size={16} />;
          })()}
          <span className="bag-resume-text">
            <span className="muted small">Pick up where you left off</span>
            <span className="bag-resume-label">{last.label}</span>
          </span>
          <ChevronRight size={15} />
        </button>
      )}
      <div className="backpack-mode">
        <span className="backpack-mode-label">Help style</span>
        <ModeSwitch />
      </div>
      {(desk.length > 0 || closed.length > 0) && (
        <div className="bp-desk">
          <div className="inv-group-name">{compact ? 'Open windows' : 'On your desk'}</div>
          <div className="bp-desk-list">
            {desk.map((w) => {
              const I = TOOL_ICONS[w.type];
              return (
                <button
                  key={w.id}
                  type="button"
                  className="tray-chip"
                  onClick={() => {
                    restore(w.id);
                    setBackpack(false);
                  }}
                  title={`Bring back ${TOOLS[w.type].title}`}
                >
                  <I size={16} />
                  <span>{windowLabel(w)}</span>
                </button>
              );
            })}
            {closed.slice(0, 3).map((w) => {
              const I = TOOL_ICONS[w.type];
              return (
                <button
                  key={w.id}
                  type="button"
                  className="tray-chip is-closed"
                  onClick={() => {
                    reopenClosed(w.id);
                    setBackpack(false);
                  }}
                  title="Reopen with its contents"
                >
                  <I size={16} />
                  <span>{windowLabel(w)}</span>
                  <Undo2 size={12} />
                </button>
              );
            })}
          </div>
        </div>
      )}
      <InventoryGrid
        items={items}
        variant="slots"
        sections
        label="Tools in your backpack"
        onActivate={(i) => activate(i as BackpackItem)}
        onDrop={compact ? undefined : (i, at) => activate(i as BackpackItem, at)}
      />
      <p className="backpack-foot">
        {compact ? 'Tap to place.' : 'Click to place, or drag onto the board.'} Taking things out never empties the bag.
        {!compact && ' Drag the backpack itself to move it.'}
      </p>
    </>
  );
}

/* ── Math tools catalog ─────────────────────────── */

export function CatalogView() {
  const practicing = usePracticeLock();
  const openWindow = useWorkspace((s) => s.openWindow);
  const focusedId = useUI((s) => s.focusedId);
  const setBackpack = useUI((s) => s.setBackpack);
  const toast = useUI((s) => s.toast);
  return (
    <div className="bag-view">
      <h3 className="bag-h3">Math tools</h3>
      <InventoryGrid
        items={practicing ? MATH_CATALOG.map((c) => (pausedDuringPractice(c.id) ? { ...c, status: 'locked', badge: 'Paused' } : c)) : MATH_CATALOG}
        variant="cards"
        search
        chips
        autoFocus
        searchPlaceholder="Search tools and topics"
        label="Math tool catalog"
        onActivate={(item) => {
          const c = MATH_CATALOG.find((x) => x.id === item.id)!;
          if (!c.opens) return toast(`${c.name} is planned. It isn't built yet.`);
          if (practicing && pausedDuringPractice(c.id)) return toast('Solvers are paused while a practice set is going.');
          openWindow(c.opens, { near: focusedId ?? undefined, data: c.data });
          setBackpack(false);
        }}
      />
    </div>
  );
}

/* ── Arcade ─────────────────────────────────────── */

export function ArcadeView() {
  const openWindow = useWorkspace((s) => s.openWindow);
  const setBackpack = useUI((s) => s.setBackpack);
  return (
    <div className="bag-view">
      <h3 className="bag-h3">Arcade</h3>
      <p className="muted small">Small and optional. The math never depends on any of this.</p>
      <ul className="arcade-list">
        {ARCADE.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              className={`arcade-card ${a.ready ? 'is-ready' : ''}`}
              disabled={!a.ready}
              onClick={() => {
                openWindow('tripOnDaShip');
                setBackpack(false);
              }}
            >
              <span className="arcade-art" aria-hidden="true">
                {a.art}
              </span>
              <span>
                <span className="arcade-name">
                  {a.name} {!a.ready && <span className="tag">Coming later</span>}
                </span>
                <span className="arcade-desc">{a.desc}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── My stuff ───────────────────────────────────── */

export function StuffView() {
  const progress = useWorkspace((s) => s.progress);
  const openWindow = useWorkspace((s) => s.openWindow);
  const setBackpack = useUI((s) => s.setBackpack);
  const stickerItems: InventoryItem[] = STICKERS.filter((s) => s.earn).map((s) => {
    const has = progress.stickersEarned.includes(s.kind);
    return {
      id: s.kind,
      name: has || s.subject ? s.name : '???',
      description: has ? s.description : s.earn,
      icon: <span className={has ? '' : 'sticker-locked'}>{s.render(32)}</span>,
      status: has ? 'ready' : 'locked',
    };
  });
  const caught = FISH.filter((f) => progress.fishOwned.includes(f.id)).length;
  return (
    <div className="bag-view">
      <h3 className="bag-h3">My stuff</h3>
      <div className="stuff-stats">
        <div>
          <span className="stuff-num">
            <PixelIcon name="token" size={16} /> {progress.tokens}
          </span>
          <span className="muted small">tokens</span>
        </div>
        <div>
          <span className="stuff-num">
            <PixelIcon name="ticket" size={16} /> {progress.tickets.day + progress.tickets.night}
          </span>
          <span className="muted small">tickets</span>
        </div>
        <div>
          <span className="stuff-num">{progress.solved}</span>
          <span className="muted small">practice solved</span>
        </div>
      </div>
      <p className="muted small">Tokens come from Challenge practice and buy tickets for da Ship. They're pretend and stay in this browser. Never anything real.</p>

      <div className="inv-group-name">
        Fish caught · {caught} of {FISH.length}
      </div>
      <div className="stuff-fish">
        {FISH.map((f) => {
          const has = progress.fishOwned.includes(f.id);
          return (
            <span key={f.id} className="stuff-fish-item" title={has ? `${f.name} · ${RARITY[f.rarity].label} · caught ${progress.catches[f.id] ?? 0}×` : `Not caught yet · ${f.time} · ${RARITY[f.rarity].label}`}>
              <FishSprite fish={f} scale={2} silhouette={!has} />
              <span className="stuff-fish-dot" style={{ background: RARITY[f.rarity].color }} />
            </span>
          );
        })}
      </div>
      <div className="bag-row">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            openWindow('tripOnDaShip');
            setBackpack(false);
          }}
        >
          <PixelIcon name="boat" size={16} /> Go to the ticket shop
        </button>
        {progress.fishOwned.length > 0 && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              openWindow('fishbowl');
              setBackpack(false);
            }}
          >
            <PixelIcon name="fishbowl" size={16} /> Fishbowl
          </button>
        )}
      </div>

      <div className="inv-group-name">Bowl decor</div>
      <div className="stuff-decor">
        {DECOR.map((d) => {
          const has = progress.decorOwned.includes(d.id);
          return (
            <span key={d.id} className={`stuff-decor-item ${has ? '' : 'sticker-locked'}`} title={has ? `${d.name}: ${d.description}` : d.from === 'fish' ? 'Unlocked by a particular fish' : `A ${d.rarity} find on da Ship`}>
              <Pixel rows={d.rows} palette={d.palette} size={d.rows[0].length * 3} />
            </span>
          );
        })}
      </div>

      <div className="inv-group-name">Earned stickers</div>
      <InventoryGrid items={stickerItems} variant="slots" label="Earned stickers" onActivate={(i) => i.status === 'ready' && setBackpack(true, 'stickers')} />
    </div>
  );
}

/* ── Settings ───────────────────────────────────── */

export function SettingsView() {
  const settings = useWorkspace((s) => s.settings);
  const setSettings = useWorkspace((s) => s.setSettings);
  const reset = useWorkspace((s) => s.reset);
  const addTokens = useWorkspace((s) => s.addTokens);
  const toast = useUI((s) => s.toast);

  return (
    <div className="bag-view">
      <h3 className="bag-h3">Settings</h3>
      <AccountSection />
      <div className="setting-row">
        <span>Appearance</span>
        <div className="seg" role="radiogroup" aria-label="Appearance">
          {(
            [
              ['light', 'Light', 'sun'],
              ['dark', 'Dark', 'moon'],
              ['dynamic', 'Dynamic', 'clock'],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={(settings.theme ?? 'light') === id}
              aria-pressed={(settings.theme ?? 'light') === id}
              onClick={() => setSettings({ theme: id })}
              title={id === 'dynamic' ? 'Light by day, dark from 7pm to 6am' : undefined}
            >
              {icon === 'clock' ? <Clock size={13} /> : <PixelIcon name={icon} size={16} />} {label}
            </button>
          ))}
        </div>
      </div>
      {settings.theme === 'dynamic' && <p className="muted small">Light by day, dark from 7pm to 6am, on your own clock.</p>}
      <label className="setting">
        <input type="checkbox" checked={settings.grid} onChange={(e) => setSettings({ grid: e.target.checked })} />
        <span>Dot grid on the whiteboard</span>
      </label>
      <label className="setting">
        <input type="checkbox" checked={settings.motion === 'reduced'} onChange={(e) => setSettings({ motion: e.target.checked ? 'reduced' : 'system' })} />
        <span>Reduce motion (also follows your system setting)</span>
      </label>
      <label className="setting">
        <input type="checkbox" checked={settings.tips !== false} onChange={(e) => setSettings({ tips: e.target.checked })} />
        <span>Show a tip when UJI opens</span>
      </label>

      <div className="inv-group-name">Accessibility</div>
      <TextSizePresets />
      <p className="muted small">Windows and menus resize to match, so nothing ends up clipped.</p>

      <div className="inv-group-name">Workspace</div>
      <WindowArrangement />

      <div className="inv-group-name">Clear &amp; reset</div>
      <p className="muted small">Each of these asks twice. Nothing else gets touched.</p>
      <div className="reset-list">
        <ArmedButton label="Clear whiteboard drawing" onConfirm={() => (reset('drawing'), toast('Drawing cleared.'))} />
        <ArmedButton label="Peel off all stickers" onConfirm={() => (reset('stickers'), toast('Stickers removed.'))} />
        <ArmedButton label="Close every window" onConfirm={() => (reset('windows'), toast('Desk cleared.'))} />
        <ArmedButton label="Reset tokens and collection" onConfirm={() => (reset('progress'), toast('Progress reset.'))} />
        <ArmedButton label="Reset everything" danger onConfirm={() => (reset('everything'), toast('Fresh start.'))} />
      </div>

      {import.meta.env.DEV && (
        <>
          <div className="inv-group-name">Developer</div>
          <button type="button" className="btn btn-sm" onClick={() => (addTokens(100), toast('+100 tokens (dev only).'))}>
            <PixelIcon name="token" size={16} /> Give 100 tokens
          </button>
        </>
      )}

      <div className="inv-group-name">About this prototype</div>
      <ul className="about-list small">
        <li>Everything is saved in this browser. Signing in also keeps it in your account, for any device.</li>
        <li>Photos are read by an AI reader that only transcribes; you check what it read before anything is solved.</li>
        <li>Most fish are placeholders; the real roster is coming.</li>
      </ul>
    </div>
  );
}

/* ── Sticker sheet ──────────────────────────────── */

export function StickersView({ compact }: { compact: boolean }) {
  const earned = useWorkspace((s) => s.progress.stickersEarned);
  const placeSticker = useWorkspace((s) => s.placeSticker);
  const setBackpack = useUI((s) => s.setBackpack);
  const items: InventoryItem[] = useMemo(
    () =>
      STICKERS.map((s) => {
        const locked = !!s.earn && !earned.includes(s.kind);
        return {
          id: s.kind,
          category: s.subject ? 'Subjects' : s.earn ? 'Earned' : 'Sticker sheet',
          name: locked && !s.subject ? '???' : s.name,
          description: locked ? s.earn : s.description,
          tip: locked ? `Earn it: ${s.earn}` : s.description,
          icon: <span className={locked ? 'sticker-locked' : ''}>{s.render(44)}</span>,
          status: locked ? 'locked' : 'ready',
          badge: !locked && s.earn ? 'Earned' : undefined,
        };
      }),
    [earned],
  );
  return (
    <div className="bag-view">
      <h3 className="bag-h3">Stickers</h3>
      <p className="backpack-sub">Stick one anywhere, or drop it on a window to stick it there. Drag to move; select it to turn or resize it.</p>
      <InventoryGrid
        items={items}
        variant="slots"
        sections
        label="Sticker sheet"
        autoFocus
        onActivate={(i) => {
          if (i.status === 'locked') return;
          placeSticker(i.id);
          setBackpack(false);
        }}
        onDrop={
          compact
            ? undefined
            : (i, at) => {
                if (i.status === 'locked') return;
                // Dropped onto a window or item: it sticks there.
                const win = windowAt(at.x, at.y);
                placeSticker(i.id, at, win?.dataset.windowId ? { winId: win.dataset.windowId, local: localPoint(win, at.x, at.y) } : undefined);
                setBackpack(false);
              }
        }
      />
    </div>
  );
}

/**
 * Settings → Accessibility → Text size. Presets for the overall UI scale
 * (settings.uiScale), so text, windows, and everything in them grow together — a window sized for Normal text can't end up clipping Giant
 * text, since the window grows by exactly the same factor.
 */
const TEXT_SIZE_PRESETS = [
  { id: 'normal', label: 'Normal', scale: 1 },
  { id: 'big', label: 'Big', scale: 1.25 },
  { id: 'giant', label: 'Giant', scale: 1.5 },
] as const;

function TextSizePresets() {
  const scale = useWorkspace((s) => s.settings.uiScale) ?? 1;
  const setSettings = useWorkspace((s) => s.setSettings);
  const active = TEXT_SIZE_PRESETS.find((p) => Math.abs(p.scale - scale) < 0.02)?.id;
  return (
    <div className="setting-row">
      <span>Text size</span>
      <div className="seg" role="radiogroup" aria-label="Text size">
        {TEXT_SIZE_PRESETS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={active === p.id} aria-pressed={active === p.id} onClick={() => setSettings({ uiScale: p.scale })}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Settings → Workspace → Window arrangement. Everything here is off until switched on. */
function WindowArrangement() {
  const arrange = useWorkspace((s) => s.settings.arrange ?? DEFAULT_ARRANGE);
  const setSettings = useWorkspace((s) => s.setSettings);
  const tidyUp = useWorkspace((s) => s.tidyUp);
  const setBackpack = useUI((s) => s.setBackpack);
  const set = (patch: Partial<ArrangeSettings>) => setSettings({ arrange: { ...arrange, ...patch } });
  return (
    <section className="arrange" aria-labelledby="arrange-title">
      <div className="arrange-title" id="arrange-title">
        Window arrangement
      </div>
      <label className="setting">
        <input type="checkbox" checked={arrange.grid} onChange={(e) => set({ grid: e.target.checked })} />
        <span>Snap to grid</span>
      </label>
      <div className={`setting-row arrange-sub ${arrange.grid ? '' : 'is-off'}`}>
        <span className="muted small">Grid size</span>
        <div className="seg" role="radiogroup" aria-label="Grid size">
          {([12, 24, 48] as const).map((g) => (
            <button key={g} type="button" role="radio" aria-checked={arrange.gridSize === g} aria-pressed={arrange.gridSize === g} disabled={!arrange.grid} onClick={() => set({ gridSize: g })}>
              {g}px
            </button>
          ))}
        </div>
      </div>
      <label className="setting">
        <input type="checkbox" checked={arrange.windows} onChange={(e) => set({ windows: e.target.checked })} />
        <span>Snap to other windows (lines up edges, keeps an even gap)</span>
      </label>
      <label className="setting">
        <input type="checkbox" checked={arrange.guides} onChange={(e) => set({ guides: e.target.checked })} />
        <span>Alignment guides while dragging</span>
      </label>
      <p className="muted small arrange-hint">Hold Alt while dragging to place a window freely. Right-click the whiteboard to tidy up.</p>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => {
          setBackpack(false);
          tidyUp();
        }}
      >
        <LayoutGrid size={13} /> Tidy up windows
      </button>
    </section>
  );
}
