import { divRound, percentOf, roundToTick, toPaise } from '../money';

describe('toPaise', () => {
  it('converts float rupees to exact integer paise', () => {
    expect(toPaise(1319.59)).toBe(131959); // 1319.59 * 100 is 131958.99999… in floating point
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(1164.9)).toBe(116490);
  });

  it('returns null for anything that is not a finite number', () => {
    expect(toPaise(undefined)).toBeNull();
    expect(toPaise(null)).toBeNull();
    expect(toPaise('12')).toBeNull();
    expect(toPaise(NaN)).toBeNull();
    expect(toPaise(Infinity)).toBeNull();
  });
});

describe('divRound', () => {
  it('rounds half away from zero', () => {
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(-5, 2)).toBe(-3);
    expect(divRound(7, 3)).toBe(2);
    expect(() => divRound(1, 0)).toThrow();
  });
});

describe('percentOf', () => {
  it('is null when part or base is unknown or base is zero', () => {
    expect(percentOf(null, 100)).toBeNull();
    expect(percentOf(10, null)).toBeNull();
    expect(percentOf(10, 0)).toBeNull();
    expect(percentOf(25, 200)).toBe(12.5);
  });
});

describe('roundToTick', () => {
  it('rounds to 5 paise and never to zero', () => {
    expect(roundToTick(116493)).toBe(116495);
    expect(roundToTick(116492)).toBe(116490);
    expect(roundToTick(1)).toBe(5);
  });
});
