import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useWindowData, useWorkspace } from '../state/store';
import { useUI } from '../state/ui';
import { FISH, FISH_BY_ID, FishSprite, type FishDef } from '../data/fish';
import { DECOR_BY_ID, FOOD_BY_ID } from '../data/decor';
import { Pixel } from '../data/pixel';
import { PixelIcon } from '../components/ui/pixel-icons/PixelIcon';
import { CASTS_PER_TRIP, RARITY, TICKET_PRICE, rollDecorDrop, rollFish, ticketPrice, timeOfDay, waitMs, type TimeOfDay } from './ship';
import { BOBBER_AT, Bobber, FLIGHT, FishingLine, ROD_TIPS, Rod, Scene, Ship, Splash, type RodPose } from './scenes';

interface Trip {
  time: TimeOfDay;
  castsLeft: number;
  caught: string[];
}

interface ShipData extends Record<string, unknown> {
  phase: 'shop' | 'trip' | 'log';
  trip?: Trip;
}

/** Re-renders every minute so day/night pricing follows the real clock. */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

const prefersReducedMotion = () =>
  document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function TripOnDaShip({ winId }: { winId: string }) {
  const [d, update] = useWindowData<ShipData>(winId);
  const phase = d.phase ?? 'shop';
  if (phase === 'trip' && d.trip) return <TripView trip={d.trip} update={update} />;
  if (phase === 'log') return <CatchLog onBack={() => update({ phase: 'shop' })} />;
  return <ShopView update={update} />;
}

/* ── The seaside ticket shop ───────────────────── */

