import { describe, expect, it } from 'vitest';
import { findElement } from './elements';
import { parseCharge, parseSpecies, readElectronProblem, solveElectrons } from './electrons';
import { buildElectronLesson } from './electronLesson';
import { detectProblem } from '../math/detect';
import { similarProblem } from '../math/similar';

const solve = (sym: string, charge = 0) => {
  const r = solveElectrons(findElement(sym)!, charge);
  if (r.kind !== 'ok') throw new Error(r.message);
  return r;
};

describe('electron configurations', () => {
  it('writes long and short forms for neutral atoms', () => {
    expect(solve('H').long).toBe('1s1');
    expect(solve('H').short).toBe('1s1');
    expect(solve('O').long).toBe('1s2 2s2 2p4');
    expect(solve('O').short).toBe('[He] 2s2 2p4');
    expect(solve('Fe').long).toBe('1s2 2s2 2p6 3s2 3p6 4s2 3d6');
    expect(solve('Fe').short).toBe('[Ar] 4s2 3d6');
    expect(solve('Fe').byShell).toBe('1s2 2s2 2p6 3s2 3p6 3d6 4s2');
    expect(solve('Pb').short).toBe('[Xe] 6s2 4f14 5d10 6p2');
  });

  it('agrees with the periodic table for every element', async () => {
    const { electronConfig } = await import('./elements');
    for (let z = 1; z <= 118; z++) {
      const r = solveElectrons(findElement(String(z))!, 0);
      expect(r.kind === 'ok' && r.short, `Z = ${z}`).toBe(electronConfig(z));
    }
  });

  it('knows the exceptions', () => {
    const cr = solve('Cr');
    expect(cr.short).toBe('[Ar] 4s1 3d5');
    expect(cr.exception?.from.map((s) => `${s.n}${s.l}${s.e}`).slice(-2)).toEqual(['4s2', '3d4']);
    expect(solve('Cu').short).toBe('[Ar] 4s1 3d10');
    expect(solve('Pd').short).toBe('[Kr] 4d10');
  });

  it('removes cation electrons from the highest shell first', () => {
    expect(solve('Fe', 2).short).toBe('[Ar] 3d6');
    expect(solve('Fe', 3).short).toBe('[Ar] 3d5');
    expect(solve('Cu', 1).short).toBe('[Ar] 3d10');
    expect(solve('Cu', 2).short).toBe('[Ar] 3d9');
    expect(solve('Sn', 2).short).toBe('[Kr] 5s2 4d10');
    expect(solve('Na', 1).long).toBe('1s2 2s2 2p6');
    expect(solve('Na', 1).isoelectronic?.symbol).toBe('Ne');
    expect(solve('Fe', 3).removed.map((s) => `${s.n}${s.l}${s.e}`)).toEqual(['4s2', '3d1']);
  });

  it('fills anions on up', () => {
    expect(solve('O', -2).long).toBe('1s2 2s2 2p6');
    expect(solve('Cl', -1).short).toBe('[Ne] 3s2 3p6');
    expect(solve('Cl', -1).isoelectronic?.symbol).toBe('Ar');
  });

  it('counts unpaired and outer-shell electrons', () => {
    expect(solve('O').unpaired).toBe(2);
    expect(solve('N').unpaired).toBe(3);
    expect(solve('Fe').unpaired).toBe(4);
    expect(solve('Cr').unpaired).toBe(6);
    expect(solve('Fe').outer).toEqual({ n: 4, e: 2 });
  });

  it('refuses impossible ions', () => {
    expect(solveElectrons(findElement('H')!, 1).kind).toBe('error');
    expect(solveElectrons(findElement('Fe')!, 12).kind).toBe('error');
  });

  it('reads atoms and ions typed many ways', () => {
    expect(parseCharge('2+')).toBe(2);
    expect(parseCharge('+3')).toBe(3);
    expect(parseCharge('−2')).toBe(-2);
    expect(parseCharge('-')).toBe(-1);
    expect(parseCharge('')).toBe(0);
    expect(parseCharge('x')).toBeNull();
    const sp = (s: string) => {
      const r = parseSpecies(s);
      return [r.el?.symbol, r.charge];
    };
    expect(sp('Fe3+')).toEqual(['Fe', 3]);
    expect(sp('Fe^3+')).toEqual(['Fe', 3]);
    expect(sp('Fe³⁺')).toEqual(['Fe', 3]);
    expect(sp('Fe+3')).toEqual(['Fe', 3]);
    expect(sp('O2-')).toEqual(['O', -2]);
    expect(sp('Cl⁻')).toEqual(['Cl', -1]);
    expect(sp('iron(III)')).toEqual(['Fe', 3]);
    expect(sp('oxide')).toEqual(['O', -2]);
    expect(sp('26')).toEqual(['Fe', null]);
    expect(sp('sodium ion')).toEqual(['Na', null]);
  });

  it('reads whole problems and routes them from the backpack', () => {
    expect(readElectronProblem('Write the electron configuration of Fe3+')).toEqual({ el: 'Fe', charge: '3+', form: 'long' });
    expect(readElectronProblem('noble gas notation for chlorine')).toEqual({ el: 'Cl', charge: '', form: 'short' });
    expect(readElectronProblem('Can I get the electron configuration of iron')?.el).toBe('Fe');
    expect(detectProblem('electron configuration of Fe3+')).toEqual({ type: 'electronConfig', inputs: { el: 'Fe', charge: '3+', form: 'long' } });
    expect(detectProblem('Cu2+ electron configuration, shorthand')?.inputs).toEqual({ el: 'Cu', charge: '2+', form: 'short' });
    expect(detectProblem('orbital diagram for sulfur')?.type).toBe('electronConfig');
  });

  it('builds a lesson whose answers match the solution', () => {
    for (const [sym, q] of [['Fe', 0], ['Fe', 3], ['Cr', 0], ['O', -2], ['H', 0], ['Pb', 0]] as const) {
      const r = solve(sym, q);
      const lesson = buildElectronLesson(r);
      expect(lesson.length, sym).toBeGreaterThanOrEqual(3);
      for (const d of lesson) {
        expect(d.check(d.answer).ok, `${sym}${q} ${d.id}`).toBe(true);
        if (d.input.kind === 'choice') expect(d.input.options.map((o) => o.id), `${sym} ${d.id}`).toContain(d.answer);
      }
    }
    const fe3 = buildElectronLesson(solve('Fe', 3));
    expect(fe3.find((d) => d.id === 'remove')!.check('3d')).toMatchObject({ ok: false });
    expect(fe3.find((d) => d.id === 'count')!.check('29')).toMatchObject({ ok: false });
  });

  it('makes another problem of the same shape', () => {
    for (let seed = 1; seed < 20; seed++) {
      const atom = similarProblem('electronConfig', { el: 'Fe', charge: '', form: 'short' }, seed)!;
      expect(atom.charge).toBe('');
      expect(atom.form).toBe('short');
      const ion = similarProblem('electronConfig', { el: 'Fe', charge: '3+', form: 'long' }, seed)!;
      expect(ion.charge).not.toBe('');
    }
  });
});
