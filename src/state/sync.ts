import { supabase } from './supabase';
import { initialProgress, initialSettings, uid, useWorkspace, type WorkspaceState } from './store';
import { localDeskStorage, replaceDesks, useDesks, type DeskSnapshot, type SavedDesk } from './desks';
import { signOut, useAccount } from './account';
import { useUI } from './ui';
import { viewport } from './placement';
import { boardHasContent, mergeBoard, mergeDesks, mergeFlags, mergeProgress, mergeSettings, same, type Board, type Flags } from './syncMerge';
import type { Progress, Settings } from './types';

/**
 * Account sync, local-first: the browser copy stays the working copy (instant,
 * and fine offline), and Supabase is a mirror kept in step in the background.
 * Every sync pulls the account, three-way merges it with this device (see
 * syncMerge.ts), and writes the result to both. `uji.sync` remembers what was
 * last in step, which is how a merge tells "changed here" from "changed
 * elsewhere", and how a device that has never synced hands everything it has
 * to the account it signs in to.
 */

interface Payload {
  progress: Progress;
  settings: Settings;
  board: Board;
  flags: Flags;
}

interface SyncRecord {
  userId: string;
  /** The account row's version when this device was last in step. */
  rev: number;
  base: Payload;
  /** Each synced desk's updatedAt as of then. */
  desks: Record<string, number>;
}

interface StateRow {
  progress: Partial<Progress> | null;
  settings: Partial<Settings> | null;
  board: Partial<Board> | null;
  flags: Partial<Flags> | null;
  rev: number;
}

interface DeskRow {
  id: string;
  name: string;
  snapshot: DeskSnapshot;
  created_at: string;
  updated_at: string;
}

const KEY = 'uji.sync';
const EMPTY_BOARD: Board = { windows: {}, zTop: 10, strokes: [], stickers: [], mode: 'cheat', deskId: null, recent: [], recentlyClosed: [] };
const EMPTY_FLAGS: Flags = { seenWelcome: false, nextTip: 0, introSeen: [], guideSeen: [] };
/** Quiet time before a change is saved, and the longest a busy session waits. */
const DEBOUNCE_MS = 2000;
const MAX_WAIT_MS = 15000;
/** Away at least this long, and coming back checks for changes from other devices. */
const STALE_MS = 30000;

function readRecord(): SyncRecord | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as SyncRecord | null;
  } catch {
    return null;
  }
}

function writeRecord(r: SyncRecord | null) {
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage full: the next sync just merges from further back.
  }
}

function currentPayload(): Payload {
  const s = useWorkspace.getState();
  return {
    progress: s.progress,
    settings: s.settings,
    board: { windows: s.windows, zTop: s.zTop, strokes: s.strokes, stickers: s.stickers, mode: s.mode, deskId: s.deskId, recent: s.recent, recentlyClosed: s.recentlyClosed },
    flags: { seenWelcome: s.seenWelcome, nextTip: s.nextTip, introSeen: s.introSeen, guideSeen: s.guideSeen },
  };
}

/** The account's row with defaults for anything added to the app since it was saved, as the local store does. */
function fromRow(row: StateRow): Payload {
  return {
    progress: { ...initialProgress, ...row.progress, tickets: { ...initialProgress.tickets, ...row.progress?.tickets } },
    settings: { ...initialSettings, ...row.settings, arrange: { ...initialSettings.arrange, ...row.settings?.arrange } },
    board: { ...EMPTY_BOARD, ...row.board },
    flags: { ...EMPTY_FLAGS, ...row.flags },
  };
}

const toDesk = (r: DeskRow): SavedDesk => ({ id: r.id, name: r.name, snapshot: r.snapshot, createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at) });
const toDeskRow = (userId: string, d: SavedDesk) => ({
  user_id: userId,
  id: d.id,
  name: d.name,
  snapshot: d.snapshot,
  created_at: new Date(d.createdAt).toISOString(),
  updated_at: new Date(d.updatedAt).toISOString(),
});

/** This device's board, kept as a desk when the account already had a different one. */
function deskFromBoard(b: Board): SavedDesk {
  const now = Date.now();
  const { vw, vh } = viewport();
  const day = new Date(now).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { id: uid('desk'), name: `From this device · ${day}`, createdAt: now, updatedAt: now, snapshot: { windows: b.windows, zTop: b.zTop, strokes: b.strokes, stickers: b.stickers, mode: b.mode, viewport: { w: vw, h: vh } } };
}

const hasAnything = (p: Payload, desks: SavedDesk[]) => !same(p.progress, initialProgress) || boardHasContent(p.board) || desks.length > 0;

/**
 * Puts a payload on screen, touching only what actually differs: reloading the
 * board resets focus and refits every window, so it happens only when the
 * windows, ink or stickers themselves changed.
 */
