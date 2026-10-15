import { ELEMENTS, elementByZ, findElement, type Element } from './elements';

const ELEMENTS_BY_NAME: Record<string, Element> = Object.fromEntries(ELEMENTS.map((e) => [e.name.toLowerCase(), e]));
import type { Step } from '../math/steps';

/**
 * Basic nuclear decay: alpha, beta-minus and positron emission. Everything is
 * conservation of mass number (A, top) and atomic number (Z, bottom).
 *
 * Nuclide markup is `[A|Z|Sym]`, rendered with A above and Z below the symbol.
 */
export type DecayType = 'alpha' | 'beta' | 'positron';

export const DECAY: Record<DecayType, { name: string; particle: { a: number; z: number; sym: string }; particleName: string; dz: string }> = {
  alpha: { name: 'Alpha decay', particle: { a: 4, z: 2, sym: 'He' }, particleName: 'an alpha particle (a helium-4 nucleus)', dz: 'down by 2' },
  beta: { name: 'Beta decay', particle: { a: 0, z: -1, sym: 'e' }, particleName: 'a beta particle (an electron)', dz: 'up by 1' },
  positron: { name: 'Positron emission', particle: { a: 0, z: 1, sym: 'e' }, particleName: 'a positron', dz: 'down by 1' },
};

export interface Nuclide {
  a: number;
  z: number;
  el: Element;
}

export const nuc = (a: number, z: number, sym: string) => `[${a}|${z}|${sym}]`;
export const nucOf = (n: Nuclide) => nuc(n.a, n.z, n.el.symbol);
export const particleOf = (t: DecayType) => {
  const p = DECAY[t].particle;
  return nuc(p.a, p.z, p.sym);
};

export type DecayResult =
  | {
      kind: 'ok';
      type: DecayType;
      parent: Nuclide;
      daughter: Nuclide;
      equation: string;
      steps: Step[];
    }
  | { kind: 'error'; message: string; field?: 'el' | 'a' };

export function solveDecay(parentEl: Element, a: number, type: DecayType): DecayResult {
  const z = parentEl.z;
  if (!Number.isInteger(a) || a < 1) return { kind: 'error', message: 'The mass number should be a whole number, like 210.', field: 'a' };
  if (a < z) return { kind: 'error', message: `A nucleus can't have fewer nucleons (${a}) than protons (${z}). Check the mass number.`, field: 'a' };
  if (a > 320) return { kind: 'error', message: 'That mass number is far heavier than any known nucleus.', field: 'a' };
  const p = DECAY[type].particle;
  const da = a - p.a;
  const dz = z - p.z;
  if (dz < 1 || da < dz) {
    return {
      kind: 'error',
      message:
        type === 'alpha'
          ? `${parentEl.name}-${a} is too light to give off an alpha particle (it would leave nothing behind).`
          : `${parentEl.name}-${a} can't emit a positron: there'd be no protons left.`,
    };
  }
  const daughterEl = elementByZ(dz);
  if (!daughterEl) return { kind: 'error', message: `Atomic number ${dz} is beyond the periodic table.` };
  const parent: Nuclide = { a, z, el: parentEl };
  const daughter: Nuclide = { a: da, z: dz, el: daughterEl };
  const particle = particleOf(type);
  const pName = DECAY[type].particleName;

  const steps: Step[] = [
    {
      id: 'particle',
      title: `${DECAY[type].name} gives off ${pName}`,
      eq: `${nucOf(parent)} → ? + ${particle}`,
      note: type === 'beta' ? 'A neutron turns into a proton and shoots out an electron.' : type === 'positron' ? 'A proton turns into a neutron and shoots out a positron.' : undefined,
      lesson: 'particle',
    },
    {
      id: 'mass',
      title: 'Mass numbers (top) must add up',
      eq: `${a} = A + ${p.a}  →  A = ${da}`,
      note: p.a === 0 ? 'The electron/positron has mass number 0, so A stays the same.' : undefined,
      lesson: 'mass',
    },
    {
      id: 'atomic',
      title: 'Atomic numbers (bottom) must add up',
      eq: `${z} = Z + ${p.z < 0 ? `(${p.z})` : p.z}  →  Z = ${dz}`,
      note: `So the atomic number goes ${DECAY[type].dz}.`,
      lesson: 'atomic',
    },
    {
      id: 'element',
      title: `Atomic number ${dz} is ${daughterEl.name.toLowerCase()}`,
      eq: nucOf(daughter),
      lesson: 'element',
    },
    {
      id: 'check',
      title: 'Balanced: top and bottom both add up',
      eq: `${nucOf(parent)} → ${nucOf(daughter)} + ${particle}`,
      note: `${a} = ${da} + ${p.a}, and ${z} = ${dz} + ${p.z < 0 ? `(${p.z})` : p.z}.`,
    },
  ];

  return { kind: 'ok', type, parent, daughter, equation: `${nucOf(parent)} → ${nucOf(daughter)} + ${particle}`, steps };
}

/**
 * Reads a nuclide typed any common way: "Po-210", "Po 210", "210Po",
 * "polonium-210", "84 Po 210", "210 84 Po". Returns what it could find.
 */
export function parseNuclide(raw: string): { el?: Element; a?: number } {
  const s = raw.replace(/[–—−]/g, '-').trim();
  const nums = (s.match(/\d+/g) ?? []).map(Number);
  // 1) a symbol or name right next to a number: Po-210, 210Po, polonium 210
  const near = [...s.matchAll(/([A-Za-z]+)\s*-?\s*\d+|\d+\s*-?\s*([A-Za-z]+)/g)].map((m) => m[1] ?? m[2]);
  // 2) a full element name anywhere; 3) a properly-cased symbol that isn't an everyday word
  const words = s.match(/[A-Za-z]+/g) ?? [];
  const COMMON = new Set(['in', 'as', 'at', 'he', 'no', 'be', 'i', 'is', 'so', 'or', 'on', 'of']);
  let el: Element | undefined =
    near.map((w) => findElement(w)).find(Boolean) ??
    words.map((w) => (w.length > 2 ? ELEMENTS_BY_NAME[w.toLowerCase()] : undefined)).find(Boolean) ??
    words
      .filter((w) => /^[A-Z][a-z]?$/.test(w) && !COMMON.has(w.toLowerCase()))
      .map((w) => findElement(w))
      .find(Boolean) ??
    undefined;
  let a: number | undefined;
  if (el) {
    // If the atomic number is written too, the mass number is the other one.
    const rest = nums.filter((n) => n !== el!.z || nums.length === 1);
    a = rest.length ? Math.max(...rest) : undefined;
  } else if (nums.length >= 2) {
    const [x, y] = nums;
    el = elementByZ(Math.min(x, y)) ?? undefined;
    a = Math.max(x, y);
  }
  return { el, a };
}

/** Finds a decay type mentioned in text. */
export function parseDecayType(raw: string): DecayType | null {
  const s = raw.toLowerCase();
  if (/positron|β\+|beta\s*(plus|\+)|\bb\+/.test(s)) return 'positron';
  if (/alpha|α/.test(s)) return 'alpha';
  if (/beta|β|electron emission/.test(s)) return 'beta';
  return null;
}
