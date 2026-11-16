import type { Quote, Tick } from '../../domain/types';
import { SimulatedFeed } from '../SimulatedFeed';

const q = (symbol: string, ltp: number | null): Quote => ({
  symbol,
  ltp,
  open: ltp,
  high: ltp,
  low: ltp,
  prevClose: ltp,
  volume: 1000,
});

/** Small deterministic PRNG so tests are repeatable. */
function seeded(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('SimulatedFeed', () => {
  let now = 0;
  beforeEach(() => {
    jest.useFakeTimers();
    now = 0;
  });
  afterEach(() => jest.useRealTimers());

  const run = (feed: SimulatedFeed, ms: number) => {
    for (let t = 0; t < ms; t += 10) {
      now += 10;
      jest.advanceTimersByTime(10);
    }
    void feed;
  };

  const make = (opts = {}) =>
    new SimulatedFeed({ random: seeded(), now: () => now, silenceEveryMs: 1e9, ...opts });

  it('emits about 20 ticks per second', () => {
    const feed = make({ lateRatio: 0 });
    feed.seed([q('A', 100000), q('B', 50000)]);
    const ticks: Tick[] = [];
    feed.onTick(t => ticks.push(t));
    feed.connect();
    run(feed, 10_000);
    expect(ticks.length).toBeGreaterThan(190);
    expect(ticks.length).toBeLessThan(210);
  });

  it('sends partial ticks with moves of at most ±0.2 %, on a 5 paise grid', () => {
    const feed = make({ lateRatio: 0 });
    feed.seed([q('A', 100000)]);
    let last = 100000;
    let partial = 0;
    feed.onTick(t => {
      if (t.ltp !== undefined) {
        const paise = Math.round(t.ltp * 100);
        expect(Math.abs(paise - last)).toBeLessThanOrEqual(Math.ceil(last * 0.002) + 5);
        expect(paise % 5).toBe(0);
        last = paise;
      }
      if (Object.keys(t).length < 6) {
        partial += 1;
      }
    });
    feed.connect();
    run(feed, 5_000);
    expect(partial).toBeGreaterThan(0);
  });

  it('increases seq per symbol, and late ticks arrive after a newer one', () => {
    const feed = make({ lateRatio: 0.2 });
    feed.seed([q('A', 100000), q('B', 50000)]);
    const maxSeen = new Map<string, number>();
    let late = 0;
    let total = 0;
    feed.onTick(t => {
      total += 1;
      const max = maxSeen.get(t.symbol) ?? 0;
      if (t.seq < max) {
        late += 1;
      }
      maxSeen.set(t.symbol, Math.max(max, t.seq));
    });
    feed.connect();
    run(feed, 10_000);
    expect(late).toBeGreaterThan(0);
    expect(late / total).toBeLessThan(0.3);
  });

  it('goes silent for 5 seconds and then resumes', () => {
    const feed = make({ lateRatio: 0, silenceEveryMs: 4_000, silenceForMs: 5_000, random: () => 0.5 });
    feed.seed([q('A', 100000)]);
    const times: number[] = [];
    feed.onTick(() => times.push(now));
    feed.connect();
    run(feed, 15_000);
    const gaps = times.slice(1).map((t, i) => t - (times[i] ?? 0));
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(5_000);
    expect(times[times.length - 1]).toBeGreaterThan(9_000);
  });

  it('never ticks a symbol the API did not price', () => {
    const feed = make();
    feed.seed([q('OLDCO', null)]);
    const fn = jest.fn();
    feed.onTick(fn);
    feed.connect();
    run(feed, 1_000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('stops on disconnect and unsubscribes', () => {
    const feed = make({ lateRatio: 0 });
    feed.seed([q('A', 100000)]);
    const fn = jest.fn();
    const off = feed.onTick(fn);
    feed.connect();
    run(feed, 500);
    feed.disconnect();
    const count = fn.mock.calls.length;
    run(feed, 500);
    expect(fn).toHaveBeenCalledTimes(count);
    off();
    feed.connect();
    run(feed, 500);
    expect(fn).toHaveBeenCalledTimes(count);
  });
});
