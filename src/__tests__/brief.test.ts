/**
 * End-to-end checks of the rules in the brief, using the real simulator, price store and
 * domain functions together (no UI). Timers are faked, so a "minute" runs instantly.
 */
import { SEED_HOLDINGS } from '../data/seedHoldings';
import { parseOhlcResponse } from '../data/ohlcClient';
import { formatINR } from '../domain/format';
import { positionMetrics, summarize } from '../domain/portfolio';
import type { Quote, Tick } from '../domain/types';
import { SimulatedFeed } from '../feed/SimulatedFeed';
import { PriceStore } from '../state/priceStore';
import { holdingsAfterOrder } from '../state/portfolioStore';

// A snapshot shaped like the real API response, for every seed symbol except OLDCO.
const snapshot = parseOhlcResponse({
  status: 'success',
  code: 200,
  message: {
    data: SEED_HOLDINGS.filter(h => h.symbol !== 'OLDCO').map((h, i) => {
      const price = 100 + i * 37.35;
      return { symbol: h.symbol, ltp: price, open: price, high: price + 5, low: price - 5, prevClose: price - 1.2, volume: 1000 * (i + 1) };
    }),
  },
});

describe('brief: live portfolio rules', () => {
  let now = 0;
  let store: PriceStore;
  let feed: SimulatedFeed;
  const received: Tick[] = [];
  const accepted: Tick[] = [];

  beforeAll(() => {
    jest.useFakeTimers();
    store = new PriceStore(flush => flush(), () => now); // flush synchronously in tests
    store.setSnapshot(snapshot);
    feed = new SimulatedFeed({ now: () => now });
    feed.seed(snapshot);
    feed.onTick(t => {
      received.push(t);
      if (store.applyTick(t)) {
        accepted.push(t);
      }
    });
    feed.connect();
    for (let t = 0; t < 130_000; t += 10) {
      now += 10;
      jest.advanceTimersByTime(10);
    }
    feed.disconnect();
  });
  afterAll(() => jest.useRealTimers());

  it('emits about 20 ticks per second (minus silences)', () => {
    const perSecond = received.length / 130;
    expect(perSecond).toBeGreaterThan(17);
    expect(perSecond).toBeLessThan(21);
  });

  it('ticks are partial updates', () => {
    expect(received.some(t => t.high === undefined || t.low === undefined || t.volume === undefined)).toBe(true);
  });

  it('about 2% of ticks arrive late and are ignored', () => {
    const ignored = received.length - accepted.length;
    expect(ignored / received.length).toBeGreaterThan(0.005);
    expect(ignored / received.length).toBeLessThan(0.05);
    // every accepted tick has a higher seq than the previous accepted one for that symbol
    const last = new Map<string, number>();
    for (const t of accepted) {
      expect(t.seq).toBeGreaterThan(last.get(t.symbol) ?? 0);
      last.set(t.symbol, t.seq);
    }
  });

  it('goes silent for ~5s roughly once a minute (drives "prices paused")', () => {
    const times: number[] = [];
    let i = 0;
    // rebuild arrival times from a second run to measure gaps
    now = 0;
    const f = new SimulatedFeed({ now: () => now });
    f.seed(snapshot);
    f.onTick(() => times.push(now));
    f.connect();
    for (; i < 130_000; i += 10) {
      now += 10;
      jest.advanceTimersByTime(10);
    }
    f.disconnect();
    const gaps = times.slice(1).map((t, k) => t - (times[k] ?? 0)).filter(g => g >= 4_900);
    expect(gaps.length).toBeGreaterThanOrEqual(1);
    expect(gaps.length).toBeLessThanOrEqual(3);
  });

  it('OLDCO is never priced, shows --, and is not counted as zero', () => {
    expect(store.getQuote('OLDCO')).toBeUndefined();
    expect(received.some(t => t.symbol === 'OLDCO')).toBe(false);
    const oldco = SEED_HOLDINGS.find(h => h.symbol === 'OLDCO');
    expect(oldco).toBeDefined();
    const m = positionMetrics(oldco!, store.getQuote('OLDCO'));
    expect(formatINR(m.ltpPaise)).toBe('--');
    expect(formatINR(m.pnlPaise)).toBe('--');
    const s = summarize(SEED_HOLDINGS, store.getQuote);
    expect(s.unpriced.map(u => u.symbol)).toEqual(['OLDCO']);
    expect(s.investedPaise).toBe(SEED_HOLDINGS.filter(h => h.symbol !== 'OLDCO').reduce((a, h) => a + h.investedPaise, 0));
  });

  it('Summary totals match the sum of the rows as displayed, after live ticks and trades', () => {
    let holdings = holdingsAfterOrder(SEED_HOLDINGS, 'TCS', 'buy', 7, store.getQuote('TCS')!.ltp!);
    holdings = holdingsAfterOrder(holdings, 'RELIANCE', 'sell', 10, store.getQuote('RELIANCE')!.ltp!);
    const rows = holdings.map(h => positionMetrics(h, store.getQuote(h.symbol)));
    const s = summarize(holdings, store.getQuote);
    // Parse the displayed row strings back and add them up.
    const shown = (p: number | null) => (p === null ? 0 : Math.round(Number(formatINR(p).replace(/[₹,+]/g, '')) * 100));
    expect(s.currentValuePaise).toBe(rows.reduce((a, r) => a + shown(r.valuePaise), 0));
    expect(s.pnlPaise).toBe(rows.reduce((a, r) => a + shown(r.pnlPaise), 0));
    expect(s.dayPnlPaise).toBe(rows.reduce((a, r) => a + shown(r.dayPnlPaise), 0));
  });

  it('average price changes on a buy, not on a sell', () => {
    const tcs = SEED_HOLDINGS.find(h => h.symbol === 'TCS')!;
    const afterBuy = holdingsAfterOrder([tcs], 'TCS', 'buy', 40, 300000)[0]!;
    expect(positionMetrics(afterBuy, undefined).avgPricePaise).toBe(Math.round((40 * 258971 + 40 * 300000) / 80));
    const afterSell = holdingsAfterOrder([afterBuy], 'TCS', 'sell', 30, 1)[0]!;
    expect(positionMetrics(afterSell, undefined).avgPricePaise).toBe(positionMetrics(afterBuy, undefined).avgPricePaise);
  });

  it('prices stay positive and on a 5 paise grid after a long run', () => {
    for (const q of snapshot) {
      const live = store.getQuote(q.symbol) as Quote;
      expect(live.ltp).toBeGreaterThan(0);
      expect((live.ltp ?? 0) % 5).toBe(0);
      expect(live.high!).toBeGreaterThanOrEqual(live.ltp!);
      expect(live.low!).toBeLessThanOrEqual(live.ltp!);
    }
  });
});
