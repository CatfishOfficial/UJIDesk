/**
 * The periodic table: symbol, name, standard atomic weight, and category for
 * all 118 elements. Masses in brackets in most tables (no stable isotope) are
 * stored as the mass number of the longest-lived isotope, with `stable: false`.
 */
export type Category =
  | 'alkali'
  | 'alkaline'
  | 'transition'
  | 'post'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble'
  | 'lanthanide'
  | 'actinide'
  | 'unknown';

export const CATEGORY_LABEL: Record<Category, string> = {
  alkali: 'Alkali metal',
  alkaline: 'Alkaline earth metal',
  transition: 'Transition metal',
  post: 'Post-transition metal',
  metalloid: 'Metalloid',
  nonmetal: 'Nonmetal',
  halogen: 'Halogen',
  noble: 'Noble gas',
  lanthanide: 'Lanthanide',
  actinide: 'Actinide',
  unknown: 'Unknown properties',
};

export interface Element {
  z: number;
  symbol: string;
  name: string;
  mass: number;
  /** false when the "mass" is the mass number of the longest-lived isotope. */
  stable: boolean;
  category: Category;
  period: number;
  /** 1–18, or null for the f-block (lanthanides/actinides). */
  group: number | null;
  /** Layout position: row 1–7 main table, 9–10 for the f-block rows. */
  row: number;
  col: number;
}