function apply(p: Payload) {
  const cur = currentPayload();
  const patch: Partial<WorkspaceState> = {};
  if (!same(cur.progress, p.progress)) patch.progress = p.progress;
  if (!same(cur.settings, p.settings)) patch.settings = p.settings;
  if (!same(cur.flags, p.flags)) Object.assign(patch, p.flags);
  const { windows, zTop, strokes, stickers, mode, deskId, recent, recentlyClosed } = p.board;
  if (!same(cur.board.recent, recent)) patch.recent = recent;
  if (!same(cur.board.recentlyClosed, recentlyClosed)) patch.recentlyClosed = recentlyClosed;
  const core = (b: Board) => ({ windows: b.windows, zTop: b.zTop, strokes: b.strokes, stickers: b.stickers, mode: b.mode, deskId: b.deskId });
  if (!same(core(cur.board), core(p.board))) {
    useWorkspace.getState().loadBoard({ windows, zTop, strokes, stickers, mode }, deskId);
    // loadBoard empties the closed list; put the synced one back.
    patch.recentlyClosed = recentlyClosed;
  }
  if (Object.keys(patch).length) useWorkspace.setState(patch);
}

function setStatus(sync: 'idle' | 'saving' | 'saved' | 'offline' | 'error') {
  if (useAccount.getState().sync !== sync) useAccount.setState({ sync });
}

const isOffline = (e: unknown) => {
  const err = e as { name?: string; status?: number; message?: string } | null;
  return (typeof navigator !== 'undefined' && !navigator.onLine) || err?.name === 'TypeError' || err?.status === 0 || /fetch|network/i.test(err?.message ?? '');
};

/** Clears this device back to a fresh UJI: what a shared computer should look like after signing out. */
function clearDevice() {
  writeRecord(null);
  applying = true;
  try {
    useWorkspace.getState().reset('everything');
    useWorkspace.setState({ deskId: null });
    replaceDesks([]);
  } finally {
    applying = false;
  }
}

let applying = false;
let running: Promise<void> | null = null;
let again = false;

/**
 * Every tab of UJI in this browser shares one saved copy and one sync record, so
 * only one may sync at a time; otherwise two tabs merge from the same stale record
 * and count the same new tokens twice. The lock spans tabs (Web Locks); a browser
 * without it just runs unguarded.
 */
const withSyncLock = (fn: () => Promise<void>): Promise<void> =>
  typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request('uji-sync', fn) : fn();

