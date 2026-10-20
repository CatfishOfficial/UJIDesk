import { CAPACITY, EXCEPTIONS, NOBLE_CORES, ORDER, elementByZ, findElement, type Element } from './elements';
import type { Step } from '../math/steps';

/**
 * Electron configurations: Aufbau (Madelung) filling with the usual measured
 * exceptions, ions (cations lose from the highest shell first, anions keep
 * filling), and both the long (full) and short (noble-gas) forms.
 *
 * Subshells are written in filling order, matching the periodic table tool:
 * "[Ar] 4s2 3d6". `byShell` gives the same electrons grouped by n.
 */
export type SubshellLetter = 's' | 'p' | 'd' | 'f';

export interface Subshell {
  n: number;
  l: SubshellLetter;
  e: number;
}

export type ConfigForm = 'long' | 'short';

const L_RANK: Record<SubshellLetter, number> = { s: 0, p: 1, d: 2, f: 3 };
const keyOf = (s: { n: number; l: SubshellLetter }) => `${s.n}${s.l}`;
const cap = (l: SubshellLetter) => CAPACITY[l];
const fillRank = (s: Subshell) => ORDER.indexOf(keyOf(s));

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sup = (n: number | string) => String(n).replace(/\d/g, (d) => SUP[Number(d)]);

/** Plain Aufbau filling of `count` electrons, lowest energy first. */
export function aufbau(count: number): Subshell[] {
  const out: Subshell[] = [];
  let left = count;
  for (const o of ORDER) {
    if (left <= 0) break;
    const l = o[1] as SubshellLetter;
    const e = Math.min(cap(l), left);
    out.push({ n: Number(o[0]), l, e });
    left -= e;
  }
  return out;
}

/** "[Ar] 4s1 3d5" → the full list of subshells. */
function parseShort(text: string): Subshell[] {
  const [first, ...rest] = text.split(' ');
  const core = NOBLE_CORES.find(([, sym]) => `[${sym}]` === first);
  const parts = core ? rest : [first, ...rest];
  const subs = core ? aufbau(core[0]) : [];
  for (const p of parts) {
    const m = /^(\d)([spdf])(\d+)$/.exec(p);
    if (m) subs.push({ n: Number(m[1]), l: m[2] as SubshellLetter, e: Number(m[3]) });
  }
  return sortFill(subs);
}

const sortFill = (subs: Subshell[]) => [...subs].sort((a, b) => fillRank(a) - fillRank(b));
const sortShell = (subs: Subshell[]) => [...subs].sort((a, b) => a.n - b.n || L_RANK[a.l] - L_RANK[b.l]);
const total = (subs: Subshell[]) => subs.reduce((t, s) => t + s.e, 0);

/** A neutral atom's ground state, measured exceptions included. */
export function groundState(z: number): Subshell[] {
  const el = elementByZ(z);
  if (!el) return [];
  return EXCEPTIONS[el.symbol] ? parseShort(EXCEPTIONS[el.symbol]) : aufbau(z);
}

/** "1s2 2s2 2p6" (plain digits, copy-friendly) or "1s² 2s² 2p⁶" (pretty). */
export function formatSubs(subs: Subshell[], pretty = false): string {
  return subs
    .filter((s) => s.e > 0)
    .map((s) => `${keyOf(s)}${pretty ? sup(s.e) : s.e}`)
    .join(' ');
}

/** The biggest noble-gas core whose subshells are all present and full. */
function coreOf(subs: Subshell[]): { z: number; symbol: string } | null {
  const have = new Map(subs.map((s) => [keyOf(s), s.e]));
  const count = total(subs);
  for (const [cz, symbol] of NOBLE_CORES) {
    if (cz >= count) continue;
    if (aufbau(cz).every((c) => have.get(keyOf(c)) === c.e)) return { z: cz, symbol };
  }
  return null;
}

/** The subshells outside a core (or all of them with no core). */
export function outsideCore(subs: Subshell[], core: { z: number } | null): Subshell[] {
  if (!core) return subs.filter((s) => s.e > 0);
  const inCore = new Set(aufbau(core.z).map(keyOf));
  return subs.filter((s) => s.e > 0 && !inCore.has(keyOf(s)));
}

/** Electrons left in each orbital box, paired only once every box has one (Hund's rule). */
export function orbitalBoxes(s: Subshell): (0 | 1 | 2)[] {
  const boxes = cap(s.l) / 2;
  return Array.from({ length: boxes }, (_, i) => (s.e >= boxes + i + 1 ? 2 : s.e >= i + 1 ? 1 : 0));
}

export const unpairedIn = (subs: Subshell[]) => subs.reduce((t, s) => t + orbitalBoxes(s).filter((b) => b === 1).length, 0);

