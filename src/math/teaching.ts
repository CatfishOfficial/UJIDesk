import type { KhanLink } from '../data/khan';
import { KHAN } from '../data/khan';
import { Rational } from './rational';
import { plainR, round } from './surd';
import type { PointsInput, SlopeResult } from './slopeFromPoints';
import type { StandardResult } from './standardToSlope';
import type { PointSlopeInput, PointSlopeResult } from './pointSlope';
import type { SystemResult } from './systems';
import type { QuadResult } from './quadratic';
import type { FactorResult } from './factoring';
import type { AreaResult, PythagResult, Shape } from './geometry';
import type { TrigResult } from './trig';
import type { StatsResult } from './stats';
import type { SeqResult } from './sequences';

/**
 * The teaching wrapped around a lesson, following the usual classroom arc:
 * say what we're doing and why (the goal and the big idea), name the words
 * that matter, show the plan, practise it together one decision at a time,
 * check the answer, then try one alone. Khan Academy links are there for
 * anyone who wants a video or more practice.
 */
export interface LessonGuide {
  /** What this lesson gets done, for this problem. */
  goal: string;
  /** The idea behind the method, in two or three sentences. Rich text. */
  idea: string;
  /** The method as reusable steps. */
  plan: string[];
  vocab?: { term: string; meaning: string }[];
  /** Common slip-ups, said up front. */
  watch?: string[];
  /** How to check the answer, for this problem. Rich text. */
  check: string;
  khan: KhanLink[];
}

const P = (r: Rational) => plainR(r);
const pt = (x: Rational, y: Rational) => `(${P(x)}, ${P(y)})`;
const move = (d: Rational, pos: string, neg: string) => (d.isZero() ? null : `${P(d.abs())} ${d.isNegative() ? neg : pos}`);

export function guideSlope(p: PointsInput, r: Extract<SlopeResult, { kind: 'slope' | 'vertical' }>): LessonGuide {
  const across = move(r.run, 'right', 'left');
  const up = move(r.rise, 'up', 'down');
  return {
    goal: `Find the slope of the line through ${pt(p.x1, p.y1)} and ${pt(p.x2, p.y2)}.`,
    idea: 'Slope measures how steep a line is: how far it goes **up or down** (the rise) for how far it goes **across** (the run). A straight line is equally steep everywhere, so any two of its points give the slope: $m = {y_2 - y_1/x_2 - x_1}$.',
    plan: ['Find the rise: subtract the y-coordinates.', 'Find the run: subtract the x-coordinates, in the same order.', 'Divide the rise by the run, and simplify.'],
    vocab: [
      { term: 'rise', meaning: 'the change in y (up is positive, down is negative)' },
      { term: 'run', meaning: 'the change in x (right is positive, left is negative)' },
      { term: 'slope m', meaning: 'rise ÷ run: how much y changes for each 1 step right' },
    ],
    watch: ['Subtract in the same order on the top and the bottom.', 'The rise (y) goes on top.', 'Subtracting a negative is the same as adding.'],
    check:
      r.kind === 'vertical'
        ? `Both points have x = ${P(p.x1)}, so the line goes straight up and down: there's no run to divide by.`
        : `Start at ${pt(p.x1, p.y1)}, go ${[across, up].filter(Boolean).join(' and ') || 'nowhere'}: you land on ${pt(p.x2, p.y2)}. The slope ${P(r.m)} is that rise over that run.`,
    khan: KHAN.slope,
  };
}