// [symbol, name, mass, category]; a negative mass marks [mass number] of the longest-lived isotope.
const RAW: [string, string, number, Category][] = [
  ['H', 'Hydrogen', 1.008, 'nonmetal'],
  ['He', 'Helium', 4.0026, 'noble'],
  ['Li', 'Lithium', 6.94, 'alkali'],
  ['Be', 'Beryllium', 9.0122, 'alkaline'],
  ['B', 'Boron', 10.81, 'metalloid'],
  ['C', 'Carbon', 12.011, 'nonmetal'],
  ['N', 'Nitrogen', 14.007, 'nonmetal'],
  ['O', 'Oxygen', 15.999, 'nonmetal'],
  ['F', 'Fluorine', 18.998, 'halogen'],
  ['Ne', 'Neon', 20.18, 'noble'],
  ['Na', 'Sodium', 22.99, 'alkali'],
  ['Mg', 'Magnesium', 24.305, 'alkaline'],
  ['Al', 'Aluminum', 26.982, 'post'],
  ['Si', 'Silicon', 28.085, 'metalloid'],
  ['P', 'Phosphorus', 30.974, 'nonmetal'],
  ['S', 'Sulfur', 32.06, 'nonmetal'],
  ['Cl', 'Chlorine', 35.45, 'halogen'],
  ['Ar', 'Argon', 39.95, 'noble'],
  ['K', 'Potassium', 39.098, 'alkali'],
  ['Ca', 'Calcium', 40.078, 'alkaline'],
  ['Sc', 'Scandium', 44.956, 'transition'],
  ['Ti', 'Titanium', 47.867, 'transition'],
  ['V', 'Vanadium', 50.942, 'transition'],
  ['Cr', 'Chromium', 51.996, 'transition'],
  ['Mn', 'Manganese', 54.938, 'transition'],
  ['Fe', 'Iron', 55.845, 'transition'],
  ['Co', 'Cobalt', 58.933, 'transition'],
  ['Ni', 'Nickel', 58.693, 'transition'],
  ['Cu', 'Copper', 63.546, 'transition'],
  ['Zn', 'Zinc', 65.38, 'transition'],
  ['Ga', 'Gallium', 69.723, 'post'],
  ['Ge', 'Germanium', 72.63, 'metalloid'],
  ['As', 'Arsenic', 74.922, 'metalloid'],
  ['Se', 'Selenium', 78.971, 'nonmetal'],
  ['Br', 'Bromine', 79.904, 'halogen'],
  ['Kr', 'Krypton', 83.798, 'noble'],
  ['Rb', 'Rubidium', 85.468, 'alkali'],
  ['Sr', 'Strontium', 87.62, 'alkaline'],
  ['Y', 'Yttrium', 88.906, 'transition'],
  ['Zr', 'Zirconium', 91.224, 'transition'],
  ['Nb', 'Niobium', 92.906, 'transition'],
  ['Mo', 'Molybdenum', 95.95, 'transition'],
  ['Tc', 'Technetium', -98, 'transition'],
  ['Ru', 'Ruthenium', 101.07, 'transition'],
  ['Rh', 'Rhodium', 102.91, 'transition'],
  ['Pd', 'Palladium', 106.42, 'transition'],
  ['Ag', 'Silver', 107.87, 'transition'],
  ['Cd', 'Cadmium', 112.41, 'transition'],
  ['In', 'Indium', 114.82, 'post'],
  ['Sn', 'Tin', 118.71, 'post'],
  ['Sb', 'Antimony', 121.76, 'metalloid'],
  ['Te', 'Tellurium', 127.6, 'metalloid'],
  ['I', 'Iodine', 126.9, 'halogen'],
  ['Xe', 'Xenon', 131.29, 'noble'],
  ['Cs', 'Cesium', 132.91, 'alkali'],
  ['Ba', 'Barium', 137.33, 'alkaline'],
  ['La', 'Lanthanum', 138.91, 'lanthanide'],
  ['Ce', 'Cerium', 140.12, 'lanthanide'],
  ['Pr', 'Praseodymium', 140.91, 'lanthanide'],
  ['Nd', 'Neodymium', 144.24, 'lanthanide'],
  ['Pm', 'Promethium', -145, 'lanthanide'],
  ['Sm', 'Samarium', 150.36, 'lanthanide'],
  ['Eu', 'Europium', 151.96, 'lanthanide'],
  ['Gd', 'Gadolinium', 157.25, 'lanthanide'],
  ['Tb', 'Terbium', 158.93, 'lanthanide'],
  ['Dy', 'Dysprosium', 162.5, 'lanthanide'],
  ['Ho', 'Holmium', 164.93, 'lanthanide'],
  ['Er', 'Erbium', 167.26, 'lanthanide'],
  ['Tm', 'Thulium', 168.93, 'lanthanide'],
  ['Yb', 'Ytterbium', 173.05, 'lanthanide'],
  ['Lu', 'Lutetium', 174.97, 'lanthanide'],
  ['Hf', 'Hafnium', 178.49, 'transition'],
  ['Ta', 'Tantalum', 180.95, 'transition'],
  ['W', 'Tungsten', 183.84, 'transition'],
  ['Re', 'Rhenium', 186.21, 'transition'],
  ['Os', 'Osmium', 190.23, 'transition'],
  ['Ir', 'Iridium', 192.22, 'transition'],
  ['Pt', 'Platinum', 195.08, 'transition'],
  ['Au', 'Gold', 196.97, 'transition'],
  ['Hg', 'Mercury', 200.59, 'transition'],
  ['Tl', 'Thallium', 204.38, 'post'],
  ['Pb', 'Lead', 207.2, 'post'],
  ['Bi', 'Bismuth', 208.98, 'post'],
  ['Po', 'Polonium', -209, 'post'],
  ['At', 'Astatine', -210, 'halogen'],
  ['Rn', 'Radon', -222, 'noble'],
  ['Fr', 'Francium', -223, 'alkali'],
  ['Ra', 'Radium', -226, 'alkaline'],
  ['Ac', 'Actinium', -227, 'actinide'],
  ['Th', 'Thorium', 232.04, 'actinide'],
  ['Pa', 'Protactinium', 231.04, 'actinide'],
  ['U', 'Uranium', 238.03, 'actinide'],
  ['Np', 'Neptunium', -237, 'actinide'],
  ['Pu', 'Plutonium', -244, 'actinide'],
  ['Am', 'Americium', -243, 'actinide'],
  ['Cm', 'Curium', -247, 'actinide'],
  ['Bk', 'Berkelium', -247, 'actinide'],
  ['Cf', 'Californium', -251, 'actinide'],
  ['Es', 'Einsteinium', -252, 'actinide'],
  ['Fm', 'Fermium', -257, 'actinide'],
  ['Md', 'Mendelevium', -258, 'actinide'],
  ['No', 'Nobelium', -259, 'actinide'],
  ['Lr', 'Lawrencium', -266, 'actinide'],
  ['Rf', 'Rutherfordium', -267, 'transition'],
  ['Db', 'Dubnium', -268, 'transition'],
  ['Sg', 'Seaborgium', -269, 'transition'],
  ['Bh', 'Bohrium', -270, 'transition'],
  ['Hs', 'Hassium', -277, 'transition'],
  ['Mt', 'Meitnerium', -278, 'unknown'],
  ['Ds', 'Darmstadtium', -281, 'unknown'],
  ['Rg', 'Roentgenium', -282, 'unknown'],
  ['Cn', 'Copernicium', -285, 'unknown'],
  ['Nh', 'Nihonium', -286, 'unknown'],
  ['Fl', 'Flerovium', -289, 'unknown'],
  ['Mc', 'Moscovium', -290, 'unknown'],
  ['Lv', 'Livermorium', -293, 'unknown'],
  ['Ts', 'Tennessine', -294, 'unknown'],
  ['Og', 'Oganesson', -294, 'unknown'],
];

