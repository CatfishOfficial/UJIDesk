/**
 * Periodic trends: atomic radius, electronegativity and first ionization
 * energy for each element (index = Z − 1, null where there's no good value),
 * and a comparer that ranks picked elements and says why each one outranks
 * the last.
 */
import { blockOf, type Element } from './elements';

export type Trend = 'radius' | 'en' | 'ie';

export interface TrendInfo {
  label: string;
  short: string;
  unit: string;
  /** Decimal places to show. */
  digits: number;
  /** Where on the table the values run high. */
  grows: 'down-left' | 'up-right';
  rule: string;
  source: string;
  values: (number | null)[];
}

const _ = null;

export const TRENDS: Record<Trend, TrendInfo> = {
  radius: {
    label: 'Atomic radius',
    short: 'Radius',
    unit: 'pm',
    digits: 0,
    grows: 'down-left',
    rule: 'Grows down a group and shrinks across a period.',
    source: 'Calculated radii (Clementi et al., 1967). None for the f-block or period 7.',
    // prettier-ignore
    values: [
      53, 31, 167, 112, 87, 67, 56, 48, 42, 38,
      190, 145, 118, 111, 98, 88, 79, 71, 243, 194,
      184, 176, 171, 166, 161, 156, 152, 149, 145, 142,
      136, 125, 114, 103, 94, 88, 265, 219, 212, 206,
      198, 190, 183, 178, 173, 169, 165, 161, 156, 145,
      133, 123, 115, 108, 298, 253, _, _, _, _,
      _, _, _, _, _, _, _, _, _, _,
      _, 208, 200, 193, 188, 185, 180, 177, 174, 171,
      156, 154, 143, 135, 127, 120, _, _, _, _,
      _, _, _, _, _, _, _, _, _, _,
      _, _, _, _, _, _, _, _, _, _,
      _, _, _, _, _, _, _, _,
    ],
  },
  en: {
    label: 'Electronegativity',
    short: 'Electronegativity',
    unit: '',
    digits: 2,
    grows: 'up-right',
    rule: 'Rises across a period and falls down a group; fluorine is the highest.',
    source: 'Pauling scale. Helium, neon and argon form no bonds to measure.',
    // prettier-ignore
    values: [
      2.2, _, 0.98, 1.57, 2.04, 2.55, 3.04, 3.44, 3.98, _,
      0.93, 1.31, 1.61, 1.9, 2.19, 2.58, 3.16, _, 0.82, 1.0,
      1.36, 1.54, 1.63, 1.66, 1.55, 1.83, 1.88, 1.91, 1.9, 1.65,
      1.81, 2.01, 2.18, 2.55, 2.96, 3.0, 0.82, 0.95, 1.22, 1.33,
      1.6, 2.16, 1.9, 2.2, 2.28, 2.2, 1.93, 1.69, 1.78, 1.96,
      2.05, 2.1, 2.66, 2.6, 0.79, 0.89, 1.1, 1.12, 1.13, 1.14,
      1.13, 1.17, 1.2, 1.2, 1.1, 1.22, 1.23, 1.24, 1.25, 1.1,
      1.27, 1.3, 1.5, 2.36, 1.9, 2.2, 2.2, 2.28, 2.54, 2.0,
      1.62, 2.33, 2.02, 2.0, 2.2, 2.2, 0.7, 0.9, 1.1, 1.3,
      1.5, 1.38, 1.36, 1.28, 1.13, 1.28, 1.3, 1.3, 1.3, 1.3,
      1.3, 1.3, _, _, _, _, _, _, _, _,
      _, _, _, _, _, _, _, _,
    ],
  },
  ie: {
    label: 'First ionization energy',
    short: 'Ionization',
    unit: 'kJ/mol',
    digits: 0,
    grows: 'up-right',
    rule: 'Rises across a period and falls down a group; the noble gases are the highest.',
    source: 'Energy to remove one electron from the gaseous atom (NIST / CRC).',
    // prettier-ignore
    values: [
      1312, 2372, 520, 900, 801, 1086, 1402, 1314, 1681, 2081,
      496, 738, 578, 787, 1012, 1000, 1251, 1521, 419, 590,
      633, 659, 651, 653, 717, 762, 760, 737, 746, 906,
      579, 762, 947, 941, 1140, 1351, 403, 550, 600, 640,
      652, 684, 702, 710, 720, 804, 731, 868, 558, 709,
      834, 869, 1008, 1170, 376, 503, 538, 534, 527, 533,
      540, 545, 547, 593, 566, 573, 581, 589, 597, 603,
      524, 659, 761, 770, 760, 840, 880, 870, 890, 1007,
      589, 716, 703, 812, 899, 1037, 393, 509, 499, 587,
      568, 598, 605, 585, 578, 581, 601, 608, 619, 627,
      635, 642, 479, _, _, _, _, _, _, _,
      _, _, _, _, _, _, _, _,
    ],
  },
};

