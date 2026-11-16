import { formatINR } from '../format';
import {
  applyBuy,
  applySell,
  filterBySymbol,
  positionMetrics,
  sortSymbols,
  summarize,
  validateOrderQty,
} from '../portfolio';
import type { Holding, Quote } from '../types';

const quote = (symbol: string, ltp: number | null, prevClose: number | null = null): Quote => ({
  symbol,
  ltp,
  prevClose,
  open: null,
  high: null,
  low: null,
  volume: null,
});

const reliance: Holding = { symbol: 'RELIANCE', qty: 25, investedPaise: 25 * 131959 };

describe('positionMetrics', () => {
  it('computes value and P&L in exact paise', () => {
    const m = positionMetrics(reliance, quote('RELIANCE', 116490, 116740));
    expect(m.valuePaise).toBe(25 * 116490);
    expect(m.pnlPaise).toBe(25 * 116490 - 25 * 131959);
    expect(formatINR(m.pnlPaise)).toBe('-₹3,867.25');
    expect(m.pnlPct).toBeCloseTo(-11.7225, 3);
    expect(m.dayPnlPaise).toBe(25 * (116490 - 116740));
    expect(m.avgPricePaise).toBe(131959);
  });

  it('never fakes a value when the price is missing', () => {
    const m = positionMetrics({ symbol: 'OLDCO', qty: 30, investedPaise: 1237500 }, undefined);
    expect(m.ltpPaise).toBeNull();
    expect(m.valuePaise).toBeNull();
    expect(m.pnlPaise).toBeNull();
    expect(m.pnlPct).toBeNull();
    expect(m.dayPnlPaise).toBeNull();
  });

  it('has a null day P&L when only previous close is missing', () => {
    const m = positionMetrics(reliance, quote('RELIANCE', 116490, null));
    expect(m.pnlPaise).not.toBeNull();
    expect(m.dayPnlPaise).toBeNull();
  });
});

describe('summarize', () => {
  const holdings: Holding[] = [
    reliance,
    { symbol: 'TCS', qty: 40, investedPaise: 40 * 258971 },
    { symbol: 'OLDCO', qty: 30, investedPaise: 30 * 41250 },
  ];
  const quotes: Record<string, Quote> = {
    RELIANCE: quote('RELIANCE', 116490, 116740),
    TCS: quote('TCS', 301233, 300000),
  };
  const s = summarize(holdings, sym => quotes[sym]);

  it('leaves unpriced holdings out of every total and lists them', () => {
    expect(s.unpriced).toEqual([{ symbol: 'OLDCO', investedPaise: 1237500 }]);
    expect(s.pricedCount).toBe(2);
    expect(s.investedPaise).toBe(25 * 131959 + 40 * 258971);
  });

  it('totals equal the sum of the rows exactly', () => {
    const rows = holdings.map(h => positionMetrics(h, quotes[h.symbol]));
    const sum = (f: (r: (typeof rows)[number]) => number | null) =>
      rows.reduce((acc, r) => acc + (f(r) ?? 0), 0);
    expect(s.currentValuePaise).toBe(sum(r => r.valuePaise));
    expect(s.pnlPaise).toBe(sum(r => r.pnlPaise));
    expect(s.dayPnlPaise).toBe(sum(r => r.dayPnlPaise));
  });

  it('recomputes percentages from totals instead of summing row percentages', () => {
    expect(s.pnlPct).toBeCloseTo((s.pnlPaise / s.investedPaise) * 100, 10);
    const prevValue = 25 * 116740 + 40 * 300000;
    expect(s.dayPnlPct).toBeCloseTo(((s.dayPnlPaise ?? 0) / prevValue) * 100, 10);
  });

  it('has null day P&L when nothing has a previous close', () => {
    const t = summarize([reliance], () => quote('RELIANCE', 100000, null));
    expect(t.dayPnlPaise).toBeNull();
    expect(t.dayPnlPct).toBeNull();
    expect(t.dayPnlExcluded).toEqual(['RELIANCE']);
  });

  it('is all zeros with null percentages for an empty or fully unpriced portfolio', () => {
    const t = summarize([holdings[2] as Holding], () => undefined);
    expect(t.currentValuePaise).toBe(0);
    expect(t.pnlPct).toBeNull();
    expect(t.unpriced).toHaveLength(1);
  });
});