function ShopView({ update }: { update: (p: Partial<ShipData>) => void }) {
  const now = useClock();
  const current = timeOfDay(now);
  const progress = useWorkspace((s) => s.progress);
  const buyTicket = useWorkspace((s) => s.buyTicket);
  const redeemTicket = useWorkspace((s) => s.redeemTicket);
  const openWindow = useWorkspace((s) => s.openWindow);

  const board = (kind: TimeOfDay) => {
    if (redeemTicket(kind)) update({ phase: 'trip', trip: { time: kind, castsLeft: CASTS_PER_TRIP, caught: [] } });
  };
  const noTickets = progress.tickets.day + progress.tickets.night === 0;

  return (
    <div className="ship">
      <div className="ship-scene">
        <Scene kind="shop" time={current}>
          <Ship x={88} y={32} />
        </Scene>
        <div className="ship-hud is-right">
          <span className="ship-pill">
            <PixelIcon name={current === 'day' ? 'sun' : 'moon'} size={16} />
            {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
          <span className="ship-pill" title="Tokens">
            <PixelIcon name="token" size={16} />
            {progress.tokens}
          </span>
        </div>
      </div>

      <div className="ship-panel">
        <div className="tickets">
          {(['day', 'night'] as TimeOfDay[]).map((kind) => {
            const price = ticketPrice(kind, now);
            const owned = progress.tickets[kind];
            const short = price - progress.tokens;
            return (
              <div key={kind} className={`ticket-card is-${kind} ${kind === current ? 'is-now' : ''}`}>
                <PixelIcon name={kind === 'day' ? 'sun' : 'moon'} size={32} />
                <div className="ticket-body">
                  <div className="ticket-name">
                    {kind === 'day' ? 'Day trip' : 'Night trip'}
                    {kind === current && <span className="ticket-now">now</span>}
                  </div>
                  <div className="ticket-price">
                    <PixelIcon name="token" size={16} /> {price}
                  </div>
                </div>
                <div className="ticket-stub">
                  {owned > 0 ? (
                    <button type="button" className="btn-game is-coral" onClick={() => board(kind)}>
                      Sail{owned > 1 ? ` ×${owned}` : ''}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`btn-game ${kind === 'day' ? 'is-sun' : ''}`}
                      disabled={short > 0}
                      onClick={() => buyTicket(kind, price)}
                      title={short > 0 ? `${short} more tokens` : `Buy a ${kind} ticket`}
                    >
                      Buy
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="ship-foot">
          {progress.tokens < TICKET_PRICE && noTickets ? (
            <button type="button" className="link-btn" onClick={() => openWindow('challenge')}>
              Earn tokens in practice
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => update({ phase: 'log' })}>
            <BookOpen size={14} /> Catch log
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Out on the open sea ───────────────────────── */

type CastState = 'ready' | 'casting' | 'waiting' | 'bite' | 'caught' | 'escaped' | 'early';

/** Cast animation: rod back, up, forward; bobber arcs out; splash. One frame every 70ms. */
const CAST_FRAMES = 4 + FLIGHT.length + 2;
function castPose(frame: number): RodPose {
  if (frame < 2) return 'back';
  if (frame < 3) return 'up';
  if (frame < 5) return 'forward';
  return 'rest';
}

function TripView({ trip, update }: { trip: Trip; update: (p: Partial<ShipData>) => void }) {
  const recordCatch = useWorkspace((s) => s.recordCatch);
  const selectFish = useWorkspace((s) => s.selectFish);
  const openWindow = useWorkspace((s) => s.openWindow);
  const pulseWindow = useUI((s) => s.pulseWindow);
  const decorOwned = useWorkspace((s) => s.progress.decorOwned);
  const [state, setState] = useState<CastState>('ready');
  const [frame, setFrame] = useState(0);
  const [result, setResult] = useState<{ fish: FishDef; newFish: boolean; unlocked: string[] } | null>(null);
  const hooked = useRef<FishDef | null>(null);
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const startWaiting = () => {
    setState('waiting');
    timer.current = window.setTimeout(() => {
      setState('bite');
      timer.current = window.setTimeout(() => {
        setState('escaped');
        update({ trip: { ...trip, castsLeft: trip.castsLeft - 1 } });
      }, RARITY[hooked.current!.rarity].biteWindowMs);
    }, waitMs());
  };

  // Plays the cast animation, then the wait begins.
  useEffect(() => {
    if (state !== 'casting') return;
    if (frame >= CAST_FRAMES) {
      startWaiting();
      return;
    }
    const t = window.setTimeout(() => setFrame((f) => f + 1), 70);
    return () => window.clearTimeout(t);
  }, [state, frame]);

  const done = trip.castsLeft <= 0 && state !== 'caught' && state !== 'escaped';
  const canAct = !result && !done && state !== 'escaped' && state !== 'casting';

  const act = () => {
    if (state === 'ready' || state === 'early') {
      hooked.current = rollFish(trip.time);
      if (prefersReducedMotion()) startWaiting();
      else {
        setFrame(0);
        setState('casting');
      }
    } else if (state === 'waiting') {
      // Too early is gentle: reel in an empty line, no cast lost.
      window.clearTimeout(timer.current);
      setState('early');
    } else if (state === 'bite') {
      window.clearTimeout(timer.current);
      const fish = hooked.current!;
      const drop = rollDecorDrop(fish, trip.time, decorOwned);
      setResult({ fish, ...recordCatch(fish.id, drop?.id) });
      setState('caught');
      update({ trip: { ...trip, castsLeft: trip.castsLeft - 1, caught: [...trip.caught, fish.id] } });
    }
  };

  const next = () => {
    setResult(null);
    setState('ready');
  };

  // What's in the water this frame.
  const casting = state === 'casting';
  const pose: RodPose = casting ? castPose(frame) : 'rest';
  const flying = casting && frame >= 4 && frame < 4 + FLIGHT.length;
  const bobberPos: [number, number] = flying ? FLIGHT[frame - 4] : BOBBER_AT;
  const bobberState = state === 'ready' || state === 'early' || (casting && frame < 4) ? 'hidden' : flying ? 'flying' : state === 'bite' ? 'bite' : 'idle';
  const splash = casting && frame >= 4 + FLIGHT.length ? ((frame - 4 - FLIGHT.length) as 0 | 1) : null;
  const tip = ROD_TIPS[pose];

  const status: Partial<Record<CastState, string>> = {
    ready: 'Click the water to cast.',
    casting: 'Casting…',
    waiting: 'Waiting for a bite…',
    bite: 'Now! Click!',
    early: 'Too early. Reeled in an empty line.',
    escaped: 'It got away.',
  };

  return (
    <div className="ship is-trip">
      <div
        className={`ship-scene is-sea ${canAct ? 'can-act' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={status[state] ?? 'Fishing'}
        onPointerDown={(e) => {
          if (e.button === 0 && canAct) act();
        }}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && canAct) {
            e.preventDefault();
            act();
          }
        }}
      >
        <Scene kind="sea" time={trip.time}>
          <Ship x={6} y={34} />
          <Rod pose={pose} />
          {bobberState !== 'hidden' && <FishingLine from={tip} to={[bobberPos[0] + 1, bobberPos[1] + 1]} />}
          <Bobber x={bobberPos[0]} y={bobberPos[1]} state={bobberState} />
          {splash !== null && splash < 2 && <Splash frame={splash} />}
        </Scene>
        <div className="ship-hud">
          <span className="ship-pill">
            <PixelIcon name={trip.time === 'day' ? 'sun' : 'moon'} size={16} />
            {trip.time === 'day' ? 'Day trip' : 'Night trip'}
          </span>
          <span className="ship-pill" aria-label={`${trip.castsLeft} casts left`} title="Casts left">
            {Array.from({ length: CASTS_PER_TRIP }, (_, i) => (
              <span key={i} className={`cast-pip ${i < trip.castsLeft ? 'is-left' : ''}`} />
            ))}
          </span>
        </div>
      </div>

      <div className="ship-panel">
        {result ? (
          <CatchCard result={result} />
        ) : done ? (
          <div className="trip-summary">
            <div className="ticket-name">Back to shore</div>
            {trip.caught.length ? (
              <div className="trip-catches">
                {trip.caught.map((id, i) => (
                  <FishSprite key={i} fish={FISH_BY_ID[id]} scale={2} />
                ))}
              </div>
            ) : (
              <p className="muted small">Nothing this time. The sea keeps its secrets.</p>
            )}
          </div>
        ) : (
          <p className={`trip-status is-${state}`} aria-live="polite">
            {status[state]}
          </p>
        )}

        <div className="trip-actions">
          {result && (
            <button
              type="button"
              className="btn-game is-quiet"
              onClick={() => {
                selectFish(result.fish.id);
                // Reuse the bowl that's already out (restoring it if tucked away); only open one if there isn't any.
                const bowlId = openWindow('fishbowl', { focus: false });
                pulseWindow(bowlId);
              }}
            >
              <PixelIcon name="fishbowl" size={16} /> Put in bowl
            </button>
          )}
          {(result || state === 'escaped') && (
            <button type="button" className="btn-game" onClick={next}>
              {trip.castsLeft > 0 ? 'Cast again' : 'Head back'}
            </button>
          )}
          {done && (
            <button type="button" className="btn-game" onClick={() => update({ phase: 'shop', trip: undefined })}>
              <ArrowLeft size={14} /> Ticket shop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CatchCard({ result }: { result: { fish: FishDef; newFish: boolean; unlocked: string[] } }) {
  const { fish, newFish, unlocked } = result;
  const r = RARITY[fish.rarity];
  return (
    <div className="catch-card" role="status">
      <div className="catch-art">
        <FishSprite fish={fish} scale={3} animated />
      </div>
      <div className="catch-body">
        <div className="catch-name">
          {fish.name}
          {newFish && <span className="tag tag-new">new</span>}
        </div>
        <div className="catch-rarity" style={{ color: r.color }}>
          <span className="rarity-dot" style={{ background: r.color }} /> {r.label}
        </div>
        <p className="catch-desc">{fish.description}</p>
        {unlocked.map((u) => {
          const decor = DECOR_BY_ID[u];
          const food = FOOD_BY_ID[u];
          return (
            <div key={u} className="catch-unlock">
              {decor && <Pixel rows={decor.rows} palette={decor.palette} size={decor.rows[0].length * 2} />}
              {decor ? `New decor: ${decor.name}` : `New fish food: ${food?.name ?? u}`}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Catch log ─────────────────────────────────── */

function CatchLog({ onBack }: { onBack: () => void }) {
  const progress = useWorkspace((s) => s.progress);
  return (
    <div className="ship-log">
      <div className="ship-foot">
        <button type="button" className="btn btn-quiet btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> Tickets
        </button>
        <span className="muted small">
          {progress.fishOwned.length} of {FISH.length}
        </span>
      </div>
      {(['day', 'night'] as const).map((time) => (
        <section key={time}>
          <h4 className="log-h">
            <PixelIcon name={time === 'day' ? 'sun' : 'moon'} size={16} /> {time === 'day' ? 'Day' : 'Night'}
          </h4>
          <ul className="log-grid">
            {FISH.filter((f) => f.time === time || f.time === 'any').map((f) => {
              const n = progress.catches[f.id] ?? 0;
              return (
                <li key={f.id} className={`log-item ${n ? '' : 'is-missing'}`} title={n ? f.description : 'Not caught yet'}>
                  <FishSprite fish={f} scale={2} silhouette={!n} />
                  <span className="log-name">{n ? f.name : '???'}</span>
                  <span className="log-meta">
                    <span className="rarity-dot" style={{ background: RARITY[f.rarity].color }} /> {RARITY[f.rarity].label}
                    {n > 1 && ` · ×${n}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
