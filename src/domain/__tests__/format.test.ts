import { formatCount, formatINR, formatPercent, MISSING } from '../format';

describe('formatINR', () => {
  it.each([
    [123456789, '₹12,34,567.89'],
    [0, '₹0.00'],
    [5, '₹0.05'],
    [99999, '₹999.99'],
    [100000, '₹1,000.00'],
    [10000000, '₹1,00,000.00'],
    [1234567890123, '₹12,34,56,78,901.23'],
    [-123450, '-₹1,234.50'],
  ])('formats %p paise as %p', (paise, expected) => {
    expect(formatINR(paise)).toBe(expected);
  });

  it('shows -- for a missing value, never ₹0.00', () => {
    expect(formatINR(null)).toBe(MISSING);
  });

  it('adds + only when asked and only for positive values', () => {
    expect(formatINR(150, { showPlus: true })).toBe('+₹1.50');
    expect(formatINR(-150, { showPlus: true })).toBe('-₹1.50');
    expect(formatINR(0, { showPlus: true })).toBe('₹0.00');
  });
});

describe('formatPercent', () => {
  it('rounds to 2 decimals with sign', () => {
    expect(formatPercent(12.345)).toBe('+12.35%');
    expect(formatPercent(-0.004)).toBe('0.00%');
    expect(formatPercent(-3.1)).toBe('-3.10%');
    expect(formatPercent(null)).toBe(MISSING);
  });
});

describe('formatCount', () => {
  it('uses Indian grouping', () => {
    expect(formatCount(14753650)).toBe('1,47,53,650');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(null)).toBe(MISSING);
  });
});
