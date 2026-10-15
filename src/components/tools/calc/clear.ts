import type { GState } from './graphingEngine';
import type { EState } from './examEngine';

/**
 * A clean screen for a new set of key directions, whatever the model: the
 * entry and the display go, but the things a student set up on purpose stay
 * (Y= functions, the window, degree/radian mode, the basic calculator's tape).
 */
export function clearedForGuide(d: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = { expr: '', fresh: false };
  const g = d.g as GState | undefined;
  if (g) patch.g = { ...g, screen: 'home', entry: [], hist: [], second: false, edit: null, err: null, note: null };
  const e = d.e as EState | undefined;
  if (e) patch.e = { ...e, entry: [], shown: null, second: false, err: null };
  return patch;
}
