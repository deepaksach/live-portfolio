import type { Quote } from '../../domain/types';
import { PriceStore } from '../priceStore';

const q = (symbol: string, ltp: number): Quote => ({
  symbol,
  ltp,
  open: null,
  high: null,
  low: null,
  prevClose: null,
  volume: null,
});

describe('PriceStore', () => {
  const manual = () => {
    const store = new PriceStore(() => {}, () => 1000);
    store.setSnapshot([q('A', 100), q('B', 200)]);
    store.flush();
    return store;
  };

  it('notifies only the listeners of the symbol that changed', () => {
    const store = manual();
    const a = jest.fn();
    const b = jest.fn();
    store.subscribe('A', a);
    store.subscribe('B', b);
    store.applyTick({ symbol: 'A', seq: 1, ltp: 1.5 });
    store.flush();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(store.getQuote('A')?.ltp).toBe(150);
  });

  it('batches many ticks into one notification per flush', () => {
    const store = manual();
    const a = jest.fn();
    store.subscribe('A', a);
    store.applyTick({ symbol: 'A', seq: 1, ltp: 1.1 });
    store.applyTick({ symbol: 'A', seq: 2, ltp: 1.2 });
    store.applyTick({ symbol: 'A', seq: 3, ltp: 1.3 });
    store.flush();
    expect(a).toHaveBeenCalledTimes(1);
    expect(store.getQuote('A')?.ltp).toBe(130);
  });

  it('ignores late ticks, also after a new snapshot', () => {
    const store = manual();
    expect(store.applyTick({ symbol: 'A', seq: 5, ltp: 2 })).toBe(true);
    expect(store.applyTick({ symbol: 'A', seq: 4, ltp: 9 })).toBe(false);
    store.setSnapshot([q('A', 100)]);
    expect(store.applyTick({ symbol: 'A', seq: 3, ltp: 9 })).toBe(false);
    expect(store.getQuote('A')?.ltp).toBe(100);
  });

  it('keeps the same quote object when nothing changed, so React can skip the render', () => {
    const store = manual();
    const before = store.getQuote('B');
    store.applyTick({ symbol: 'A', seq: 1, ltp: 3 });
    expect(store.getQuote('B')).toBe(before);
  });

  it('records the time of the last accepted tick only', () => {
    const store = manual();
    expect(store.getLastTickAt()).toBe(0);
    store.applyTick({ symbol: 'ZZZ', seq: 1, ltp: 3 });
    expect(store.getLastTickAt()).toBe(0);
    store.applyTick({ symbol: 'A', seq: 1, ltp: 3 });
    expect(store.getLastTickAt()).toBe(1000);
  });
});