export function guideStandard(eq: string, r: Extract<StandardResult, { kind: 'slope' | 'vertical' }>): LessonGuide {
  return {
    goal: `Rewrite ${eq} as y = mx + b.`,
    idea: 'Slope-intercept form, $y = mx + b$, puts the two most useful facts about a line on display: its slope m and where it crosses the y-axis, b. To get there you **solve for y**, using opposite operations until y is alone. Whatever you do to one side, you do to the other, so the equation stays balanced.',
    plan: ['Line it up as Ax + By = C.', 'Move the x-term to the other side with the opposite operation.', 'Divide every term by the number on y.', 'Read off the slope m and the intercept b.'],
    vocab: [
      { term: 'standard form', meaning: 'Ax + By = C' },
      { term: 'slope-intercept form', meaning: 'y = mx + b' },
      { term: 'coefficient', meaning: 'the number multiplying a variable, sign included' },
    ],
    watch: ['A term that crosses the equals sign changes sign.', 'Divide every term, the constant too.', 'The sign in front of a term belongs to it.'],
    check:
      r.kind === 'vertical'
        ? `There's no y, so the line is vertical (x = ${P(r.xValue)}) and has no slope-intercept form.`
        : `Put x = 0 into the original equation: it gives y = ${P(r.b)}, which matches b. Then try x = 1: y should be ${P(r.m.add(r.b))} (that's m + b).`,
    khan: KHAN.standard,
  };
}

export function guidePointSlope(input: PointSlopeInput, r: Extract<PointSlopeResult, { kind: 'line' | 'vertical' }>): LessonGuide {
  const two = !!input.second;
  return {
    goal: two
      ? `Write the equation of the line through ${pt(input.x1, input.y1)} and ${pt(input.second!.x2, input.second!.y2)}.`
      : `Write the equation of the line through ${pt(input.x1, input.y1)} with slope ${input.m ? P(input.m) : 'undefined'}.`,
    idea: 'Point-slope form, $y - y_1 = m(x - x_1)$, is the slope formula rearranged. It says: how far y is from your point equals the slope times how far x is from your point. One point plus the slope is all you need to pin down a line.',
    plan: [
      ...(two ? ['Find the slope from the two points (rise over run).'] : []),
      'Put m, x₁ and y₁ into y − y₁ = m(x − x₁).',
      'Tidy the signs: minus a negative becomes plus.',
      'Optional: distribute m and solve for y to get y = mx + b.',
    ],
    vocab: [
      { term: 'point-slope form', meaning: 'y − y₁ = m(x − x₁)' },
      { term: '(x₁, y₁)', meaning: 'a point you know is on the line' },
    ],
    watch: ['The form subtracts the coordinates, so negative coordinates turn into plus signs.', 'x₁ goes with x, y₁ goes with y.'],
    check:
      r.kind === 'vertical'
        ? `Every point on x = ${P(input.x1)} has that x, including ${pt(input.x1, input.y1)}.`
        : `Put x = ${P(input.x1)} in: the right side becomes 0, so y = ${P(input.y1)}. The point is on the line.`,
    khan: KHAN.pointSlope,
  };
}

export function guideSystem(r: Extract<SystemResult, { method: string }>): LessonGuide {
  const sub = r.method === 'substitution';
  return {
    goal: 'Find the point (x, y) that makes both equations true.',
    idea: `Each equation is a line, and a **solution** is a point on both lines: where they cross. The strategy is to get rid of one variable, leaving one equation with one unknown. ${
      sub ? '**Substitution** does that by replacing a variable with what the other equation says it equals.' : '**Elimination** does that by adding or subtracting the equations so one variable cancels out.'
    }`,
    plan: sub
      ? ['Start with the equation that says what a variable equals.', 'Substitute that expression into the other equation.', 'Solve the one-variable equation.', 'Substitute back to find the other variable.', 'Check the point in both equations.']
      : ['Line both equations up as Ax + By = C.', 'Multiply so one variable has matching (or opposite) coefficients.', 'Add or subtract the equations to cancel it.', 'Solve for the variable that’s left.', 'Substitute back to find the other one.', 'Check the point in both equations.'],
    vocab: [
      { term: 'system', meaning: 'two (or more) equations that are true at the same time' },
      { term: 'solution', meaning: 'the (x, y) that makes every equation true' },
    ],
    watch: ['Multiply every term of an equation, the constant too.', 'Use parentheses when you substitute an expression.', 'If both variables vanish: something false (0 = 5) means no solution; something true (0 = 0) means infinitely many.'],
    check:
      r.kind === 'one'
        ? `Put x = ${P(r.x!)} and y = ${P(r.y!)} into both equations. Both come out true, and on a graph the lines cross at (${P(r.x!)}, ${P(r.y!)}).`
        : r.kind === 'none'
          ? 'Graph them: the lines are parallel (same slope, different intercepts), so they never cross.'
          : 'Simplify both equations: they turn into the same line, so every point on it works.',
    khan: sub ? KHAN.substitution : KHAN.elimination,
  };
}