/* ── Reading what was typed ───────────────────────── */

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };
const ANION_NAMES: Record<string, [string, number]> = {
  hydride: ['H', -1],
  fluoride: ['F', -1],
  chloride: ['Cl', -1],
  bromide: ['Br', -1],
  iodide: ['I', -1],
  oxide: ['O', -2],
  sulfide: ['S', -2],
  sulphide: ['S', -2],
  selenide: ['Se', -2],
  nitride: ['N', -3],
  phosphide: ['P', -3],
};

/** Superscripts, true minus signs and carets → plain "Fe3+". */
const plainCharge = (s: string) =>
  s
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String(SUP.indexOf(c)))
    .replace(/⁺/g, '+')
    .replace(/[⁻−–]/g, '-')
    .replace(/\^/g, '')
    .replace(/[{}]/g, '');

/** "2+", "+2", "3-", "-1", "+", "0", "" → a number (0 when blank); null when unreadable. */
export function parseCharge(raw: string): number | null {
  const s = plainCharge(raw).replace(/\s+/g, '');
  if (!s || s === '0') return 0;
  const m = /^(?:([+-])(\d*)|(\d+)([+-]))$/.exec(s);
  if (!m) return null;
  const sign = (m[1] ?? m[4]) === '-' ? -1 : 1;
  const digits = m[2] ?? m[3];
  return sign * (digits ? Number(digits) : 1);
}

/**
 * Reads an atom or ion: "Fe", "iron", "26", "Fe3+", "Fe^3+", "Fe+3", "O2−",
 * "Cl⁻", "iron(III)", "oxide". `charge` is null when none is written.
 */
export function parseSpecies(raw: string): { el: Element | null; charge: number | null } {
  let s = plainCharge(raw).trim().replace(/\s+(ion|atom)$/i, '').trim();
  if (!s) return { el: null, charge: null };
  const named = ANION_NAMES[s.toLowerCase()];
  if (named) return { el: findElement(named[0]), charge: named[1] };
  const roman = /^(.+?)\s*\(\s*([ivx]+)\s*\)$/i.exec(s);
  if (roman && ROMAN[roman[2].toLowerCase()]) return { el: findElement(roman[1]), charge: ROMAN[roman[2].toLowerCase()] };
  const after = /^([A-Za-z]+|\d{1,3})\s*(\d*)\s*([+-])$/.exec(s);
  if (after) return { el: findElement(after[1]), charge: (after[3] === '-' ? -1 : 1) * (after[2] ? Number(after[2]) : 1) };
  const before = /^([A-Za-z]+|\d{1,3})\s*([+-])\s*(\d+)$/.exec(s);
  if (before) return { el: findElement(before[1]), charge: (before[2] === '-' ? -1 : 1) * Number(before[3]) };
  s = s.replace(/^(element|atomic number|z\s*=)\s*/i, '');
  return { el: findElement(s), charge: null };
}

/** "Fe³⁺", "O²⁻", "Na⁺", "Cl⁻", or "Fe". */
export function speciesLabel(el: Element, charge: number, pretty = true): string {
  if (!charge) return el.symbol;
  const mag = Math.abs(charge) === 1 ? '' : String(Math.abs(charge));
  const sign = charge > 0 ? '+' : '-';
  return pretty ? `${el.symbol}${sup(mag)}${charge > 0 ? '⁺' : '⁻'}` : `${el.symbol}${mag}${sign}`;
}

/* ── Solving ──────────────────────────────────────── */

const EXCEPTION_WHY: Record<string, string> = {
  Cr: 'A half-filled d subshell is extra stable, so one 4s electron moves into 3d.',
  Mo: 'A half-filled d subshell is extra stable, so one 5s electron moves into 4d.',
  Cu: 'A completely full d subshell is extra stable, so one 4s electron moves into 3d.',
  Ag: 'A completely full d subshell is extra stable, so one 5s electron moves into 4d.',
  Au: 'A completely full d subshell is extra stable, so one 6s electron moves into 5d.',
  Pd: 'Both 5s electrons move into 4d, filling it completely.',
  Pt: 'One 6s electron moves into 5d; the 6s and 5d energies are very close here.',
  Gd: 'One electron goes into 5d instead, which keeps 4f exactly half full (4f⁷).',
};
const EXCEPTION_GENERIC = 'The subshells here are so close in energy that experiments find a slightly different filling than the simple order predicts.';

