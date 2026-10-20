import { parseLinearEquation } from './linear';
import { parseDecayType, parseNuclide } from '../science/decay';
import { readElectronProblem } from '../science/electrons';
import { degree, parsePoly } from './poly';
import { parseNumberList } from './surd';
import { solveSequence } from './sequences';

export type ProblemType =
  | 'nuclearDecay'
  | 'electronConfig'
  | 'standardToSlope'
  | 'slopeFromPoints'
  | 'pointSlope'
  | 'systems'
  | 'quadratic'
  | 'factoring'
  | 'pythag'
  | 'area'
  | 'trig'
  | 'stats'
  | 'sequences';

export interface DetectedProblem {
  type: ProblemType;
  inputs: Record<string, string>;
}

const NUM = /-?\d*\.?\d+(?:\/\d+)?/g;
const nums = (s: string) => s.replace(/[−–]/g, '-').match(NUM) ?? [];

/** Pulls four numbers out of text such as "(2, 3) and (4, 7)" or "slope through 1,2 3,-4". */
export function extractPoints(text: string): { x1: string; y1: string; x2: string; y2: string } | null {
  const n = nums(text);
  if (n.length !== 4) return null;
  return { x1: n[0], y1: n[1], x2: n[2], y2: n[3] };
}

/** The first number after a label like "radius", "base =", "hypotenuse of". */
function after(text: string, label: RegExp): string {
  const m = new RegExp(`${label.source}\\w*\\s*(?:is|of|=|:)?\\s*(-?\\d*\\.?\\d+(?:/\\d+)?)`, 'i').exec(text.replace(/[−–]/g, '-'));
  return m?.[1] ?? '';
}

/** Two equations side by side: "2x + 3y = 12, x − y = 1" or "y = 2x and y = −x + 3". */
function splitSystem(t: string): [string, string] | null {
  const parts = t.split(/\s*(?:[;\n]|,(?![^(]*\))|\band\b)\s*/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2 || !parts.every((p) => p.includes('='))) return null;
  if (!parts.every((p) => parseLinearEquation(p).ok)) return null;
  return [parts[0], parts[1]];
}

function detectArea(t: string): Record<string, string> | null {
  const s = t.toLowerCase();
  const shape = /circle|radius|diameter/.test(s)
    ? 'circle'
    : /trapez/.test(s)
      ? 'trapezoid'
      : /parallelogram/.test(s)
        ? 'parallelogram'
        : /triangle/.test(s)
          ? 'triangle'
          : /square/.test(s) && !/rectangle/.test(s)
            ? 'square'
            : /rectangle|length|width|\d\s*(by|x|×)\s*\d/.test(s)
              ? 'rectangle'
              : null;
  if (!shape) return null;
  const unit = /\b(mm|cm|km|in|ft|yd|mi|m)\b|inch|feet|foot|meter|metre|yard|mile/.exec(s)?.[0] ?? '';
  const unitMap: Record<string, string> = { inch: 'in', feet: 'ft', foot: 'ft', meter: 'm', metre: 'm', yard: 'yd', mile: 'mi' };
  const out: Record<string, string> = { shape, unit: unitMap[unit] ?? unit };
  const n = nums(t);
  if (shape === 'circle') {
    out.r = after(t, /radius/);
    out.d = out.r ? '' : after(t, /diameter/) || '';
    if (!out.r && !out.d && n[0]) out.r = n[0];
  } else if (shape === 'square') out.s = after(t, /side/) || n[0] || '';
  else if (shape === 'rectangle') {
    out.l = after(t, /length/) || n[0] || '';
    out.w = after(t, /width/) || n[1] || '';
  } else if (shape === 'triangle' || shape === 'parallelogram') {
    out.b = after(t, /base/) || n[0] || '';
    out.h = after(t, /height/) || n[1] || '';
  } else {
    out.b1 = n[0] ?? '';
    out.b2 = n[1] ?? '';
    out.h = after(t, /height/) || n[2] || '';
  }
  return out;
}

function detectTrig(t: string): Record<string, string> | null {
  const s = t.toLowerCase();
  if (!/\b(sin|cos|tan|soh|cah|toa|trig)\b|°|degree|angle|opposite|adjacent/.test(s)) return null;
  const angle = /(\d+(?:\.\d+)?)\s*(°|deg)/.exec(s)?.[1] ?? after(s, /angle/);
  const out = { angle, opp: after(s, /opp/), adj: after(s, /adj/), hyp: after(s, /hyp/) };
  return Object.values(out).filter(Boolean).length >= 2 ? out : null;
}

