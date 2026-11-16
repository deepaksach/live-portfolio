import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_WATCHLIST } from '../data/symbols';
import { SEED_HOLDINGS } from '../data/seedHoldings';
import { applyBuy, applySell } from '../domain/portfolio';
import type { Holding, Order, OrderSide, Paise } from '../domain/types';

/**
 * "Cold" state: holdings, watchlist and order history. Changes only on user actions,
 * so a plain Zustand store with selectors is enough. Persisted to AsyncStorage.
 */
export interface PortfolioState {
  holdings: Holding[];
  watchlist: string[];
  orders: Order[];
  placeOrder: (symbol: string, side: OrderSide, qty: number, fillPaise: Paise) => Order;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  resetPortfolio: () => void;
}

/** Pure state transition, kept outside the store so it can be unit tested. */
export function holdingsAfterOrder(
  holdings: readonly Holding[],
  symbol: string,
  side: OrderSide,
  qty: number,
  fillPaise: Paise,
): Holding[] {
  const index = holdings.findIndex(h => h.symbol === symbol);
  const existing = index === -1 ? undefined : holdings[index];
  if (side === 'buy') {
    const next = applyBuy(existing, symbol, qty, fillPaise);
    return index === -1 ? [...holdings, next] : holdings.map((h, i) => (i === index ? next : h));
  }
  if (!existing) {
    throw new Error(`No holding in ${symbol} to sell`);
  }
  const next = applySell(existing, qty);
  return next === null ? holdings.filter((_, i) => i !== index) : holdings.map((h, i) => (i === index ? next : h));
}

let orderCounter = 0;

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      holdings: SEED_HOLDINGS,
      watchlist: DEFAULT_WATCHLIST,
      orders: [],
      placeOrder: (symbol, side, qty, fillPaise) => {
        const holdings = holdingsAfterOrder(get().holdings, symbol, side, qty, fillPaise);
        const order: Order = {
          id: `${Date.now()}-${++orderCounter}`,
          symbol,
          side,
          qty,
          pricePaise: fillPaise,
          at: Date.now(),
        };
        // Holdings and the order are updated in one set(), so Summary and rows can never disagree.
        set({ holdings, orders: [order, ...get().orders] });
        return order;
      },
      addToWatchlist: symbol =>
        set(s => (s.watchlist.includes(symbol) ? s : { watchlist: [...s.watchlist, symbol] })),
      removeFromWatchlist: symbol => set(s => ({ watchlist: s.watchlist.filter(w => w !== symbol) })),
      resetPortfolio: () => set({ holdings: SEED_HOLDINGS, orders: [] }),
    }),
    {
      name: 'live-portfolio',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: s => ({ holdings: s.holdings, watchlist: s.watchlist, orders: s.orders }),
    },
  ),
);

export const selectHolding = (symbol: string) => (s: PortfolioState) =>
  s.holdings.find(h => h.symbol === symbol);