export type ElectronResult =
  | {
      kind: 'ok';
      el: Element;
      charge: number;
      electrons: number;
      /** How many electrons the Aufbau fill uses: the neutral atom for a cation, the ion itself otherwise. */
      fillCount: number;
      /** Plain Aufbau fill of fillCount, before exceptions or removal. */
      filled: Subshell[];
      /** The last subshell the Aufbau fill reaches, and how many electrons it holds. */
      last: Subshell;
      exception: { from: Subshell[]; to: Subshell[]; why: string } | null;
      /** For cations: electrons taken out, in the order they leave. */
      removed: Subshell[];
      config: Subshell[];
      core: { z: number; symbol: string } | null;
      long: string;
      short: string;
      byShell: string;
      unpaired: number;
      outer: { n: number; e: number };
      /** The noble gas with exactly this configuration, if any. */
      isoelectronic: Element | null;
      predicted: boolean;
      steps: Step[];
    }
  | { kind: 'error'; message: string; field?: 'el' | 'charge' };

/** Markup for a configuration: quoted, so it renders upright with real superscripts. */
export const cfgMarkup = (text: string) => `"${text}"`;

export function solveElectrons(el: Element, charge: number): ElectronResult {
  if (!Number.isInteger(charge) || Math.abs(charge) > 8) return { kind: 'error', message: 'Ion charges are whole numbers, usually between 3− and 4+.', field: 'charge' };
  const electrons = el.z - charge;
  const label = speciesLabel(el, charge);
  if (electrons <= 0) return { kind: 'error', message: `${label} would have no electrons left${el.z === 1 ? ' (it’s a bare proton)' : ''}, so there’s nothing to configure.`, field: 'charge' };
  if (electrons > 118) return { kind: 'error', message: `That’s ${electrons} electrons, more than any known atom holds.`, field: 'charge' };

  const fillCount = charge > 0 ? el.z : electrons;
  const filled = aufbau(fillCount);
  const last = filled[filled.length - 1];

  // Measured exceptions apply to the neutral atom (and so to its cations).
  let exception: Extract<ElectronResult, { kind: 'ok' }>['exception'] = null;
  let config = filled;
  if (charge >= 0 && EXCEPTIONS[el.symbol]) {
    config = groundState(el.z);
    exception = { from: filled, to: config, why: EXCEPTION_WHY[el.symbol] ?? EXCEPTION_GENERIC };
  }

  // Cations lose electrons from the highest shell first (then the highest subshell in it).
  const removed: Subshell[] = [];
  if (charge > 0) {
    const work = config.map((s) => ({ ...s }));
    for (let left = charge; left > 0; left--) {
      const from = work.filter((s) => s.e > 0).sort((a, b) => b.n - a.n || L_RANK[b.l] - L_RANK[a.l])[0];
      from.e--;
      const r = removed.find((x) => x.n === from.n && x.l === from.l);
      if (r) r.e++;
      else removed.push({ n: from.n, l: from.l, e: 1 });
    }
    config = work.filter((s) => s.e > 0);
  }
  config = sortFill(config.filter((s) => s.e > 0));

  const core = coreOf(config);
  const long = formatSubs(config);
  const rest = formatSubs(outsideCore(config, core));
  const short = core ? `[${core.symbol}]${rest ? ` ${rest}` : ''}` : long;
  const byShell = formatSubs(sortShell(config));
  const outerN = Math.max(...config.map((s) => s.n));
  const outer = { n: outerN, e: config.filter((s) => s.n === outerN).reduce((t, s) => t + s.e, 0) };
  const noble = NOBLE_CORES.find(([cz]) => cz === electrons);
  const isoelectronic = noble && formatSubs(aufbau(noble[0])) === long ? elementByZ(noble[0]) : null;

  const P = (subs: Subshell[]) => cfgMarkup(formatSubs(subs, true));
  const shortPretty = (subs: Subshell[]) => {
    const c = coreOf(subs);
    const r = formatSubs(outsideCore(subs, c), true);
    return c ? `[${c.symbol}]${r ? ` ${r}` : ''}` : formatSubs(subs, true);
  };
  const before = fillCount - last.e;
  const steps: Step[] = [];

  steps.push({
    id: 'count',
    title: 'Count the electrons',
    eq: charge === 0 ? `Z = ${el.z}  →  ${electrons} "electrons"` : `${el.z} ${charge > 0 ? '-' : '+'} ${Math.abs(charge)} = ${electrons} "electrons"`,
    note:
      charge === 0
        ? `A neutral atom has as many electrons as protons: ${el.name.toLowerCase()} has atomic number ${el.z}.`
        : charge > 0
          ? `A ${Math.abs(charge)}+ charge means ${Math.abs(charge)} electron${Math.abs(charge) > 1 ? 's were' : ' was'} lost.`
          : `A ${Math.abs(charge)}− charge means ${Math.abs(charge)} extra electron${Math.abs(charge) > 1 ? 's were' : ' was'} gained.`,
    lesson: 'count',
  });
  steps.push({
    id: 'fill',
    title: charge > 0 ? `Fill the neutral atom first, lowest energy first (${fillCount} electrons)` : 'Fill subshells, lowest energy first (Aufbau)',
    eq: P(filled),
    note: 'Order: 1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p. An s subshell holds 2, p holds 6, d holds 10, f holds 14.',
    lesson: 'order',
  });
  steps.push({
    id: 'last',
    title: `The last ${last.e === 1 ? 'electron goes' : `${last.e} electrons go`} into ${keyOf(last)}`,
    eq: `${fillCount} - ${before} = ${last.e}  →  ${cfgMarkup(`${keyOf(last)}${sup(last.e)}`)}`,
    note: fillCount === el.z ? lastNote(el, last) : undefined,
    lesson: 'last',
  });
  if (exception) {
    steps.push({
      id: 'exception',
      title: `${el.name} is an exception`,
      eq: `${cfgMarkup(shortPretty(exception.from))}  →  ${cfgMarkup(shortPretty(exception.to))}`,
      note: exception.why,
      lesson: 'exception',
    });
  }
  if (charge > 0) {
    const pre = sortFill((exception?.to ?? filled).filter((s) => s.e > 0));
    steps.push({
      id: 'remove',
      title: `Take ${charge} electron${charge > 1 ? 's' : ''} from the outermost shell`,
      eq: `${cfgMarkup(shortPretty(pre))} - ${charge}e^-  →  ${cfgMarkup(shortPretty(config))}`,
      note: `Electrons leave from the highest n first: ${removed.map((r) => `${keyOf(r)}${sup(r.e)}`).join(' then ')}.${removed[0] && removed[0].l === 's' && config.some((s) => s.l === 'd' || s.l === 'f') ? ' The s electrons filled first but they’re the outermost, so they go first too.' : ''}`,
      lesson: 'remove',
    });
  }
  if (core) {
    const coreEl = elementByZ(core.z)!;
    steps.push({
      id: 'short',
      title: `Shorten with the noble-gas core [${core.symbol}]`,
      eq: `"[${core.symbol}]" = ${P(aufbau(core.z))}`,
      note: `${coreEl.name} (Z = ${core.z}) is the biggest noble gas whose electrons are all here. Write [${core.symbol}], then the rest.`,
      lesson: 'core',
    });
  }
  steps.push({
    id: 'check',
    title: 'Check: the superscripts add up',
    eq: `${config.map((s) => s.e).join(' + ')} = ${electrons}`,
    note: isoelectronic && charge !== 0 ? `${label} has the same configuration as ${isoelectronic.name.toLowerCase()}: they’re isoelectronic.` : undefined,
  });

  return {
    kind: 'ok',
    el,
    charge,
    electrons,
    fillCount,
    filled,
    last,
    exception,
    removed,
    config,
    core,
    long,
    short,
    byShell,
    unpaired: unpairedIn(config),
    outer,
    isoelectronic,
    predicted: el.z >= 104,
    steps,
  };
}

