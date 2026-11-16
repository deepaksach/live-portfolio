import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { positionMetrics, sortSymbols, type SortDir, type SortKey } from '../domain/portfolio';
import type { Holding, Quote } from '../domain/types';
import { priceStore } from '../app/services';

/** Live quote for one symbol. Re-renders only when that symbol changes. */
export function useQuote(symbol: string): Quote | undefined {
  const subscribe = useCallback((cb: () => void) => priceStore.subscribe(symbol, cb), [symbol]);
  const getSnapshot = useCallback(() => priceStore.getQuote(symbol), [symbol]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * A counter that changes at most once per `intervalMs` while prices are moving.
 * Components that depend on every price (Summary, sort order) use it so they re-render
 * a few times a second instead of 20+ times.
 */
export function useThrottledPriceVersion(intervalMs: number): number {
  const [version, setVersion] = useState(() => priceStore.getVersion());
  useEffect(() => {
    let dirty = false;
    const unsubscribe = priceStore.subscribeAll(() => {
      dirty = true;
    });
    const timer = setInterval(() => {
      if (dirty) {
        dirty = false;
        setVersion(priceStore.getVersion());
      }
    }, intervalMs);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [intervalMs]);
  return version;
}

export type FeedStatus = 'waiting' | 'live' | 'paused';

export const PAUSED_AFTER_MS = 1500;

/** Derived from tick arrival times, not from the simulator, so it works the same with a real socket. */
export function useFeedStatus(): { status: FeedStatus; lastTickAt: number } {
  const compute = useCallback((): FeedStatus => {
    const last = priceStore.getLastTickAt();
    if (last === 0) {
      return 'waiting';
    }
    return Date.now() - last > PAUSED_AFTER_MS ? 'paused' : 'live';
  }, []);
  const [status, setStatus] = useState<FeedStatus>(compute);
  useEffect(() => {
    const timer = setInterval(() => setStatus(compute()), 500);
    return () => clearInterval(timer);
  }, [compute]);
  return { status, lastTickAt: priceStore.getLastTickAt() };
}

/**
 * Visible holding order for the Portfolio list. Recomputed at most once a second, and the
 * returned array keeps the same identity when the order did not change, so the list itself
 * does not re-render on ticks.
 */
export function useSortedSymbols(
  holdings: readonly Holding[],
  sortKey: SortKey,
  sortDir: SortDir,
  filter: string,
): string[] {
  const priceDependent = sortKey !== 'name';
  const version = useThrottledPriceVersion(priceDependent ? 1000 : 60_000);
  const previous = useRef<string[]>([]);

  return useMemo(() => {
    const q = filter.trim().toUpperCase();
    const metrics = holdings
      .filter(h => q === '' || h.symbol.includes(q))
      .map(h => positionMetrics(h, priceStore.getQuote(h.symbol)));
    const next = sortSymbols(metrics, sortKey, sortDir);
    const prev = previous.current;
    if (prev.length === next.length && prev.every((s, i) => s === next[i])) {
      return prev;
    }
    previous.current = next;
    return next;
    // `version` is the trigger to recompute against the latest prices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings, sortKey, sortDir, filter, priceDependent ? version : 0]);
}
