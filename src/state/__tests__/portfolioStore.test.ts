import { summarize, positionMetrics } from '../../domain/portfolio';
import type { Holding, Quote } from '../../domain/types';
import { holdingsAfterOrder, usePortfolioStore } from '../portfolioStore';

const holdings: Holding[] = [
  { symbol: 'A', qty: 10, investedPaise: 100000 },
  { symbol: 'B', qty: 5, investedPaise: 50000 },
];

describe('holdingsAfterOrder', () => {
  it('buy updates an existing holding in place', () => {
    const next = holdingsAfterOrder(holdings, 'A', 'buy', 10, 20000);
    expect(next[0]).toEqual({ symbol: 'A', qty: 20, investedPaise: 300000 });
    expect(next[1]).toBe(holdings[1]);
  });

  it('buy of a new symbol appends it', () => {
    expect(holdingsAfterOrder(holdings, 'C', 'buy', 1, 500).map(h => h.symbol)).toEqual(['A', 'B', 'C']);
  });

  it('selling everything removes the row', () => {
    expect(holdingsAfterOrder(holdings, 'B', 'sell', 5, 1).map(h => h.symbol)).toEqual(['A']);
  });

  it('cannot sell what is not held', () => {
    expect(() => holdingsAfterOrder(holdings, 'C', 'sell', 1, 1)).toThrow();
    expect(() => holdingsAfterOrder(holdings, 'B', 'sell', 6, 1)).toThrow();
  });

  it('keeps Summary consistent with rows after a trade', () => {
    const quotes: Record<string, Quote> = {
      A: { symbol: 'A', ltp: 12345, prevClose: 12000, open: null, high: null, low: null, volume: null },
      B: { symbol: 'B', ltp: 9995, prevClose: 10000, open: null, high: null, low: null, volume: null },
    };
    const next = holdingsAfterOrder(holdingsAfterOrder(holdings, 'A', 'buy', 3, 12345), 'B', 'sell', 2, 9995);
    const s = summarize(next, sym => quotes[sym]);
    const rows = next.map(h => positionMetrics(h, quotes[h.symbol]));
    expect(s.pnlPaise).toBe(rows.reduce((acc, r) => acc + (r.pnlPaise ?? 0), 0));
    expect(s.investedPaise).toBe(rows.reduce((acc, r) => acc + r.investedPaise, 0));
  });
});

describe('usePortfolioStore', () => {
  it('records the order together with the new holdings', () => {
    const { placeOrder } = usePortfolioStore.getState();
    placeOrder('RELIANCE', 'buy', 5, 120000);
    const state = usePortfolioStore.getState();
    expect(state.orders[0]).toMatchObject({ symbol: 'RELIANCE', side: 'buy', qty: 5, pricePaise: 120000 });
    expect(state.holdings.find(h => h.symbol === 'RELIANCE')?.qty).toBe(30);
  });

  it('adds to the watchlist once and removes', () => {
    const s = usePortfolioStore.getState();
    s.addToWatchlist('WIPRO');
    s.addToWatchlist('WIPRO');
    expect(usePortfolioStore.getState().watchlist.filter(w => w === 'WIPRO')).toHaveLength(1);
    usePortfolioStore.getState().removeFromWatchlist('WIPRO');
    expect(usePortfolioStore.getState().watchlist).not.toContain('WIPRO');
  });
});