function detectPythag(t: string): Record<string, string> | null {
  const s = t.toLowerCase();
  // "Area of a right triangle with legs 6 and 8" is the area tool's.
  if (!/pythag|hypotenuse|\blegs?\b|right triangle/.test(s) || /\b(area|perimeter)\b/.test(s)) return null;
  const c = after(s, /hyp/);
  const rest = nums(s.replace(/hyp\w*\s*(?:is|of|=|:)?\s*-?\d*\.?\d+(?:\/\d+)?/, ' '));
  const a = after(s, /\ba\s*=/) || rest[0] || '';
  const b = after(s, /\bb\s*=/) || (c ? '' : rest[1] ?? '');
  if ([a, b, c].filter(Boolean).length < 2) return null;
  return { a, b, c };
}

/**
 * Right triangles named by their corners: "In triangle EFD, right angle at F,
 * EF = 12, ∠E = 42°. Find DF." The corners say which side is which: the side
 * joining the right angle to the angle in question is adjacent, the other side
 * touching the right angle is opposite, and the side away from it is the
 * hypotenuse. With no angle given or asked for, it's sides only (Pythagoras).
 */
function detectLabeledRightTriangle(t: string): DetectedProblem | null {
  const s = t.replace(/[−–]/g, '-').replace(/º/g, '°');
  if (/\b(area|perimeter)\b/i.test(s)) return null;
  // ∠F, angle F, m∠F; a three-letter name like ∠DEF means the middle corner.
  const ANGLE = String.raw`(?:m\s*)?(?:∠|[Aa]ngle\s+)\s*([A-Z]{3}|[A-Z])\b`;
  const vertex = (name: string) => (name.length === 3 ? name[1] : name);
  const right =
    /[Rr]ight\s+angle\s+(?:(?:at|is)\s+)?(?:∠\s*|[Aa]ngle\s+)?([A-Z])\b/.exec(s)?.[1] ??
    /(?:∠\s*)?\b([A-Z])\s+is\s+(?:a\s+)?right\s+angle/.exec(s)?.[1] ??
    [...s.matchAll(new RegExp(`${ANGLE}\\s*(?:=|is)\\s*90\\b`, 'g'))].map((m) => vertex(m[1]))[0];
  if (!right) return null;

  const sides = [...s.matchAll(/\b([A-Z])([A-Z])\s*(?:=|is)\s*(\d*\.?\d+(?:\/\d+)?)/g)].map((m) => ({ ends: [m[1], m[2]], value: m[3] }));
  if (!sides.length) return null;
  const given = [...s.matchAll(new RegExp(`${ANGLE}\\s*(?:=|is|measures)\\s*(\\d+(?:\\.\\d+)?)\\s*°?`, 'g'))]
    .map((m) => ({ at: vertex(m[1]), value: m[2] }))
    .find((a) => a.at !== right && a.value !== '90');
  const asked = new RegExp(String.raw`(?:[Ff]ind|[Ww]hat\s+is|[Cc]alculate|[Dd]etermine)\s+(?:the\s+)?(?:(?:measure|size)\s+of\s+)?${ANGLE}`).exec(s)?.[1];
  const angleAt = given?.at ?? (asked && vertex(asked) !== right ? vertex(asked) : undefined);

  if (angleAt) {
    const out: Record<string, string> = { angle: given?.value ?? '', opp: '', adj: '', hyp: '' };
    for (const side of sides) out[!side.ends.includes(right) ? 'hyp' : side.ends.includes(angleAt) ? 'adj' : 'opp'] = side.value;
    return Object.values(out).filter(Boolean).length >= 2 ? { type: 'trig', inputs: out } : null;
  }
  const legs = sides.filter((x) => x.ends.includes(right));
  const out = { a: legs[0]?.value ?? '', b: legs[1]?.value ?? '', c: sides.find((x) => !x.ends.includes(right))?.value ?? '' };
  return Object.values(out).filter(Boolean).length >= 2 ? { type: 'pythag', inputs: out } : null;
}

function detectPointSlope(t: string): Record<string, string> | null {
  const s = t.toLowerCase().replace(/[−–]/g, '-');
  // "Point-slope", or the equation of a line through two points (just its slope is slopeFromPoints).
  const named = /point[\s-]*slope|\bequation\b/.test(s);
  const slope = /(?:slope|\bm)\s*(?:is|of|=|:)?\s*(-?\d*\.?\d+(?:\/\d+)?|undefined)/.exec(s);
  const pts = [...s.matchAll(/\(\s*(-?\d*\.?\d+(?:\/\d+)?)\s*,\s*(-?\d*\.?\d+(?:\/\d+)?)\s*\)/g)];
  if (slope && pts.length === 1) return { mode: 'slope', x1: pts[0][1], y1: pts[0][2], m: slope[1], x2: '', y2: '' };
  if (named && pts.length === 2) return { mode: 'points', x1: pts[0][1], y1: pts[0][2], m: '', x2: pts[1][1], y2: pts[1][2] };
  return null;
}