/** Period, group and layout cell, worked out from the atomic number. */
function place(z: number): Pick<Element, 'period' | 'group' | 'row' | 'col'> {
  if (z === 1) return { period: 1, group: 1, row: 1, col: 1 };
  if (z === 2) return { period: 1, group: 18, row: 1, col: 18 };
  const starts = [3, 11, 19, 37, 55, 87];
  let period = 2;
  for (let i = starts.length - 1; i >= 0; i--) if (z >= starts[i]) {
    period = i + 2;
    break;
  }
  const off = z - starts[period - 2] + 1;
  if (period <= 3) {
    const group = off <= 2 ? off : off + 10;
    return { period, group, row: period, col: group };
  }
  if (period <= 5) return { period, group: off, row: period, col: off };
  // Periods 6–7: f-block lives in its own rows below the table.
  if (off <= 2) return { period, group: off, row: period, col: off };
  if (off <= 17) return { period, group: null, row: period === 6 ? 9 : 10, col: off };
  const group = off - 14;
  return { period, group, row: period, col: group };
}

export const ELEMENTS: Element[] = RAW.map(([symbol, name, mass, category], i) => ({
  z: i + 1,
  symbol,
  name,
  mass: Math.abs(mass),
  stable: mass > 0,
  category,
  ...place(i + 1),
}));

export const BY_SYMBOL: Record<string, Element> = Object.fromEntries(ELEMENTS.map((e) => [e.symbol.toLowerCase(), e]));

const ALIASES: Record<string, string> = { aluminium: 'al', sulphur: 's', caesium: 'cs' };

/** Finds an element by symbol ("Po"), name ("polonium"), or atomic number ("84"). */
export function findElement(raw: string): Element | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/^\d+$/.test(s)) return ELEMENTS[Number(s) - 1] ?? null;
  return BY_SYMBOL[s] ?? ELEMENTS.find((e) => e.name.toLowerCase() === s) ?? BY_SYMBOL[ALIASES[s]] ?? null;
}

export function elementByZ(z: number): Element | null {
  return ELEMENTS[z - 1] ?? null;
}

/* ── Electron configuration ───────────────────────── */

const ORDER = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p', '6s', '4f', '5d', '6p', '7s', '5f', '6d', '7p'];
const CAPACITY: Record<string, number> = { s: 2, p: 6, d: 10, f: 14 };
const NOBLE_CORES: [number, string][] = [
  [86, 'Rn'],
  [54, 'Xe'],
  [36, 'Kr'],
  [18, 'Ar'],
  [10, 'Ne'],
  [2, 'He'],
];

/** Well-known ground-state exceptions to the Aufbau (Madelung) order. */
const EXCEPTIONS: Record<string, string> = {
  Cr: '[Ar] 4s1 3d5',
  Cu: '[Ar] 4s1 3d10',
  Nb: '[Kr] 5s1 4d4',
  Mo: '[Kr] 5s1 4d5',
  Ru: '[Kr] 5s1 4d7',
  Rh: '[Kr] 5s1 4d8',
  Pd: '[Kr] 4d10',
  Ag: '[Kr] 5s1 4d10',
  La: '[Xe] 6s2 5d1',
  Ce: '[Xe] 6s2 4f1 5d1',
  Gd: '[Xe] 6s2 4f7 5d1',
  Pt: '[Xe] 6s1 4f14 5d9',
  Au: '[Xe] 6s1 4f14 5d10',
  Ac: '[Rn] 7s2 6d1',
  Th: '[Rn] 7s2 6d2',
  Pa: '[Rn] 7s2 5f2 6d1',
  U: '[Rn] 7s2 5f3 6d1',
  Np: '[Rn] 7s2 5f4 6d1',
  Cm: '[Rn] 7s2 5f7 6d1',
  Lr: '[Rn] 7s2 5f14 7p1',
};

/** Noble-gas shorthand in filling order, e.g. "[Ar] 4s2 3d6". */
export function electronConfig(z: number): string {
  const el = elementByZ(z);
  if (!el) return '';
  if (EXCEPTIONS[el.symbol]) return EXCEPTIONS[el.symbol];
  const core = NOBLE_CORES.find(([cz]) => cz < z);
  let remaining = z;
  const parts: string[] = [];
  let skip = core ? core[0] : 0;
  for (const orb of ORDER) {
    if (remaining <= 0) break;
    const n = Math.min(CAPACITY[orb[1]], remaining);
    remaining -= n;
    if (skip > 0) {
      skip -= n;
      continue;
    }
    parts.push(`${orb}${n}`);
  }
  return (core ? `[${core[1]}] ` : '') + parts.join(' ');
}