describe('applyBuy', () => {
  it('creates a new holding', () => {
    expect(applyBuy(undefined, 'INFY', 3, 150000)).toEqual({ symbol: 'INFY', qty: 3, investedPaise: 450000 });
  });

  it('moves the average price to the weighted average', () => {
    const h = applyBuy({ symbol: 'X', qty: 10, investedPaise: 10 * 10000 }, 'X', 10, 20000);
    expect(h).toEqual({ symbol: 'X', qty: 20, investedPaise: 300000 });
    expect(positionMetrics(h, undefined).avgPricePaise).toBe(15000);
  });

  it('keeps exact invested cost even when the average is not a whole paisa', () => {
    const h = applyBuy({ symbol: 'X', qty: 1, investedPaise: 100 }, 'X', 2, 101);
    expect(h.investedPaise).toBe(302); // average 100.67 paise, cost stays exact
  });

  it('rejects bad quantities', () => {
    expect(() => applyBuy(undefined, 'X', 0, 100)).toThrow();
    expect(() => applyBuy(undefined, 'X', 1.5, 100)).toThrow();
  });
});

describe('applySell', () => {
  const h: Holding = { symbol: 'X', qty: 3, investedPaise: 1000 };

  it('keeps the average and reduces cost proportionally, rounded to the paisa', () => {
    expect(applySell(h, 1)).toEqual({ symbol: 'X', qty: 2, investedPaise: 667 });
  });

  it('removes the holding when everything is sold', () => {
    expect(applySell(h, 3)).toBeNull();
  });

  it('refuses to sell more than held', () => {
    expect(() => applySell(h, 4)).toThrow();
  });
});

describe('validateOrderQty', () => {
  it.each([
    ['', 'buy', 0, false],
    ['0', 'buy', 0, false],
    ['-2', 'buy', 0, false],
    ['1.5', 'buy', 0, false],
    ['abc', 'buy', 0, false],
    ['5', 'buy', 0, true],
    [' 7 ', 'buy', 0, true],
    ['10', 'sell', 10, true],
    ['11', 'sell', 10, false],
    ['1', 'sell', 0, false],
    ['2000000', 'buy', 0, false],
  ] as const)('%p %p with %p held -> ok=%p', (input, side, held, ok) => {
    expect(validateOrderQty(input, side, held).ok).toBe(ok);
  });
});

describe('sortSymbols', () => {
  const metrics = [
    positionMetrics({ symbol: 'B', qty: 1, investedPaise: 100 }, quote('B', 300)),
    positionMetrics({ symbol: 'A', qty: 1, investedPaise: 100 }, quote('A', 50)),
    positionMetrics({ symbol: 'OLDCO', qty: 1, investedPaise: 100 }, undefined),
    positionMetrics({ symbol: 'C', qty: 1, investedPaise: 100 }, quote('C', 200)),
  ];

  it('sorts by name', () => {
    expect(sortSymbols(metrics, 'name', 'asc')).toEqual(['A', 'B', 'C', 'OLDCO']);
  });

  it('puts unpriced rows last in both directions', () => {
    expect(sortSymbols(metrics, 'pnl', 'desc')).toEqual(['B', 'C', 'A', 'OLDCO']);
    expect(sortSymbols(metrics, 'value', 'asc')).toEqual(['A', 'C', 'B', 'OLDCO']);
  });
});

describe('filterBySymbol', () => {
  it('matches case-insensitively on the symbol', () => {
    const items = [{ symbol: 'HDFCBANK' }, { symbol: 'AXISBANK' }, { symbol: 'TCS' }];
    expect(filterBySymbol(items, 'bank').map(i => i.symbol)).toEqual(['HDFCBANK', 'AXISBANK']);
    expect(filterBySymbol(items, '  ')).toHaveLength(3);
  });
});