/**
 * Works out which tool a typed problem belongs to, so students can just type
 * it without choosing a tool first. Returns null when it's genuinely unclear.
 */
export function detectProblem(text: string): DetectedProblem | null {
  const t = text.trim();
  if (!t) return null;
  const s = t.toLowerCase();

  // "electron configuration of Fe3+", "Cl noble gas notation", "orbital notation for sulfur"
  if (/electron(ic)?\s+config|\be(lectron)?\.?\s*config\b|orbital (diagram|notation)|noble[- ]gas (notation|configuration|shorthand)/.test(s)) {
    const e = readElectronProblem(t);
    if (e) return { type: 'electronConfig', inputs: e };
  }

  // "Po-210 alpha decay", "beta decay of C-14", "Na-22 positron emission"
  const decay = parseDecayType(t);
  if (decay) {
    const n = parseNuclide(t.replace(/→.*$/, ''));
    if (n.el && n.a) return { type: 'nuclearDecay', inputs: { el: n.el.symbol, a: String(n.a), type: decay } };
  }

  // Lists: statistics by keyword, sequences by keyword or a trailing "…".
  if (/\b(mean|median|mode|average)\b/.test(s)) {
    const l = parseNumberList(t.replace(/^[^\d−-]*/, '').replace(/[a-z]+/gi, ' '));
    if (l.ok && l.values.length >= 2) return { type: 'stats', inputs: { list: l.values.map(String).join(', ') } };
  }
  const nth = /(\d+)(?:st|nd|rd|th)\s+term|term\s+(?:number\s+)?(\d+)|\bn\s*=\s*(\d+)|\ba_?(\d+)\b/.exec(s);
  if (/sequence|series|next term|nth term|common (difference|ratio)|\d+(st|nd|rd|th)\s+term/.test(s) || /(\.\.\.|…)/.test(t)) {
    const body = t.replace(nth?.[0] ?? '\u0000', ' ').replace(/[a-z]+/gi, ' ');
    const l = parseNumberList(body);
    if (l.ok && l.values.length >= 3) return { type: 'sequences', inputs: { terms: l.values.map(String).join(', '), n: nth ? nth[1] ?? nth[2] ?? nth[3] ?? nth[4] : '' } };
  }

  const labeled = detectLabeledRightTriangle(t);
  if (labeled) return labeled;
  const ps = detectPointSlope(t);
  if (ps) return { type: 'pointSlope', inputs: ps };
  const trig = detectTrig(t);
  if (trig) return { type: 'trig', inputs: trig };
  const py = detectPythag(t);
  if (py) return { type: 'pythag', inputs: py };
  // Flat shapes only: a cylinder's volume or a sphere's surface area mentions a radius too.
  if (/\b(area|perimeter|circumference)\b|radius|diameter/.test(s) && !/\b(volume|surface area|cylinders?|cones?|spheres?|prisms?|pyramids?|cubes?|cuboids?)\b/.test(s)) {
    const a = detectArea(t);
    if (a) return { type: 'area', inputs: a };
  }

  const sys = splitSystem(t);
  if (sys) return { type: 'systems', inputs: { eq1: sys[0], eq2: sys[1] } };

  // Polynomials: "factor …" or a bare quadratic expression factors; an equation solves.
  const wantsFactor = /\bfactor/.test(s);
  const polySrc = t.replace(/\b(factor|factorise|factorize|completely|fully|solve|for x|roots?|zeros?|of|the|using|quadratic|formula)\b|:/gi, ' ').trim();
  const p = parsePoly(polySrc);
  if (p.ok && degree(p.value.poly) >= 2) {
    if (wantsFactor || !p.value.isEquation) return { type: 'factoring', inputs: { expr: polySrc } };
    if (degree(p.value.poly) === 2) return { type: 'quadratic', inputs: { eq: polySrc } };
  }

  if (t.includes('=')) {
    // "x1 = 2, y1 = 3, ..." is points, not an equation.
    if (/[xy]\s*[₁₂12]\s*=/.test(t)) {
      const pts = extractPoints(t.replace(/[xy]\s*[₁₂12]/g, ''));
      if (pts) return { type: 'slopeFromPoints', inputs: pts };
    }
    const lin = parseLinearEquation(t);
    return lin.ok ? { type: 'standardToSlope', inputs: { eq: t } } : null;
  }

  // A long list of plain numbers: a sequence if it follows a pattern, otherwise statistics.
  const list = parseNumberList(t);
  if (list.ok && list.values.length >= 5 && !/[()]/.test(t)) {
    const seq = solveSequence(t, '');
    return seq.kind === 'error' ? { type: 'stats', inputs: { list: t } } : { type: 'sequences', inputs: { terms: t, n: '' } };
  }
  const pts = extractPoints(t);
  return pts ? { type: 'slopeFromPoints', inputs: pts } : null;
}