export const TREND_KEYS = Object.keys(TRENDS) as Trend[];

export const trendValue = (t: Trend, e: Element): number | null => TRENDS[t].values[e.z - 1] ?? null;

export function fmtTrend(t: Trend, v: number | null): string {
  if (v === null) return '—';
  const { unit, digits } = TRENDS[t];
  return `${v.toFixed(digits)}${unit ? ` ${unit}` : ''}`;
}

/** The lowest and highest value on the whole table, for scaling an overlay. */
export function trendRange(t: Trend): [number, number] {
  const vs = TRENDS[t].values.filter((v): v is number => v !== null);
  return [Math.min(...vs), Math.max(...vs)];
}

/* ── Comparing picked elements ────────────────────── */

export interface TrendStep {
  /** The lower of the pair. */
  from: Element;
  /** The higher of the pair. */
  to: Element;
  tie: boolean;
  /** Against the usual trend. */
  exception: boolean;
  why: string;
}

export interface TrendComparison {
  /** Lowest value first; ties keep the order picked. */
  order: Element[];
  /** Picked elements with no value for this trend. */
  missing: Element[];
  steps: TrendStep[];
  /** "period 3" or "group 17" when every ranked element shares one. */
  shared: string | null;
}

/** Left-to-right position; the f-block counts as squeezed in between groups 3 and 4. */
const across = (e: Element) => e.group ?? 3 + (e.z - (e.period === 6 ? 57 : 89)) / 15;

const shells = (n: number) => (n === 1 ? 'one more electron shell' : `${n} more electron shells`);

