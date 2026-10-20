import type { LessonDecision } from '../math/lessons';
import type { LessonGuide } from '../math/teaching';
import { KHAN } from '../data/khan';
import { NOBLE_CORES, ORDER, elementByZ } from './elements';
import { aufbau, cfgMarkup, formatSubs, outsideCore, speciesLabel, sup, type ElectronResult, type Subshell } from './electrons';

type Ok = Extract<ElectronResult, { kind: 'ok' }>;

const key = (s: { n: number; l: string }) => `${s.n}${s.l}`;
const int = (raw: string) => (/^\s*\d+\s*$/.test(raw) ? Number(raw) : NaN);

/** Lesson mode for electron configurations: one decision at a time, with targeted feedback. */
export function buildElectronLesson(r: Ok): LessonDecision[] {
  const { el, charge, electrons, fillCount, last } = r;
  const label = speciesLabel(el, charge);
  const q = Math.abs(charge);
  const decisions: LessonDecision[] = [];

  decisions.push({
    id: 'count',
    teach:
      charge === 0
        ? 'A neutral atom has the same number of **electrons** as protons, and the atomic number counts the protons.'
        : `Start from the atomic number (the protons). An ion’s charge tells you how electrons changed: **positive** means electrons were **lost**, **negative** means electrons were **gained**.`,
    why: charge === 0 ? `${el.name} is atomic number ${el.z}, so ${electrons} electrons.` : `${el.z} protons; ${charge > 0 ? `lose ${q}` : `gain ${q}`}: ${el.z} ${charge > 0 ? '−' : '+'} ${q} = ${electrons}.`,
    answer: String(electrons),
    prompt: `How many electrons does **${label}** have?`,
    context: `${el.symbol}: Z = ${el.z}${charge ? `, charge ${q}${charge > 0 ? '+' : '−'}` : ''}`,
    input: { kind: 'number', label: 'electrons' },
    hints: [charge === 0 ? 'Look up the atomic number.' : `Atomic number ${el.z}, then ${charge > 0 ? 'take away' : 'add'} ${q}.`],
    after: `${electrons} "electrons"`,
    check: (raw) => {
      const v = int(raw);
      if (Number.isNaN(v)) return { ok: false, feedback: 'Electrons come in whole numbers.' };
      if (v === electrons) return { ok: true };
      if (charge !== 0 && v === el.z) return { ok: false, feedback: 'That’s the neutral atom. Now use the charge.' };
      if (charge !== 0 && v === el.z + charge) return { ok: false, feedback: charge > 0 ? 'A positive ion has *lost* electrons (they’re negative), so it has fewer than the atom.' : 'A negative ion has *gained* electrons, so it has more than the atom.' };
      return { ok: false, feedback: `${el.name} has atomic number ${el.z}.` };
    },
  });

  // Which subshell the Aufbau fill ends in, with its neighbours (and the usual d/f row slip) as choices.
  const idx = ORDER.indexOf(key(last));
  const trap = last.l === 'd' ? `${last.n + 1}d` : last.l === 'f' ? `${last.n + 1}f` : null;
  const opts = [ORDER[idx - 1], ORDER[idx], ORDER[idx + 1], trap].filter((o, i, a): o is string => !!o && a.indexOf(o) === i).slice(0, 4);
  decisions.push({
    id: 'order',
    teach: `Electrons fill the lowest-energy subshells first: **1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p…** The periodic table is the map: its s, p, d and f blocks are those subshells, and reading across the rows gives the order. The d-block lags one row behind (row 4 → 3d), the f-block two.`,
    why: `Filling ${fillCount} electrons in order ends in ${key(last)}: ${formatSubs(r.filled, true)}.`,
    answer: key(last),
    prompt: charge > 0 ? `Fill the neutral atom first (${fillCount} electrons). Which subshell does the **last** electron go into?` : `Fill ${fillCount} electrons in order. Which subshell does the **last** electron go into?`,
    input: { kind: 'choice', options: opts.map((o) => ({ id: o, label: o })) },
    hints: ['Count along: 1s holds 2, 2s 2, 2p 6, 3s 2, 3p 6, 4s 2, 3d 10…', 'Or find the element on the periodic table: its row and block name the subshell.'],
    after: cfgMarkup(formatSubs(r.filled, true)),
    check: (id) =>
      id === key(last)
        ? { ok: true }
        : id === trap
          ? { ok: false, feedback: last.l === 'd' ? `The d-block lags a row behind: in period ${last.n + 1} it’s ${last.n}d.` : `The f-block lags two rows behind: in period ${last.n + 2} it’s ${last.n}f.` }
          : ORDER.indexOf(id) < idx
            ? { ok: false, feedback: `${id} fills up before you run out: keep going.` }
            : { ok: false, feedback: `You run out of electrons before ${id}.` },
  });

  const before = fillCount - last.e;
  decisions.push({
    id: 'last',
    teach: 'Everything before the last subshell is full. Whatever is left over sits in the last one.',
    why: `${fillCount} − ${before} = ${last.e}, so ${key(last)}${sup(last.e)}.`,
    answer: String(last.e),
    prompt: `The subshells before ${key(last)} hold ${before} electrons. How many go into **${key(last)}**?`,
    context: `${fillCount} - ${before} = ?`,
    input: { kind: 'number', label: key(last) },
    helper: 'calculator',
    calc: `${fillCount} − ${before}`,
    hints: [`Subtract: ${fillCount} − ${before}.`],
    after: cfgMarkup(`${key(last)}${sup(last.e)}`),
    check: (raw) => {
      const v = int(raw);
      if (Number.isNaN(v)) return { ok: false, feedback: 'A whole number of electrons.' };
      if (v === last.e) return { ok: true };
      const room = { s: 2, p: 6, d: 10, f: 14 }[last.l];
      if (v > room) return { ok: false, feedback: `A ${last.l} subshell only holds ${room}.` };
      return { ok: false, feedback: `What’s left: ${fillCount} − ${before}.` };
    },
  });

  if (r.exception) {
    const ex = r.exception;
    const a = shortOf(ex.from);
    const b = shortOf(ex.to);
    decisions.push({
      id: 'exception',
      teach: `${el.name} is one of the famous **exceptions**: experiments find a slightly different filling than the simple order. Many teachers ask you to know chromium and copper.`,
      why: ex.why,
      answer: 'actual',
      prompt: `Which is ${el.name.toLowerCase()}’s **real** ground state?`,
      input: {
        kind: 'choice',
        options: [
          { id: 'aufbau', label: `$${cfgMarkup(a)}$  (straight from the filling order)` },
          { id: 'actual', label: `$${cfgMarkup(b)}$  (measured)` },
        ],
      },
      hints: [el.symbol === 'Cr' || el.symbol === 'Mo' ? 'Half-filled d subshells are extra stable.' : el.symbol === 'Cu' || el.symbol === 'Ag' || el.symbol === 'Au' ? 'Completely full d subshells are extra stable.' : 'It’s on the list of exceptions.'],
      after: cfgMarkup(b),
      check: (id) => (id === 'actual' ? { ok: true } : { ok: false, feedback: `That’s what the order predicts, but ${el.name.toLowerCase()} is an exception.` }),
    });
  }

  if (charge > 0) {
    const pre = (r.exception?.to ?? r.filled).filter((s) => s.e > 0);
    const outside = outsideCore(pre, null).slice(-4);
    const first = key(r.removed[0]);
    const options = [...new Set([...outside.map(key), first])].map((o) => ({ id: o, label: o }));
    decisions.push({
      id: 'remove',
      teach: 'Electrons come off from the **outermost** shell, the one with the highest n, even if it filled earlier. So transition metals lose their s electrons before their d electrons.',
      why: `The highest shell is n = ${r.removed[0].n}, so ${first} goes first: ${r.removed.map((x) => `${key(x)}${sup(x.e)}`).join(' then ')}.`,
      answer: first,
      prompt: `${label} has lost ${q} electron${q > 1 ? 's' : ''}. Which subshell loses electrons **first**?`,
      context: cfgMarkup(shortOf(pre)),
      input: { kind: 'choice', options },
      hints: ['Look for the biggest number in front of the letter.'],
      after: cfgMarkup(shortOf(r.config)),
      check: (id) =>
        id === first
          ? { ok: true }
          : id === key(last)
            ? { ok: false, feedback: 'Last in isn’t first out: electrons leave the highest shell (highest n) first.' }
            : { ok: false, feedback: `Look for the highest n. Here that’s n = ${r.removed[0].n}.` },
    });
  }

  if (r.core) {
    const i = NOBLE_CORES.findIndex(([z]) => z === r.core!.z);
    const near = [NOBLE_CORES[i - 1], NOBLE_CORES[i], NOBLE_CORES[i + 1]].filter(Boolean).sort((a, b) => a[0] - b[0]);
    decisions.push({
      id: 'core',
      teach: 'The **short form** replaces the inner electrons with the noble gas that has exactly those electrons, in brackets. Use the last noble gas *before* your electron count.',
      why: `${elementByZ(r.core.z)!.name} has ${r.core.z} electrons: ${formatSubs(aufbau(r.core.z), true)}. That’s all of this inside [${r.core.symbol}].`,
      answer: r.core.symbol,
      prompt: `Which noble gas core starts the **short form** for ${electrons} electrons?`,
      input: { kind: 'choice', options: near.map(([z, s]) => ({ id: s, label: `[${s}], ${z} electrons` })) },
      hints: ['Noble gases: He 2, Ne 10, Ar 18, Kr 36, Xe 54, Rn 86.', 'Pick the biggest one that’s still less than your count.'],
      after: cfgMarkup(shortOf(r.config)),
      check: (id) => {
        if (id === r.core!.symbol) return { ok: true };
        const z = NOBLE_CORES.find(([, s]) => s === id)?.[0] ?? 0;
        return z >= electrons ? { ok: false, feedback: `[${id}] has ${z} electrons, too many: the core has to fit inside ${electrons}.` } : { ok: false, feedback: 'That works, but there’s a bigger noble gas that still fits. Use the biggest.' };
      },
    });
  }

  return decisions;
}

