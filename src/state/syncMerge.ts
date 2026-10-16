import type { AssistMode, PlacedSticker, Progress, RecentProblem, Settings, Stroke, Win } from './types';
import type { SavedDesk } from './desks';

/**
 * The pure half of account sync: three-way merges between what this device
 * last synced (`base`), what it has now (`local`) and what the account has now
 * (`cloud`). Telling "changed here" from "changed elsewhere" is what lets a
 * brand-new account take everything already on the device, and two devices
 * used offline combine instead of one overwriting the other.
 */

/** The live board, as the account stores it. */
export interface Board {
  windows: Record<string, Win>;
  zTop: number;
  strokes: Stroke[];
  stickers: PlacedSticker[];
  mode: AssistMode;
  deskId: string | null;
  recent: RecentProblem[];
  recentlyClosed: Win[];
}

/** Small per-student flags: what they've already seen. */
export interface Flags {
  seenWelcome: boolean;
  nextTip: number;
  introSeen: string[];
  guideSeen: string[];
}

/**
 * Deep equality that ignores key order. The account keeps these in Postgres jsonb,
 * which re-sorts object keys, so an untouched board comes back with its fields in
 * a different order; comparing JSON text called that a change made elsewhere, and
 * sync then put the account's older board back over the student's work. Keys whose
 * value is undefined count as missing, as they do in JSON.
 */
const sortedKeys = (_key: string, v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]])) : v;
export const same = (a: unknown, b: unknown) => JSON.stringify(a, sortedKeys) === JSON.stringify(b, sortedKeys);
const union = (cloud: string[] = [], local: string[] = []) => [...cloud, ...local.filter((x) => !cloud.includes(x))];
/** cloud + what this device added since base. Never below zero, so a stale spend can't go negative. */
const counter = (base = 0, local = 0, cloud = 0) => Math.max(0, cloud + (local - base));

/**
 * Counters add up what each side earned or spent since base; owned things
 * (stickers, fish, decor, foods) are kept from both; choices (the fish in the
 * bowl, the decor shown) follow whichever side changed them.
 */
export function mergeProgress(base: Progress, local: Progress, cloud: Progress): Progress {
  const catches: Record<string, number> = {};
  for (const id of new Set([...Object.keys(cloud.catches ?? {}), ...Object.keys(local.catches ?? {})])) {
    catches[id] = counter(base.catches?.[id], local.catches?.[id], cloud.catches?.[id]);
  }
  return {
    tokens: counter(base.tokens, local.tokens, cloud.tokens),
    tokensEarned: counter(base.tokensEarned, local.tokensEarned, cloud.tokensEarned),
    solved: counter(base.solved, local.solved, cloud.solved),
    setsFinished: counter(base.setsFinished, local.setsFinished, cloud.setsFinished),
    trips: counter(base.trips, local.trips, cloud.trips),
    tickets: {
      day: counter(base.tickets?.day, local.tickets?.day, cloud.tickets?.day),
      night: counter(base.tickets?.night, local.tickets?.night, cloud.tickets?.night),
    },
    catches,
    stickersEarned: union(cloud.stickersEarned, local.stickersEarned),
    fishOwned: union(cloud.fishOwned, local.fishOwned),
    decorOwned: union(cloud.decorOwned, local.decorOwned),
    foods: union(cloud.foods, local.foods),
    fishSelected: local.fishSelected !== base.fishSelected ? local.fishSelected : cloud.fishSelected,
    decorShown: same(local.decorShown, base.decorShown) ? cloud.decorShown : local.decorShown,
  };
}

/** Field by field: a setting this device changed since base wins, otherwise the account's. */
export function mergeSettings(base: Settings, local: Settings, cloud: Settings): Settings {
  const out = { ...cloud } as Record<string, unknown>;
  const l = local as unknown as Record<string, unknown>;
  const b = base as unknown as Record<string, unknown>;
  for (const k of Object.keys(local)) if (!same(l[k], b[k])) out[k] = l[k];
  return out as unknown as Settings;
}

/** Seen once anywhere means seen; tips keep moving forward. */
export function mergeFlags(local: Flags, cloud: Flags): Flags {
  return {
    seenWelcome: local.seenWelcome || cloud.seenWelcome,
    nextTip: Math.max(local.nextTip ?? 0, cloud.nextTip ?? 0),
    introSeen: union(cloud.introSeen, local.introSeen),
    guideSeen: union(cloud.guideSeen, local.guideSeen),
  };
}

export const boardHasContent = (b: Board | null | undefined) => !!b && (Object.keys(b.windows ?? {}).length > 0 || (b.strokes?.length ?? 0) > 0 || (b.stickers?.length ?? 0) > 0);

/**
 * Which board ends up on screen. Only one side changed: that side. Both did:
 * the account's board, and this device's is kept as a desk so nothing is lost.
 * A device that has never synced counts as starting from an empty board.
 */
export function mergeBoard(base: Board | null, local: Board, cloud: Board | null): { board: Board; keepLocalAsDesk: boolean } {
  const localChanged = base ? !same(local, base) : boardHasContent(local);
  const cloudChanged = base ? !!cloud && !same(cloud, base) : boardHasContent(cloud);
  if (!cloudChanged || !cloud) return { board: local, keepLocalAsDesk: false };
  if (!localChanged) return { board: cloud, keepLocalAsDesk: false };
  return { board: cloud, keepLocalAsDesk: boardHasContent(local) };
}

/**
 * Desk by desk. Both have it: the newer save wins. Only one has it: kept if
 * it's new since the last sync, dropped if the other side deleted it.
 * `base` maps each desk id to its updatedAt as of the last sync.
 */
export function mergeDesks(base: Record<string, number>, local: SavedDesk[], cloud: SavedDesk[]): { desks: SavedDesk[]; upload: SavedDesk[]; remove: string[] } {
  const L = new Map(local.map((d) => [d.id, d]));
  const C = new Map(cloud.map((d) => [d.id, d]));
  const desks: SavedDesk[] = [];
  const upload: SavedDesk[] = [];
  const remove: string[] = [];
  // Local order first (it's what the student sees), then desks only the account has.
  for (const id of [...L.keys(), ...[...C.keys()].filter((k) => !L.has(k))]) {
    const l = L.get(id);
    const c = C.get(id);
    const synced = id in base;
    if (l && c) {
      const winner = l.updatedAt > c.updatedAt ? l : c;
      desks.push(winner);
      if (winner === l && !same(l, c)) upload.push(l);
    } else if (l) {
      if (synced) continue; // deleted on another device
      desks.push(l);
      upload.push(l);
    } else if (c) {
      if (synced) remove.push(id); // deleted on this device
      else desks.push(c);
    }
  }
  return { desks, upload, remove };
}