/** Why `b` has the larger value than `a`. */
function explain(t: Trend, a: Element, b: Element): { why: string; exception: boolean } {
  const A = a.symbol;
  const B = b.symbol;
  const dp = b.period - a.period;
  const dx = across(b) - across(a);
  const big = t === 'radius';
  const column = a.group !== null ? `group ${a.group}` : 'the same f-block column';
  // +1 where b sits where the trend runs high, −1 where it runs low, 0 if level.
  const vertical = Math.sign(big ? dp : -dp);
  const horizontal = Math.sign(big ? -dx : dx);

  const reason = {
    radius: {
      row: `${B} is left of ${A} in period ${a.period}: fewer protons pull on the same outer shell, so it's larger.`,
      col: `${B} is below ${A} in ${column}: it has ${shells(Math.abs(dp))}, so its outer electrons sit farther out.`,
      both: `${B} is lower and further left than ${A}: both trends make it larger.`,
      downWins: `${B} is lower but further right than ${A}: here the extra shell outweighs the extra protons.`,
      leftWins: `${B} is higher but further left than ${A}: here the weaker pull outweighs having one less shell.`,
    },
    en: {
      row: `${B} is right of ${A} in period ${a.period}: more protons pull on the same shell, so it attracts bonding electrons more strongly.`,
      col: `${B} is above ${A} in ${column}: its outer shell is closer to the nucleus, so it attracts bonding electrons more strongly.`,
      both: `${B} is higher and further right than ${A}: both trends make it more electronegative.`,
      upWins: `${B} is further left but higher than ${A}: here being closer to the nucleus outweighs having fewer protons.`,
      rightWins: `${B} is lower but further right than ${A}: here the extra protons outweigh the extra shell.`,
    },
    ie: {
      row: `${B} is right of ${A} in period ${a.period}: more protons pull on the same shell, so its outer electron is harder to remove.`,
      col: `${B} is above ${A} in ${column}: its outer electron is closer to the nucleus and less shielded, so it's harder to remove.`,
      both: `${B} is higher and further right than ${A}: both trends make its electron harder to remove.`,
      upWins: `${B} is further left but higher than ${A}: here being closer to the nucleus outweighs having fewer protons.`,
      rightWins: `${B} is lower but further right than ${A}: here the extra protons outweigh the extra shell.`,
    },
  }[t] as Record<string, string>;

  const sameRow = dp === 0;
  const sameCol = dx === 0;
  if (sameRow && horizontal > 0) return { why: reason.row, exception: false };
  if (sameCol && vertical > 0) return { why: reason.col, exception: false };
  if (!sameRow && !sameCol) {
    if (vertical > 0 && horizontal > 0) return { why: reason.both, exception: false };
    if (vertical > 0) return { why: big ? reason.downWins : reason.upWins, exception: false };
    if (horizontal > 0) return { why: big ? reason.leftWins : reason.rightWins, exception: false };
  }

  // Against the trend. Name the reason where it's a well-known one.
  if (t === 'ie' && sameRow && a.group === 13 && (b.group ?? 3) < 13)
    return {
      exception: true,
      why: `An exception: ${A}'s outermost electron sits alone in a p orbital, a little higher in energy and shielded by the filled s pair, so it comes off more easily than ${B}'s.`,
    };
  if (t === 'ie' && sameRow && a.group === 16 && b.group === 15)
    return {
      exception: true,
      why: `An exception: ${A} has one paired p electron, and the repulsion within that pair makes it easier to remove than an electron from ${B}'s half-filled p subshell.`,
    };
  if (t !== 'radius' && sameCol) {
    if (b.period === 6 && a.period === 5)
      return {
        exception: true,
        why: `An exception: ${B} comes after the 14 lanthanides, whose extra protons are poorly shielded by f electrons (the lanthanide contraction), so ${B} holds its electrons more tightly than ${A}.`,
      };
    if (b.period === 4 && a.period === 3 && (b.group ?? 0) >= 13)
      return {
        exception: true,
        why: `An exception: ${B} comes right after the first row of transition metals, whose 10 extra protons are poorly shielded by d electrons, so ${B} holds its electrons more tightly than ${A}.`,
      };
  }
  const inner = [a, b].some((e) => blockOf(e) === 'f') ? 'f' : [a, b].every((e) => blockOf(e) === 'd') ? 'd' : null;
  return {
    exception: true,
    why: inner
      ? `Goes against the usual trend, which is common in the ${inner}-block: added electrons fill an inner ${inner} subshell, so the pull on the outer electrons barely changes.`
      : `Goes against the usual trend for where ${A} and ${B} sit on the table.`,
  };
}

export function compareTrend(t: Trend, els: Element[]): TrendComparison {
  const ranked = els.filter((e) => trendValue(t, e) !== null);
  const missing = els.filter((e) => trendValue(t, e) === null);
  const order = [...ranked].sort((a, b) => trendValue(t, a)! - trendValue(t, b)!);
  const steps: TrendStep[] = [];
  for (let i = 1; i < order.length; i++) {
    const a = order[i - 1];
    const b = order[i];
    if (trendValue(t, a) === trendValue(t, b)) {
      steps.push({ from: a, to: b, tie: true, exception: false, why: `${a.symbol} and ${b.symbol} are about the same.` });
    } else steps.push({ from: a, to: b, tie: false, ...explain(t, a, b) });
  }
  const one = <T,>(f: (e: Element) => T) => order.length > 1 && order.every((e) => f(e) === f(order[0]));
  const shared = one((e) => e.period) ? `period ${order[0].period}` : order[0]?.group != null && one((e) => e.group) ? `group ${order[0].group}` : null;
  return { order, missing, steps, shared };
}