function shortOf(subs: Subshell[]): string {
  const full = subs.filter((s) => s.e > 0);
  const n = full.reduce((t, s) => t + s.e, 0);
  const core = NOBLE_CORES.find(([z]) => z < n && aufbau(z).every((c) => full.some((s) => key(s) === key(c) && s.e === c.e)));
  const rest = formatSubs(outsideCore(full, core ? { z: core[0] } : null), true);
  return core ? `[${core[1]}]${rest ? ` ${rest}` : ''}` : formatSubs(full, true);
}

export function guideElectrons(r: Ok): LessonGuide {
  const label = speciesLabel(r.el, r.charge);
  return {
    goal: `Write the electron configuration of ${label}, long and short.`,
    idea: 'Electrons fill **subshells** (s, p, d, f) from lowest energy up, and each kind holds a fixed number: s 2, p 6, d 10, f 14. The periodic table is laid out in exactly those blocks, so reading it row by row gives the filling order. The **long form** lists every subshell; the **short form** swaps the inner ones for a noble gas in brackets.',
    plan: [
      'Count the electrons (atomic number, then adjust for any charge).',
      'Fill subshells in order until the electrons run out.',
      ...(r.exception ? ['Check for a known exception.'] : []),
      ...(r.charge > 0 ? ['For a positive ion, remove electrons from the highest shell first.'] : []),
      'For the short form, replace the inner part with the last noble gas before it.',
    ],
    vocab: [
      { term: 'subshell', meaning: 'a group of orbitals like 3d; the number is the shell (n), the letter is the shape' },
      { term: 'superscript', meaning: 'how many electrons are in that subshell' },
      { term: 'noble-gas core', meaning: '[Ne], [Ar]… stands for all of that noble gas’s electrons' },
    ],
    watch: ['4s fills before 3d, and 6s before 4f.', 'Cations lose s electrons before d electrons (Fe²⁺ is [Ar] 3d⁶).', 'Chromium and copper break the pattern.'],
    check: `Add the superscripts: ${r.config.map((s) => s.e).join(' + ')} = ${r.electrons}, the electron count.`,
    khan: KHAN.electrons,
  };
}
