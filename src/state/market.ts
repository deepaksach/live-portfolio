import { create } from 'zustand';
import type { Quote } from '../domain/types';
import type { PriceFeed } from '../feed/PriceFeed';
import type { PriceStore } from './priceStore';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface MarketState {
  status: LoadStatus;
  error: string | null;
  refreshing: boolean;
  /** A failed pull-to-refresh keeps the existing prices and shows this instead. */
  refreshError: string | null;
}

export const useMarketStore = create<MarketState>(() => ({
  status: 'idle',
  error: null,
  refreshing: false,
  refreshError: null,
}));

export interface MarketDeps {
  priceStore: PriceStore;
  feed: PriceFeed;
  fetchQuotes: (symbols: readonly string[]) => Promise<Quote[]>;
  /** Symbols to ask the API for (the 25 + anything held or watched). */
  getSymbols: () => string[];
  /** Simulator only: re-base simulated prices on the fresh snapshot. A real socket would not need this. */
  onSnapshot?: (quotes: Quote[]) => void;
}

/**
 * Orchestrates REST + live feed: fetch once on start and on refresh, then let the feed tick.
 * Screens only talk to the stores; they never know where prices come from.
 */
export function createMarket(deps: MarketDeps) {
  let unsubscribeTicks: (() => void) | null = null;
  let active = false;

  const ensureFeed = () => {
    if (!unsubscribeTicks) {
      unsubscribeTicks = deps.feed.onTick(deps.priceStore.applyTick);
    }
    if (active) {
      deps.feed.connect();
    }
  };

  const load = async (isRefresh: boolean) => {
    const set = useMarketStore.setState;
    if (isRefresh) {
      set({ refreshing: true, refreshError: null });
    } else {
      set({ status: 'loading', error: null });
    }
    try {
      const quotes = await deps.fetchQuotes(deps.getSymbols());
      deps.priceStore.setSnapshot(quotes);
      deps.onSnapshot?.(quotes);
      set({ status: 'ready', error: null, refreshing: false, refreshError: null });
      ensureFeed();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong';
      if (isRefresh && deps.priceStore.hasSnapshot()) {
        set({ refreshing: false, refreshError: message });
      } else {
        set({ status: 'error', error: message, refreshing: false });
      }
    }
  };

  return {
    start: () => {
      active = true;
      return load(false);
    },
    retry: () => load(false),
    refresh: () => load(true),
    /** App went to background: stop ticking. */
    pause: () => {
      active = false;
      deps.feed.disconnect();
    },
    resume: () => {
      active = true;
      if (deps.priceStore.hasSnapshot()) {
        ensureFeed();
      }
    },
  };
}

export type Market = ReturnType<typeof createMarket>;
