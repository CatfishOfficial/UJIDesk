import { describe, expect, it } from 'vitest';
import { RECOGNIZABLE_TOOLS, checkGuess, handPickedInputs, locateUncertain } from './recognitionSchema';
import { TOOLS } from './tools';
import { SHAPES, UNITS } from '../math/geometry';
import { DECAY } from '../science/decay';
import { detectProblem } from '../math/detect';

const tool = (type: string) => RECOGNIZABLE_TOOLS.find((t) => t.type === type)!;

describe('the photo reader’s field guide', () => {
  it('describes exactly the fields each tool has, no more and no fewer', () => {
    for (const t of RECOGNIZABLE_TOOLS) {
      expect(Object.keys(t.spec).sort(), t.type).toEqual([...t.fields].sort());
      expect(t.fields.length, t.type).toBeGreaterThan(0);
      expect(t.when.length, `${t.type} says when to pick it`).toBeGreaterThan(20);
    }
  });

  it('offers exactly the choices the tools accept', () => {
    expect(tool('area').spec.shape.options).toEqual(SHAPES.map((s) => s.id));
    expect(tool('area').spec.unit.options).toEqual([...UNITS]);
    expect(tool('nuclearDecay').spec.type.options).toEqual(Object.keys(DECAY));
    expect(tool('pointSlope').spec.mode.options).toEqual(['slope', 'points']);
  });

  it('starts each tool on one of its own choices (or blank)', () => {
    for (const t of RECOGNIZABLE_TOOLS) {
      const start = (TOOLS[t.type].initialData() as { inputs: Record<string, string> }).inputs;
      for (const f of t.fields) {
        const options = t.spec[f].options;
        if (options && start[f]) expect(options, `${t.type}.${f}`).toContain(start[f]);
      }
    }
  });

  it('gives the model examples that the typed-problem router sends to the same tool', () => {
    for (const t of RECOGNIZABLE_TOOLS) expect(detectProblem(t.example)?.type, t.example).toBe(t.type);
  });
});

describe('checkGuess', () => {
  it('passes a good guess through with every field present', () => {
    expect(checkGuess('slopeFromPoints', { x1: '2', y1: '3', x2: '4', y2: '7' })).toEqual({ type: 'slopeFromPoints', inputs: { x1: '2', y1: '3', x2: '4', y2: '7' } });
    expect(checkGuess('area', { shape: 'circle', unit: 'cm', r: '5' })?.inputs).toMatchObject({ shape: 'circle', unit: 'cm', r: '5', l: '', b1: '' });
  });

  it('drops invented fields, trims, and treats non-strings as blank', () => {
    expect(checkGuess('pythag', { a: ' 3 ', b: 4, c: '', z: '9' })).toEqual({ type: 'pythag', inputs: { a: '3', b: '', c: '' } });
  });

  it('refuses unknown tools, impossible choices and missing choices', () => {
    expect(checkGuess('calculator', { expr: '2+2' })).toBeNull();
    expect(checkGuess('notATool', { eq: 'x = 1' })).toBeNull();
    expect(checkGuess('area', { shape: 'rhombus', s: '4' })).toBeNull();
    expect(checkGuess('area', { s: '4' })).toBeNull();
    expect(checkGuess('nuclearDecay', { el: 'Po', a: '210', type: 'gamma' })).toBeNull();
    expect(checkGuess('pointSlope', { x1: '1', y1: '2', m: '3' })).toBeNull();
  });

  it('refuses a guess with nothing to solve', () => {
    expect(checkGuess('area', { shape: 'circle', unit: 'cm' })).toBeNull();
    expect(checkGuess('stats', { list: '   ' })).toBeNull();
    expect(checkGuess('stats', null)).toBeNull();
  });
});

describe('handPickedInputs', () => {
  it('puts the text in a tool’s one text box, and opens anything else blank', () => {
    expect(handPickedInputs('standardToSlope', 'y = 2x + 1')).toEqual({ eq: 'y = 2x + 1' });
    expect(handPickedInputs('stats', '1, 2, 3')).toEqual({ list: '1, 2, 3' });
    expect(handPickedInputs('trig', 'In triangle EFD…')).toEqual({ angle: '', opp: '', adj: '', hyp: '' });
    expect(handPickedInputs('area', 'a shape')).toMatchObject({ shape: 'rectangle', l: '', r: '' });
  });
});

describe('locateUncertain', () => {
  it('finds each quoted bit in the reading', () => {
    expect(locateUncertain('x^2 - 5x + 6 = 0', [{ snippet: '5x', note: 'could be Sx' }])).toEqual([{ start: 6, end: 8, note: 'could be Sx' }]);
  });

  it('lands a repeated bit on the next occurrence', () => {
    const spans = locateUncertain('3x + 3y = 3', [
      { snippet: '3', note: 'first' },
      { snippet: '3', note: 'second' },
    ]);
    expect(spans.map((s) => s.start)).toEqual([0, 5]);
  });

  it('still finds bits listed out of order, and drops ones that aren’t there', () => {
    const spans = locateUncertain('ab', [
      { snippet: 'b', note: '' },
      { snippet: 'a', note: '' },
      { snippet: 'q', note: '' },
      { snippet: '', note: '' },
    ]);
    expect(spans.map((s) => [s.start, s.end])).toEqual([
      [1, 2],
      [0, 1],
    ]);
  });
});