export function guideQuadratic(eq: string, r: Extract<QuadResult, { kind: 'ok' }>): LessonGuide {
  return {
    goal: `Solve ${eq}.`,
    idea: 'The quadratic formula solves **any** equation of the form $ax^2 + bx + c = 0$: $x = {-b ± √{b^2 - 4ac}/2a}$. It comes from completing the square, so it works even when factoring doesn’t. The ± gives up to two answers: the places where the parabola crosses the x-axis.',
    plan: ['Get it into standard form: ax² + bx + c = 0.', 'Read off a, b and c, signs included.', 'Work out the discriminant, b² − 4ac.', 'Use its sign to say how many real solutions there are.', 'Finish the formula once with + and once with −, then simplify.'],
    vocab: [
      { term: 'discriminant', meaning: 'b² − 4ac, the part under the square root' },
      { term: 'root', meaning: 'a solution: an x that makes the expression 0' },
      { term: 'parabola', meaning: 'the U-shaped graph of a quadratic' },
    ],
    watch: ['b² is never negative, even when b is.', 'The 2a divides the whole top, −b included.', 'The formula starts with −b: flip the sign of b.'],
    check:
      r.D < 0n
        ? 'With a negative discriminant, a graph of the parabola never touches the x-axis: no real solutions.'
        : `Put each answer back into the equation (${r.decimals.map((x) => round(x, 3)).join(' and ')}): each one makes it 0. On a graph, those are where the parabola crosses the x-axis.`,
    khan: KHAN.quadratic,
  };
}

export function guideFactoring(expr: string, r: Extract<FactorResult, { v: string }>): LessonGuide {
  const monic = r.prim.length === 3 && r.prim[2] === 1n;
  return {
    goal: `Factor ${expr}.`,
    idea: 'Factoring is multiplying in reverse: writing an expression as a product of simpler pieces. For a trinomial $ax^2 + bx + c$ you’re looking for two binomials that multiply back to it, and the key is a pair of numbers that **multiply to a·c and add to b**.',
    plan: [
      'Take out the greatest common factor first.',
      monic ? 'Find two numbers that multiply to c and add to b.' : 'Multiply a·c, then find two numbers that multiply to it and add to b.',
      monic ? 'Write the brackets: (x + p)(x + q).' : 'Split the middle term with those numbers, group in pairs, and factor each pair.',
      'Check by multiplying back out.',
    ],
    vocab: [
      { term: 'GCF', meaning: 'greatest common factor: the biggest thing every term shares' },
      { term: 'trinomial', meaning: 'three terms, like ax² + bx + c' },
      { term: 'binomial', meaning: 'two terms, like (x + 3)' },
    ],
    watch: ['Always look for a common factor first.', 'Negative product: the two numbers have opposite signs.', 'Positive product with a negative sum: both numbers are negative.'],
    check:
      r.kind === 'prime'
        ? 'No pair of whole numbers works, so it stays as it is (it’s prime). The quadratic formula can still find its roots.'
        : `Multiply ${r.answerPlain} back out: you get ${expr} again.`,
    khan: KHAN.factoring,
  };
}

