import type { LessonDecision } from '../math/lessons';
import { elementByZ } from './elements';
import { DECAY, nuc, nucOf, particleOf, type DecayResult } from './decay';
import { calcFloat } from '../math/calcExpr';

/** Lesson mode for nuclear decay: one decision at a time, with targeted feedback. */
export function buildDecayLesson(r: Extract<DecayResult, { kind: 'ok' }>): LessonDecision[] {
  const { type, parent, daughter } = r;
  const p = DECAY[type].particle;
  const int = (raw: string) => (/^\s*[−-]?\d+\s*$/.test(raw) ? Number(raw.replace('−', '-')) : NaN);

  // Neighbours for the "which element" choice, in a stable order.
  const options = [daughter.z - 1, daughter.z, daughter.z + 1, parent.z]
    .filter((z, i, arr) => z >= 1 && arr.indexOf(z) === i)
    .map((z) => elementByZ(z)!)
    .filter(Boolean)
    .sort((a, b) => a.z - b.z)
    .map((e) => ({ id: e.symbol, label: `${e.symbol}, ${e.name.toLowerCase()} (Z = ${e.z})` }));

  return [
    {
      id: 'particle',
      teach: 'An unstable nucleus settles down by throwing out a particle. **Alpha**: a helium-4 nucleus (2 protons, 2 neutrons). **Beta**: an electron, made when a neutron turns into a proton. **Positron**: a positive electron, made when a proton turns into a neutron.',
      why: type === 'alpha' ? 'Alpha decay gives off ⁴₂He: mass number 4, atomic number 2.' : type === 'beta' ? 'Beta decay gives off ⁰₋₁e: mass number 0 and a charge of −1.' : 'A positron is ⁰₊₁e: mass number 0 and a charge of +1.',
      answer: type,
      prompt: `In **${DECAY[type].name.toLowerCase()}**, what leaves the nucleus?`,
      context: `${nucOf(parent)} → ? + ?`,
      input: {
        kind: 'choice',
        options: [
          { id: 'alpha', label: `$${nuc(4, 2, 'He')}$  an alpha particle` },
          { id: 'beta', label: `$${nuc(0, -1, 'e')}$  a beta particle (electron)` },
          { id: 'positron', label: `$${nuc(0, 1, 'e')}$  a positron` },
        ],
      },
      hints: [type === 'alpha' ? 'Alpha particles are helium nuclei.' : type === 'beta' ? 'Beta-minus means an electron comes out.' : 'A positron is the electron’s positive twin.'],
      after: `${nucOf(parent)} → ? + ${particleOf(type)}`,
      check: (id) =>
        id === type
          ? { ok: true }
          : {
              ok: false,
              feedback:
                type === 'alpha'
                  ? 'Alpha decay is the big one: a whole helium nucleus, 2 protons and 2 neutrons.'
                  : type === 'beta'
                    ? 'Beta (minus) decay sends out an electron, with a −1 on the bottom.'
                    : 'Positron emission sends out the positive version of an electron, with a +1 on the bottom.',
            },
    },
    {
      id: 'mass',
      teach: 'A nuclear equation balances like a scale. The **mass numbers** (the top numbers) count protons + neutrons, and the total on the left has to equal the total on the right.',
      why: `${parent.a} = ${daughter.a} + ${p.a}, so the new nucleus has mass number ${daughter.a}.`,
      answer: String(daughter.a),
      prompt: 'Mass numbers on top have to add up. What is the new mass number?',
      context: `${parent.a} = A + ${p.a}`,
      input: { kind: 'number', label: 'A' },
      helper: 'calculator',
      calc: `${parent.a} − ${p.a}`,
      hints: [`Subtract what the ${type === 'alpha' ? 'alpha particle' : 'particle'} carries away: ${parent.a} − ${p.a}.`],
      after: `A = ${daughter.a}`,
      check: (raw) => {
        const v = int(raw);
        if (Number.isNaN(v)) return { ok: false, feedback: 'Mass numbers are whole numbers.' };
        if (v === daughter.a) return { ok: true };
        if (v === parent.a + p.a) return { ok: false, feedback: 'The particle leaves, so its mass comes off. Subtract instead.' };
        if (p.a === 0 && v !== parent.a) return { ok: false, feedback: 'An electron or positron has mass number 0, so the top number doesn’t change.' };
        if (v === parent.a - 2) return { ok: false, feedback: 'That subtracted the 2 from the bottom. An alpha takes 4 off the top.' };
        return { ok: false, feedback: `Top numbers: ${parent.a} on the left, so A + ${p.a} has to equal ${parent.a}.` };
      },
    },
    {
      id: 'atomic',
      teach: 'The **atomic numbers** (the bottom numbers) count protons, which is the charge. They have to balance too.',
      why: `${parent.z} = ${daughter.z} + ${p.z < 0 ? `(${p.z})` : p.z}. ${type === 'beta' ? 'A neutron became a proton, so the atomic number went up by 1.' : type === 'alpha' ? 'Two protons left in the alpha particle, so it went down by 2.' : 'A proton became a neutron, so it went down by 1.'}`,
      answer: String(daughter.z),
      prompt: 'Atomic numbers on the bottom have to add up too. What is the new atomic number?',
      context: `${parent.z} = Z + ${p.z < 0 ? `(${p.z})` : p.z}`,
      input: { kind: 'number', label: 'Z' },
      helper: 'calculator',
      calc: `${parent.z} − ${calcFloat(p.z)}`,
      hints: [
        type === 'beta' ? 'Subtracting −1 is the same as adding 1. A neutron became a proton.' : `Take ${p.z} off ${parent.z}.`,
      ],
      after: `Z = ${daughter.z}`,
      check: (raw) => {
        const v = int(raw);
        if (Number.isNaN(v)) return { ok: false, feedback: 'Atomic numbers are whole numbers.' };
        if (v === daughter.z) return { ok: true };
        if (type === 'beta' && v === parent.z - 1) return { ok: false, feedback: 'Careful with the −1: Z + (−1) = ' + parent.z + ' means Z is one more, not one less.' };
        if (type === 'positron' && v === parent.z + 1) return { ok: false, feedback: 'The positron carries +1 away, so Z goes down by one.' };
        if (v === parent.z) return { ok: false, feedback: 'The bottom number changes in this decay. That’s the whole point: it becomes a new element.' };
        return { ok: false, feedback: `Bottom numbers: Z + ${p.z < 0 ? `(${p.z})` : p.z} has to equal ${parent.z}.` };
      },
    },
    {
      id: 'element',
      teach: `The atomic number is an element’s ID: change it and you have a different element. Find ${daughter.z} on the periodic table.`,
      why: `Atomic number ${daughter.z} is ${daughter.el.name.toLowerCase()} (${daughter.el.symbol}).`,
      answer: daughter.el.symbol,
      prompt: `Which element has atomic number **${daughter.z}**?`,
      input: { kind: 'choice', options },
      helper: undefined,
      hints: ['The atomic number is the element’s ID. Check the periodic table if you need to.'],
      after: `${nucOf(parent)} → ${nucOf(daughter)} + ${particleOf(type)}`,
      check: (id) =>
        id === daughter.el.symbol
          ? { ok: true, feedback: `Yes: ${daughter.el.name.toLowerCase()}-${daughter.a}.` }
          : id === parent.el.symbol
            ? { ok: false, feedback: 'The element changes when the atomic number changes.' }
            : { ok: false, feedback: `So close. That one is atomic number ${findZ(id)}; we need ${daughter.z}.` },
    },
  ];
}

function findZ(symbol: string): number {
  for (let z = 1; z <= 118; z++) if (elementByZ(z)?.symbol === symbol) return z;
  return 0;
}
