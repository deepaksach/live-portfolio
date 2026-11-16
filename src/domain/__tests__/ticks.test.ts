import { applyTick, dayChange } from '../ticks';
import type { Quote } from '../types';

const base: Quote = {
  symbol: 'TCS',
  ltp: 300000,
  open: 299000,
  high: 301000,
  low: 298000,
  prevClose: 299500,
  volume: 1000,
};

describe('applyTick', () => {
  it('applies only the fields present in the partial tick', () => {
    const next = applyTick(base, 4, { symbol: 'TCS', seq: 5, ltp: 3001.5 });
    expect(next).toEqual({ ...base, ltp: 300150 });
  });

  it('ignores late and duplicate ticks', () => {
    expect(applyTick(base, 5, { symbol: 'TCS', seq: 4, ltp: 1 })).toBeNull();
    expect(applyTick(base, 5, { symbol: 'TCS', seq: 5, ltp: 1 })).toBeNull();
  });

  it('ignores ticks for symbols without a snapshot', () => {
    expect(applyTick(undefined, undefined, { symbol: 'NEW', seq: 1, ltp: 10 })).toBeNull();
  });

  it('never stores a zero or invalid price', () => {
    const next = applyTick(base, undefined, { symbol: 'TCS', seq: 1, ltp: 0, volume: NaN });
    expect(next?.ltp).toBe(300000);
    expect(next?.volume).toBe(1000);
  });
});

describe('dayChange', () => {
  it('is relative to previous close, and null when it is missing', () => {
    expect(dayChange(base).abs).toBe(500);
    expect(dayChange({ ...base, prevClose: null })).toEqual({ abs: null, pct: null });
  });
});