export function guidePythag(r: Extract<PythagResult, { kind: 'side' }>): LessonGuide {
  const leg = r.missing !== 'c';
  const val = round(r.decimal, 2);
  const known = (k: 'a' | 'b' | 'c') => P(r[k] as Rational);
  return {
    goal: leg ? `Find the missing leg of a right triangle with hypotenuse ${known('c')}.` : `Find the hypotenuse of a right triangle with legs ${known('a')} and ${known('b')}.`,
    idea: 'In every **right triangle**, the squares on the two legs add up to the square on the hypotenuse: $a^2 + b^2 = c^2$. Know any two sides and you can find the third. (It only works for right triangles.)',
    plan: leg ? ['Square the hypotenuse and the known leg.', 'Subtract: that’s the missing leg, squared.', 'Take the square root.'] : ['Square both legs.', 'Add them: that’s the hypotenuse, squared.', 'Take the square root.'],
    vocab: [
      { term: 'legs (a, b)', meaning: 'the two sides that make the right angle' },
      { term: 'hypotenuse (c)', meaning: 'the longest side, across from the right angle' },
    ],
    watch: ['c is always the hypotenuse.', 'Square first, then add or subtract.', 'Finding a leg means subtracting.'],
    check: leg ? `The leg (${val}) should be shorter than the hypotenuse (${known('c')}). It is.` : `The hypotenuse (${val}) should be longer than both legs. It is.`,
    khan: KHAN.pythag,
  };
}

const AREA_IDEA: Record<Shape, string> = {
  rectangle: '**Area** is the space inside a shape, counted in unit squares. A rectangle is rows of squares: length × width of them. **Perimeter** is the distance around the edge.',
  square: 'A square is a rectangle with equal sides, so its area is side × side, or side squared. **Perimeter** is the distance around: four equal sides.',
  triangle: 'Any triangle is exactly half of a parallelogram with the same base and height, so $A = {1/2}bh$. The height is measured straight up from the base, at a right angle, not along a slanted side.',
  parallelogram: 'Cut the slanted end off a parallelogram and slide it to the other side: it becomes a rectangle with the same base and height. So $A = bh$, using the straight-up height, not the slanted side.',
  trapezoid: 'A trapezoid works like a rectangle whose width is the **average** of its two parallel sides: $A = {1/2}(b_1 + b_2)h$. (Two copies of it make a parallelogram.)',
  circle: 'A circle’s area is $A = πr^2$, π times the radius squared. π (about 3.14159) is how many times the diameter fits around the circle, which is why the distance around is $C = 2πr$.',
};
const AREA_WATCH: Record<Shape, string> = {
  rectangle: 'Area multiplies; perimeter adds.',
  square: 'Area is side squared, not side × 4 (that’s the perimeter).',
  triangle: 'Don’t forget the ½.',
  parallelogram: 'Use the height, not the slanted side.',
  trapezoid: 'Add the two bases before you multiply.',
  circle: 'The radius is half the diameter. Area squares the radius; circumference doesn’t.',
};
const AREA_KHAN: Record<Shape, typeof KHAN.areaCircle> = {
  rectangle: KHAN.areaRectangle,
  square: KHAN.areaRectangle,
  triangle: KHAN.areaTriangle,
  parallelogram: KHAN.areaParallelogram,
  trapezoid: KHAN.areaTrapezoid,
  circle: KHAN.areaCircle,
};

