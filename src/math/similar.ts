import { genSlope, genStandard, rng, type ChallengeTopic } from './challenge';
import { TOPICS } from './challengeTopics';
import type { ProblemType } from './detect';

/**
 * "Another one like this": a fresh problem of the same kind, for practising
 * the method again right after a lesson. Built from the practice generators,
 * so every one is solvable.
 */
type Inputs = Record<string, string>;

const AREA_EMPTY: Inputs = { shape: 'rectangle', unit: '', l: '', w: '', s: '', b: '', h: '', s1: '', s2: '', b1: '', b2: '', r: '', d: '' };

const DECAYS: Record<string, [string, string][]> = {
  alpha: [['U', '238'], ['Ra', '226'], ['Po', '210'], ['Th', '232'], ['Am', '241'], ['Rn', '222'], ['Pu', '239'], ['Po', '218']],
  beta: [['C', '14'], ['I', '131'], ['Sr', '90'], ['Co', '60'], ['Cs', '137'], ['H', '3'], ['P', '32'], ['Th', '234']],
  positron: [['Na', '22'], ['F', '18'], ['C', '11'], ['O', '15'], ['N', '13'], ['Cu', '64'], ['Ne', '19'], ['Mg', '23']],
};

// Everyday homework atoms and ions (no exceptions, so "another like this" practises the plain method).
const ATOMS = ['N', 'O', 'F', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Mn', 'Fe', 'Co', 'Ni', 'Zn', 'Ga', 'As', 'Se', 'Br', 'Rb', 'Sr', 'Zr', 'Sn', 'I', 'Ba'];
const IONS: [string, string][] = [['Na', '1+'], ['Mg', '2+'], ['Al', '3+'], ['K', '1+'], ['Ca', '2+'], ['O', '2-'], ['F', '1-'], ['Cl', '1-'], ['S', '2-'], ['N', '3-'], ['Br', '1-'], ['Fe', '2+'], ['Fe', '3+'], ['Co', '2+'], ['Ni', '2+'], ['Zn', '2+'], ['Mn', '2+'], ['Sn', '2+']];

/** Which practice topic a tool's problems belong to. */
export const PRACTICE_TOPIC: Partial<Record<ProblemType, ChallengeTopic>> = {
  standardToSlope: 'standard',
  slopeFromPoints: 'slope',
  pointSlope: 'pointSlope',
  systems: 'systems',
  quadratic: 'quadratic',
  factoring: 'factoring',
  pythag: 'pythag',
  area: 'area',
  trig: 'trig',
  stats: 'stats',
  sequences: 'sequences',
};

export function similarProblem(type: ProblemType, current: Inputs, seed = Math.floor(Math.random() * 1e9)): Inputs | null {
  const r = rng(seed);
  /** Generate until the problem has the same shape as the current one. */
  const until = <T,>(make: () => T, ok: (t: T) => boolean): T => {
    let t = make();
    for (let i = 0; i < 60 && !ok(t); i++) t = make();
    return t;
  };
  const differs = (next: Inputs) => Object.keys(next).some((k) => (next[k] ?? '') !== (current[k] ?? ''));
  const fresh = (make: () => Inputs) => until(make, differs);

  switch (type) {
    case 'slopeFromPoints':
      return fresh(() => {
        const p = genSlope(r, 'regular', 's') as { x1: string; y1: string; x2: string; y2: string };
        return { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 };
      });
    case 'standardToSlope':
      return fresh(() => ({ eq: (genStandard(r, 'regular', 's') as { equation: string }).equation }));
    case 'pointSlope':
      if (current.mode === 'points') {
        return fresh(() => {
          const p = genSlope(r, 'regular', 's') as { x1: string; y1: string; x2: string; y2: string };
          return { mode: 'points', x1: p.x1, y1: p.y1, m: '', x2: p.x2, y2: p.y2 };
        });
      }
      return fresh(() => ({ mode: 'slope', ...TOPICS.pointSlope.generate(r, 'regular'), x2: '', y2: '' }));
    case 'systems':
      return fresh(() => TOPICS.systems.generate(r, 'regular'));
    case 'quadratic':
      return fresh(() => TOPICS.quadratic.generate(r, 'regular'));
    case 'factoring':
      return fresh(() => TOPICS.factoring.generate(r, 'regular'));
    case 'pythag':
      return fresh(() => TOPICS.pythag.generate(r, r() < 0.5 ? 'gentle' : 'regular'));
    case 'area': {
      const shape = current.shape || 'rectangle';
      const spec = until(
        () => TOPICS.area.generate(r, shape === 'circle' ? 'spicy' : ['triangle', 'parallelogram', 'trapezoid'].includes(shape) ? 'regular' : 'gentle'),
        (s) => s.shape === shape,
      );
      return { ...AREA_EMPTY, ...spec, unit: current.unit || spec.unit };
    }
    case 'trig': {
      const byAngle = !!(current.angle ?? '').trim();
      const spec = until(
        () => TOPICS.trig.generate(r, byAngle ? 'regular' : 'spicy'),
        (s) => (byAngle ? !!s.angle : s.want === 'A'),
      );
      return { angle: spec.angle ?? '', opp: spec.opp ?? '', adj: spec.adj ?? '', hyp: spec.hyp ?? '' };
    }
    case 'stats':
      return fresh(() => TOPICS.stats.generate(r, 'regular'));
    case 'sequences': {
      const withN = !!(current.n ?? '').trim();
      return fresh(() => {
        const s = TOPICS.sequences.generate(r, withN ? 'spicy' : 'regular');
        return { terms: s.terms, n: withN ? s.n || String(8 + Math.floor(r() * 10)) : '' };
      });
    }
    case 'electronConfig': {
      const form = current.form || 'long';
      const ion = !!(current.charge ?? '').trim();
      return fresh(() => {
        if (ion) {
          const [el, charge] = IONS[Math.floor(r() * IONS.length)];
          return { el, charge, form };
        }
        return { el: ATOMS[Math.floor(r() * ATOMS.length)], charge: '', form };
      });
    }
    case 'nuclearDecay': {
      const kind = current.type || 'alpha';
      const list = DECAYS[kind] ?? DECAYS.alpha;
      return fresh(() => {
        const [el, a] = list[Math.floor(r() * list.length)];
        return { el, a, type: kind };
      });
    }
  }
}
