import { parseOhlcResponse, parseOhlcRow } from '../ohlcClient';
import { parseHoldingsCsv, SEED_HOLDINGS } from '../seedHoldings';

describe('seed holdings', () => {
  it('parses all 21 rows with exact invested cost', () => {
    expect(SEED_HOLDINGS).toHaveLength(21);
    expect(SEED_HOLDINGS[0]).toEqual({ symbol: 'RELIANCE', qty: 25, investedPaise: 25 * 131959 });
    expect(SEED_HOLDINGS.find(h => h.symbol === 'OLDCO')).toEqual({ symbol: 'OLDCO', qty: 30, investedPaise: 1237500 });
  });

  it('fails loudly on a bad row', () => {
    expect(() => parseHoldingsCsv('symbol,qty,avgPrice\nX,abc,10')).toThrow();
  });
});

describe('OHLC parsing', () => {
  const row = {
    symbol: 'RELIANCE',
    ltp: 1164.9,
    open: 1170.4,
    prevClose: 1167.4,
    high: 1174.6,
    low: 1152.5,
    volume: 14753650,
  };

  it('reads message.data and converts to paise', () => {
    const quotes = parseOhlcResponse({ status: 'success', code: 200, message: { data: [row] } });
    expect(quotes).toEqual([
      { symbol: 'RELIANCE', ltp: 116490, open: 117040, prevClose: 116740, high: 117460, low: 115250, volume: 14753650 },
    ]);
  });

  it('turns missing, null or zero prices into null', () => {
    const q = parseOhlcRow({ symbol: 'X', ltp: 0, open: null, prevClose: '12' });
    expect(q).toEqual({ symbol: 'X', ltp: null, open: null, high: null, low: null, prevClose: null, volume: null });
  });

  it('throws on an unexpected shape', () => {
    expect(() => parseOhlcResponse({ message: 'oops' })).toThrow();
  });
});