export function guideArea(r: Extract<AreaResult, { kind: 'ok' }>): LessonGuide {
  const u = r.unit;
  const around = r.shape === 'circle' ? 'circumference' : 'perimeter';
  return {
    goal: `Find the area${r.perimeter ? ` and ${around}` : ''} of the ${r.shape}.`,
    idea: AREA_IDEA[r.shape],
    plan: ['Pick the area formula for the shape.', 'Substitute the measurements.', 'Calculate, and label the answer in square units.', ...(r.perimeter ? [`For the ${around}, measure all the way around the outside.`] : [])],
    vocab: [
      { term: 'area', meaning: `the space inside, in square units${u ? ` (${u}²)` : ''}` },
      { term: around, meaning: `the distance around the outside${u ? ` (${u})` : ''}` },
    ],
    watch: [AREA_WATCH[r.shape], 'Area is always in square units.'],
    check:
      r.shape === 'triangle'
        ? `A triangle is half the rectangle around it: ${P(r.dims.b)} × ${P(r.dims.h)} = ${P(r.dims.b.mul(r.dims.h))}, and half of that is ${P(r.area.c)}.`
        : r.shape === 'circle'
          ? `Estimate: a circle covers a bit more than 3 squares of side r. 3 × ${P(r.dims.r)}² = ${P(r.dims.r.mul(r.dims.r).mul(Rational.of(3)))}, close to ${round(r.area.c.toNumber() * Math.PI, 2)}.`
          : `Does it make sense? Area${u ? ` is in ${u}²` : ' is in square units'}${r.perimeter ? `, perimeter${u ? ` in ${u}` : ''}` : ''}, and the area should be roughly how many unit squares fit inside.`,
    khan: AREA_KHAN[r.shape],
  };
}

export function guideTrig(r: Extract<TrigResult, { kind: 'ok' }>): LessonGuide {
  const angle = r.given.angle;
  return {
    goal: angle ? `Find the missing sides of the right triangle with angle A = ${round(r.A, 1)}°.` : 'Find angle A and the third side of the right triangle.',
    idea: 'In a right triangle, the **ratios** between sides depend only on the angle. Sine, cosine and tangent are those ratios: $sin A = {opp/hyp}$, $cos A = {adj/hyp}$, $tan A = {opp/adj}$, remembered as **SOH CAH TOA**. With an angle and a side, a ratio gives another side; with two sides, an inverse function gives the angle.',
    plan: angle
      ? ['Name the sides from angle A: opposite, adjacent, hypotenuse.', 'Pick the ratio that uses the side you know and the side you want.', 'Set up the equation and solve it.', 'Repeat for the last side.']
      : ['Name the sides from angle A: opposite, adjacent, hypotenuse.', 'Pick the ratio that uses the two sides you know.', 'Use the inverse (sin⁻¹, cos⁻¹ or tan⁻¹) to get the angle.', 'Find the third side with the Pythagorean theorem.'],
    vocab: [
      { term: 'opposite', meaning: 'the side across from angle A' },
      { term: 'adjacent', meaning: 'the side next to angle A that isn’t the hypotenuse' },
      { term: 'hypotenuse', meaning: 'the longest side, across from the right angle' },
    ],
    watch: ['Opposite and adjacent depend on which angle you’re looking from.', 'Put the calculator in degree mode.', 'If the unknown is on the bottom of the ratio, you divide.'],
    check: `The sides should fit the Pythagorean theorem: ${round(r.sides.opp, 2)}² + ${round(r.sides.adj, 2)}² ≈ ${round(r.sides.opp ** 2 + r.sides.adj ** 2, 1)}, and ${round(r.sides.hyp, 2)}² ≈ ${round(r.sides.hyp ** 2, 1)}.`,
    khan: angle ? KHAN.trigSide : KHAN.trigAngle,
  };
}

export function guideStats(r: Extract<StatsResult, { kind: 'ok' }>): LessonGuide {
  return {
    goal: `Find the mean, median, mode and range of these ${r.n} numbers.`,
    idea: 'Mean, median and mode are three ways to describe the **center** of a data set: the fair share, the middle value, and the most common value. The range describes the **spread**. When a few values sit far from the rest (outliers), the median is often more typical than the mean.',
    plan: ['Mean: add them up and divide by how many there are.', 'Median: sort them and find the middle.', 'Mode: find the value that appears most often.', 'Range: biggest minus smallest.'],
    vocab: [
      { term: 'mean', meaning: 'the average: total ÷ count' },
      { term: 'median', meaning: 'the middle value once sorted' },
      { term: 'mode', meaning: 'the most common value' },
      { term: 'range', meaning: 'largest minus smallest' },
    ],
    watch: ['Sort before you find the median.', 'With an even count, average the two middle values.', 'Divide the total by the count.'],
    check: `The mean and median have to land inside the data, between ${P(r.min)} and ${P(r.max)}. And count × mean gives back the total: ${r.n} × mean = ${P(r.sum)}.`,
    khan: KHAN.stats,
  };
}