/** How the periodic table shows where the last electron goes. */
function lastNote(el: Element, last: Subshell): string {
  const b = last.l;
  const lag = b === 'd' ? ' (d lags one row behind)' : b === 'f' ? ' (f lags two rows behind)' : '';
  return `On the table, ${el.name.toLowerCase()} is in period ${el.period}, ${b}-block: so ${keyOf(last)}${lag}.`;
}

/** "electron configuration of Fe3+", "Cu2+ noble gas notation", "iron". */
export function readElectronProblem(text: string): { el: string; charge: string; form: ConfigForm } | null {
  const short = /noble[- ]gas|shorthand|short|abbreviat|condensed/i.test(text);
  const body = text
    .replace(/\b(write|what is|what's|whats|what|is|give|show|draw|orbital|diagram|find|determine|the|an?|full|complete|long|ground[- ]state|noble[- ]gas|shorthand|short|abbreviated|condensed|electron(ic)?|configurations?|notation|form|of|for|config)\b/gi, ' ')
    .replace(/[?.:,]/g, ' ')
    .trim();
  const tokens = body.split(/\s+/).filter(Boolean);
  // Whole-text first ("iron(III)"), then each token: names before symbols, the last symbol wins.
  for (const cand of [body, ...tokens.filter((t) => t.length > 2), ...[...tokens].reverse()]) {
    const sp = parseSpecies(cand);
    if (sp.el && (cand.length > 2 || /^[A-Z][a-z]?(\d*[+\-−⁺⁻]|[⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻])?$/.test(cand) || /^\d+$/.test(cand))) {
      const c = sp.charge ?? 0;
      return { el: sp.el.symbol, charge: c === 0 ? '' : `${Math.abs(c)}${c > 0 ? '+' : '-'}`, form: short ? 'short' : 'long' };
    }
  }
  return null;
}
