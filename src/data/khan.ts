/**
 * Khan Academy pages for each topic, for "learn more" and extra practice in
 * Lesson mode. Each URL was found through a search of khanacademy.org; Khan
 * moves pages now and then, so if one stops working, replace it here.
 */
export interface KhanLink {
  title: string;
  url: string;
  kind: 'video' | 'article' | 'practice' | 'unit';
}

const K = (kind: KhanLink['kind'], title: string, url: string): KhanLink => ({ kind, title, url });

export const KHAN = {
  slope: [
    K('video', 'Worked example: slope from two points', 'https://www.khanacademy.org/math/cc-eighth-grade-math/cc-8th-linear-equations-functions/8th-slope/v/slope-of-a-line-2'),
    K('practice', 'Slope from two points', 'https://www.khanacademy.org/math/algebra-basics/alg-basics-graphing-lines-and-slope/alg-basics-slope/e/slope-from-two-points'),
    K('video', 'Slope of a horizontal line', 'https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:linear-equations-graphs/x2f8bb11595b61c86:horizontal-vertical-lines/v/slope-of-a-line-3'),
  ],
  standard: [
    K('video', 'Converting to slope-intercept form', 'https://en.khanacademy.org/math/pre-algebra/xb4832e56:two-variable-equations/xb4832e56:slope/v/converting-to-slope-intercept-form'),
    K('video', 'Intro to linear equation standard form', 'https://www.khanacademy.org/math/algebra-1-illustrative-math/x6418b49dfbc9d0c9:linear-equations/x6418b49dfbc9d0c9:connecting-equations-graphs/v/standard-form-for-linear-equations'),
    K('article', 'Forms of linear equations review', 'https://www.khanacademy.org/math/math1/x89d82521517266d4:linear-forms/x89d82521517266d4:all-linear-forms/a/forms-of-linear-equations-review'),
  ],
  pointSlope: [
    K('article', 'Point-slope form review', 'https://en.khanacademy.org/math/algebra-home/alg-linear-eq-func/alg-point-slope/a/point-slope-form-review'),
    K('video', 'Point-slope & slope-intercept from two points', 'https://en.khanacademy.org/math/algebra-home/alg-linear-eq-func/alg-point-slope/v/point-slope-and-slope-intercept-form-from-two-points'),
    K('article', 'Forms of linear equations review', 'https://www.khanacademy.org/math/math1/x89d82521517266d4:linear-forms/x89d82521517266d4:all-linear-forms/a/forms-of-linear-equations-review'),
  ],
  substitution: [
    K('video', 'Systems with substitution: worked example', 'https://www.khanacademy.org/math/algebra-basics/alg-basics-systems-of-equations/alg-basics-solving-systems-with-substitution/v/practice-using-substitution-for-systems'),
    K('practice', 'Systems of equations with substitution', 'https://www.khanacademy.org/math/8th-engage-ny/engage-8th-module-4/8th-module-4-topic-d/e/systems_of_equations_with_substitution'),
    K('unit', 'Systems of equations (Algebra 1)', 'https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:systems-of-equations'),
  ],
  elimination: [
    K('video', 'Systems with elimination: King’s cupcakes', 'https://www.khanacademy.org/math/algebra-basics/alg-basics-systems-of-equations/alg-basics-elimination-method-systems/v/king-s-cupcakes-solving-systems-by-elimination'),
    K('unit', 'Systems of equations (Algebra 1)', 'https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:systems-of-equations'),
  ],
  quadratic: [
    K('video', 'The quadratic formula', 'https://www.khanacademy.org/math/algebra/quadratics/solving-quadratics-using-the-quadratic-formula/v/using-the-quadratic-formula'),
    K('article', 'Discriminant review', 'https://www.khanacademy.org/math/algebra/quadratics/solving-quadratics-using-the-quadratic-formula/a/discriminant-review'),
    K('practice', 'Solve with the quadratic formula', 'https://www.khanacademy.org/math/get-ready-for-algebra-ii/x6e4201668896ef07:get-ready-for-equations/x6e4201668896ef07:the-quadratic-formula/e/quadratic_equation'),
  ],
  factoring: [
    K('video', 'Intro to factoring by grouping', 'https://www.khanacademy.org/math/algebra2/polynomial-functions/factoring-polynomials-quadratic-forms-alg2/v/factor-by-grouping-and-factoring-completely'),
    K('video', 'Solving quadratics by factoring', 'https://www.khanacademy.org/v/example-1-solving-a-quadratic-equation-by-factoring'),
    K('practice', 'Quadratics by factoring (intro)', 'https://www.khanacademy.org/math/algebra/quadratics/solving-quadratic-equations-by-factoring/e/solving_quadratics_by_factoring'),
  ],
  pythag: [
    K('video', 'Intro to the Pythagorean theorem', 'https://www.khanacademy.org/math/geometry/hs-geo-trig/hs-geo-pythagorean-theorem/v/pythagorean-theorem'),
    K('video', 'Pythagorean theorem: finding a leg', 'https://www.khanacademy.org/test-prep/get-ready-for-sat-prep-math/x9eb58585c728c6ea:get-ready-geometry-and-trigonometry/x9eb58585c728c6ea:get-ready-right-triangle-trigonometry/v/pythagorean-theorem-2'),
  ],
  areaRectangle: [
    K('video', 'Perimeter & area basics', 'https://www.khanacademy.org/v/perimeter-and-area-basics'),
    K('practice', 'Area of squares and rectangles', 'https://www.khanacademy.org/math/basic-geo/basic-geo-area-and-perimeter/x7fa91416:multiply-to-find-area/e/area-of-squares-and-rectangles'),
  ],
  areaTriangle: [
    K('video', 'Area of a triangle', 'https://www.khanacademy.org/v/intuition-for-area-of-a-triangle'),
    K('video', 'Perimeter & area basics', 'https://www.khanacademy.org/v/perimeter-and-area-basics'),
  ],
  areaParallelogram: [
    K('video', 'Area of a parallelogram', 'https://www.khanacademy.org/math/geometry-home/geometry-area-perimeter/geometry-parallelogram-area/v/intuition-for-area-of-a-parallelogram'),
    K('video', 'Area of a triangle', 'https://www.khanacademy.org/v/intuition-for-area-of-a-triangle'),
  ],
  areaTrapezoid: [
    K('video', 'Area of trapezoids', 'https://www.khanacademy.org/v/area-of-a-trapezoid-1'),
    K('video', 'Area of a parallelogram', 'https://www.khanacademy.org/math/geometry-home/geometry-area-perimeter/geometry-parallelogram-area/v/intuition-for-area-of-a-parallelogram'),
  ],
  areaCircle: [
    K('video', 'Area of a circle', 'https://www.khanacademy.org/math/get-ready-for-geometry/x8a652ce72bd83eb2:get-ready-for-circles-and-solid-geometry/x8a652ce72bd83eb2:area-and-circumference-of-circles/v/area-of-a-circle'),
    K('article', 'Area of circles review', 'https://www.khanacademy.org/math/basic-geo/x7fa91416:circles-cylinders-cones-and-spheres/x7fa91416:area-and-circumference-of-circles/a/area-of-circles-review'),
  ],
  trigSide: [
    K('video', 'Trigonometric ratios in right triangles', 'https://www.khanacademy.org/math/geometry-home/right-triangles-topic/intro-to-the-trig-ratios-geo/v/basic-trigonometry-ii'),
    K('video', 'Solving for sides with trigonometry', 'https://www.khanacademy.org/math/get-ready-for-algebra-ii/x6e4201668896ef07:get-ready-for-trigonometry/x6e4201668896ef07:solving-for-sides-and-angles-in-right-triangles-using-the-trigonometric-ratios/v/example-trig-to-solve-the-sides-and-angles-of-a-right-triangle'),
  ],
  trigAngle: [
    K('article', 'Intro to inverse trig functions', 'https://www.khanacademy.org/math/trigonometry/trigonometry-right-triangles/modal/a/inverse-trig-functions-intro'),
    K('video', 'Trigonometric ratios in right triangles', 'https://www.khanacademy.org/math/geometry-home/right-triangles-topic/intro-to-the-trig-ratios-geo/v/basic-trigonometry-ii'),
  ],
  stats: [
    K('video', 'Statistics intro: mean, median & mode', 'https://www.khanacademy.org/v/statistics-intro-mean-median-and-mode'),
    K('article', 'Mean, median, and mode review', 'https://www.khanacademy.org/math/statistics-probability/summarizing-quantitative-data/mean-median-basics/a/mean-median-and-mode-review'),
    K('practice', 'Mean, median, and mode', 'https://www.khanacademy.org/math/statistics-probability/summarizing-quantitative-data/mean-median-basics/e/mean_median_and_mode'),
  ],
  arithmetic: [
    K('article', 'Arithmetic sequences review', 'https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:sequences/x2f8bb11595b61c86:introduction-to-arithmetic-sequences/a/arithmetic-sequences-review'),
    K('video', 'Using arithmetic sequence formulas', 'https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:sequences/x2f8bb11595b61c86:introduction-to-arithmetic-sequences/v/using-arithmetic-sequences-formulas'),
    K('practice', 'Use arithmetic sequence formulas', 'https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:sequences/x2f8bb11595b61c86:introduction-to-arithmetic-sequences/e/arithmetic_sequences_2'),
  ],
  geometric: [
    K('video', 'Intro to geometric sequences', 'https://www.khanacademy.org/math/algebra2/x2-2-sequences/x2-2-2-geometric-sequences/v/geometric-sequences'),
  ],
  decay: [
    K('video', 'Writing nuclear equations for alpha, beta & gamma decay', 'https://en.khanacademy.org/science/physics/quantum-physics/in-in-nuclei/v/alpha-beta-and-gamma-decay'),
    K('video', 'Types of decay (incl. positron emission)', 'https://www.khanacademy.org/science/in-in-class-12th-physics-india/nuclei/in-in-nuclear-physics/v/types-of-decay'),
    K('video', 'Nuclear stability and nuclear equations', 'https://www.khanacademy.org/v/nuclear-stability-and-nuclear-equations'),
  ],
} satisfies Record<string, KhanLink[]>;