export function guideSequence(r: Extract<SeqResult, { kind: 'arithmetic' | 'geometric' }>, hasN: boolean): LessonGuide {
  const arith = r.kind === 'arithmetic';
  const first = r.terms.slice(0, 3).map(P).join(', ');
  return {
    goal: `Find the pattern in ${r.terms.map(P).join(', ')}, …${hasN ? ` and term ${r.n}` : ''}.`,
    idea: arith
      ? 'An **arithmetic** sequence grows by adding the same amount each time, the **common difference** d. Its graph is a straight line, and term n is the first term plus (n − 1) steps of d.'
      : 'A **geometric** sequence grows by multiplying by the same amount each time, the **common ratio** r. That makes it grow (or shrink) faster and faster; term n is the first term times r, (n − 1) times.',
    plan: [
      'Check the gaps: subtract neighbours (arithmetic?) or divide them (geometric?).',
      `Find the common ${arith ? 'difference d' : 'ratio r'}.`,
      `Next term: ${arith ? 'add d' : 'multiply by r'} once more.`,
      arith ? 'Term n: aₙ = a₁ + (n − 1)d.' : 'Term n: aₙ = a₁ · rⁿ⁻¹.',
      arith ? 'Sum of n terms: Sₙ = n(a₁ + aₙ) ÷ 2.' : 'Sum of n terms: Sₙ = a₁(1 − rⁿ) ÷ (1 − r).',
    ],
    vocab: [
      { term: 'term', meaning: 'one number in the sequence; aₙ is term n' },
      { term: arith ? 'common difference' : 'common ratio', meaning: arith ? 'what you add each time' : 'what you multiply by each time' },
    ],
    watch: ['From the first term to term n is n − 1 steps, not n.', arith ? 'Subtract later minus earlier.' : 'Divide later by earlier.'],
    check: `Put n = 1, 2 and 3 into the formula: it should give ${first}.`,
    khan: arith ? KHAN.arithmetic : KHAN.geometric,
  };
}

export function guideDecay(o: { name: string; a: number; z: number; type: 'alpha' | 'beta' | 'positron'; da: number; dz: number; pa: number; pz: number; daughter: string }): LessonGuide {
  const typeName = o.type === 'alpha' ? 'alpha decay' : o.type === 'beta' ? 'beta decay' : 'positron emission';
  return {
    goal: `Complete the equation for the ${typeName} of ${o.name}-${o.a}.`,
    idea: 'An unstable nucleus can throw out a particle and become a different element. A nuclear equation balances two totals: the **mass numbers** (top: protons + neutrons) and the **atomic numbers** (bottom: protons, which is also the charge). What comes out plus what’s left equals what you started with.',
    plan: ['Write down the particle that’s given off.', 'Balance the mass numbers (top).', 'Balance the atomic numbers (bottom).', 'Look up the element with the new atomic number.'],
    vocab: [
      { term: 'mass number (A)', meaning: 'protons + neutrons, written on top' },
      { term: 'atomic number (Z)', meaning: 'protons, written on the bottom; it names the element' },
      { term: 'alpha / beta / positron', meaning: '⁴₂He / ⁰₋₁e / ⁰₊₁e' },
    ],
    watch: ['Beta has −1 on the bottom, so the atomic number goes up by 1.', 'Alpha takes 4 off the top and 2 off the bottom.', 'A new atomic number means a new element.'],
    check: `Top: ${o.a} = ${o.da} + ${o.pa}. Bottom: ${o.z} = ${o.dz} + (${o.pz}). Both sides balance, so it’s ${o.daughter}-${o.da}.`,
    khan: KHAN.decay,
  };
}