/** One sync, queued behind any already running so two never interleave. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await withSyncLock(syncOnce);
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce() {
  const userId = useAccount.getState().userId;
  if (!supabase || !userId) return;
  setStatus('saving');
  // Start from the latest saved copy: another tab may have changed it since this tab last looked.
  applying = true;
  try {
    await useWorkspace.persist.rehydrate();
    useDesks.setState({ desks: localDeskStorage.read() });
  } finally {
    applying = false;
  }
  let rec = readRecord();
  // Someone else's stuff, left behind when their session ended without signing out:
  // it isn't this student's to keep, and their own copy is safe in their account.
  if (rec && rec.userId !== userId) {
    clearDevice();
    rec = null;
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const [stateRes, desksRes] = await Promise.all([
      supabase.from('user_state').select('progress, settings, board, flags, rev').eq('user_id', userId).maybeSingle(),
      supabase.from('desks').select('id, name, snapshot, created_at, updated_at').eq('user_id', userId),
    ]);
    if (stateRes.error) throw stateRes.error;
    if (desksRes.error) throw desksRes.error;
    const row = stateRes.data as StateRow | null;
    const cloud = row ? fromRow(row) : null;
    const cloudDesks = (desksRes.data as DeskRow[]).map(toDesk);

    const local = currentPayload();
    const localDesks = useDesks.getState().desks;
    const base = rec?.base ?? null;
    const carried = !rec && hasAnything(local, localDesks);

    const { board, keepLocalAsDesk } = mergeBoard(base?.board ?? null, local.board, cloud?.board ?? null);
    const merged: Payload = {
      progress: mergeProgress(base?.progress ?? initialProgress, local.progress, cloud?.progress ?? initialProgress),
      settings: mergeSettings(base?.settings ?? initialSettings, local.settings, cloud?.settings ?? initialSettings),
      flags: mergeFlags(local.flags, cloud?.flags ?? EMPTY_FLAGS),
      board,
    };
    const deskMerge = mergeDesks(rec?.desks ?? {}, keepLocalAsDesk ? [deskFromBoard(local.board), ...localDesks] : localDesks, cloudDesks);

    // Save the row, but only over the version just read: if another device saved
    // in between, nothing is written and the loop pulls and merges again.
    let rev = row?.rev ?? 0;
    if (!row) {
      const res = await supabase.from('user_state').insert({ user_id: userId, ...merged, rev: 1 });
      if (res.error?.code === '23505') continue;
      if (res.error) throw res.error;
      rev = 1;
    } else if (!same(cloud, merged)) {
      const res = await supabase
        .from('user_state')
        .update({ ...merged, rev: row.rev + 1 })
        .eq('user_id', userId)
        .eq('rev', row.rev)
        .select('rev');
      if (res.error) throw res.error;
      if (!res.data?.length) continue;
      rev = row.rev + 1;
    }
    if (deskMerge.upload.length) {
      const res = await supabase.from('desks').upsert(deskMerge.upload.map((d) => toDeskRow(userId, d)), { onConflict: 'user_id,id' });
      if (res.error) throw res.error;
    }
    if (deskMerge.remove.length) {
      const res = await supabase.from('desks').delete().eq('user_id', userId).in('id', deskMerge.remove);
      if (res.error) throw res.error;
    }

    writeRecord({ userId, rev, base: merged, desks: Object.fromEntries(deskMerge.desks.map((d) => [d.id, d.updatedAt])) });

    // Anything changed on this device while the requests were out is merged in
    // rather than overwritten, and goes up on the next round.
    const now = currentPayload();
    const onScreen: Payload = same(now, local)
      ? merged
      : {
          progress: mergeProgress(local.progress, now.progress, merged.progress),
          settings: mergeSettings(local.settings, now.settings, merged.settings),
          flags: mergeFlags(now.flags, merged.flags),
          board: mergeBoard(local.board, now.board, merged.board).board,
        };
    const desksNow = useDesks.getState().desks;
    const desksOnScreen = same(desksNow, localDesks) ? deskMerge.desks : mergeDesks(Object.fromEntries(localDesks.map((d) => [d.id, d.updatedAt])), desksNow, deskMerge.desks).desks;
    applying = true;
    try {
      apply(onScreen);
      if (!same(desksNow, desksOnScreen)) replaceDesks(desksOnScreen);
    } finally {
      applying = false;
    }
    if (!same(onScreen, merged) || !same(desksOnScreen, deskMerge.desks)) again = true;

    setStatus('saved');
    if (carried) useUI.getState().toast('Everything on this device is now saved to your account.');
    return;
  }
  throw new Error('Too many saves from other devices at once');
}

/* ── Scheduling ─────────────────────────────────────── */

let debounce = 0;
let firstChange = 0;
let retry = 0;
let retryDelay = 5000;
let hiddenAt = 0;

function run() {
  window.clearTimeout(debounce);
  window.clearTimeout(retry);
  firstChange = 0;
  // Known offline: say so now rather than after the client's own retries give up; 'online' runs it again.
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }
  syncNow().then(
    () => {
      retryDelay = 5000;
    },
    (e) => {
      setStatus(isOffline(e) ? 'offline' : 'error');
      retry = window.setTimeout(run, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 60000);
    },
  );
}

/** A change on this device: saved once things go quiet, or after MAX_WAIT_MS of steady changes. */
function changed() {
  if (applying || !useAccount.getState().userId) return;
  const t = Date.now();
  if (!firstChange) firstChange = t;
  window.clearTimeout(debounce);
  debounce = window.setTimeout(run, t - firstChange >= MAX_WAIT_MS ? 0 : DEBOUNCE_MS);
}

let started = false;

/** Starts syncing whenever a student is signed in. Call once at startup, after startAccount. */
export function startSync() {
  if (!supabase || started) return;
  started = true;
  useAccount.subscribe((s, prev) => {
    if (s.userId && s.userId !== prev.userId) run();
    if (!s.userId && prev.userId) {
      window.clearTimeout(debounce);
      window.clearTimeout(retry);
      setStatus('idle');
    }
  });
  useWorkspace.subscribe(changed);
  useDesks.subscribe(changed);
  window.addEventListener('online', () => useAccount.getState().userId && run());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > STALE_MS && useAccount.getState().userId) run();
  });
}

/**
 * Signing out saves what's left, then clears this device so the next person
 * on a shared computer starts fresh. If the save can't happen (offline), it
 * doesn't sign out, rather than leave changes nowhere but a cleared device.
 */
export async function signOutAndClear(): Promise<void> {
  window.clearTimeout(debounce);
  const stay = () => useUI.getState().toast('Couldn’t save your latest changes, so you’re still signed in. Try again when you’re back online.');
  if (!navigator.onLine) {
    setStatus('offline');
    return stay();
  }
  try {
    await syncNow();
  } catch (e) {
    setStatus(isOffline(e) ? 'offline' : 'error');
    return stay();
  }
  await signOut();
  clearDevice();
  useUI.getState().toast('Signed out. This device is cleared; everything is saved in your account.');
}
