/**
 * Exact rational arithmetic on bigint so that decimals and fractions typed by
 * students never pick up floating-point noise.
 */
export class Rational {
  readonly n: bigint;
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    this.n = n;
    this.d = d;
  }

  static of(n: bigint | number, d: bigint | number = 1n): Rational {
    let nn = typeof n === 'bigint' ? n : BigInt(n);
    let dd = typeof d === 'bigint' ? d : BigInt(d);
    if (dd === 0n) throw new RangeError('Division by zero');
    if (dd < 0n) {
      nn = -nn;
      dd = -dd;
    }
    const g = gcd(abs(nn), dd);
    return new Rational(nn / g, dd / g);
  }

  static readonly ZERO = Rational.of(0);
  static readonly ONE = Rational.of(1);

  /** Parses "3", "-2.75", "4/6", "-1/2", ".5", "1e3"-free decimal strings. */
  static parse(raw: string): Rational | null {
    const s = normalizeMinus(raw).replace(/\s+/g, '');
    if (!s) return null;
    const frac = /^([+-]?)(\d*\.?\d+)\/([+-]?)(\d*\.?\d+)$/.exec(s);
    if (frac) {
      const num = Rational.parse(frac[1] + frac[2]);
      const den = Rational.parse(frac[3] + frac[4]);
      if (!num || !den || den.isZero()) return null;
      return num.div(den);
    }
    const dec = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
    if (!dec || (dec[2] === '' && (dec[3] ?? '') === '')) return null;
    const sign = dec[1] === '-' ? -1n : 1n;
    const whole = dec[2] || '0';
    const fracPart = dec[3] ?? '';
    const n = BigInt(whole + fracPart) * sign;
    const d = 10n ** BigInt(fracPart.length);
    return Rational.of(n, d);
  }

  add(o: Rational): Rational {
    return Rational.of(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Rational): Rational {
    return Rational.of(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Rational): Rational {
    return Rational.of(this.n * o.n, this.d * o.d);
  }
  div(o: Rational): Rational {
    if (o.isZero()) throw new RangeError('Division by zero');
    return Rational.of(this.n * o.d, this.d * o.n);
  }
  neg(): Rational {
    return Rational.of(-this.n, this.d);
  }
  recip(): Rational {
    return Rational.of(this.d, this.n);
  }
  abs(): Rational {
    return Rational.of(abs(this.n), this.d);
  }

  isZero(): boolean {
    return this.n === 0n;
  }
  isOne(): boolean {
    return this.n === 1n && this.d === 1n;
  }
  isNegative(): boolean {
    return this.n < 0n;
  }
  isInteger(): boolean {
    return this.d === 1n;
  }
  equals(o: Rational): boolean {
    return this.n === o.n && this.d === o.d;
  }
  sign(): -1 | 0 | 1 {
    return this.n === 0n ? 0 : this.n < 0n ? -1 : 1;
  }

  toNumber(): number {
    return Number(this.n) / Number(this.d);
  }

  /** Plain text: "-3/4", "5". */
  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }

  /** Decimal approximation for display alongside exact values, or null if already an integer. */
  toDecimalString(maxDigits = 6): string | null {
    if (this.isInteger()) return null;
    const v = this.toNumber();
    const fixed = v.toFixed(maxDigits).replace(/0+$/, '').replace(/\.$/, '');
    return terminates(this.d) ? fixed : `≈ ${fixed}`;
  }
}

export function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

function abs(a: bigint): bigint {
  return a < 0n ? -a : a;
}

function terminates(d: bigint): boolean {
  while (d % 2n === 0n) d /= 2n;
  while (d % 5n === 0n) d /= 5n;
  return d === 1n;
}

export function normalizeMinus(s: string): string {
  return s.replace(/[−–—]/g, '-');
}
