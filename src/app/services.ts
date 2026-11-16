import { fetchQuotes } from '../data/ohlcClient';
import { SYMBOLS } from '../data/symbols';
import { SimulatedFeed } from '../feed/SimulatedFeed';
import { createMarket } from '../state/market';
import { usePortfolioStore } from '../state/portfolioStore';
import { PriceStore } from '../state/priceStore';

/**
 * The one place where the app is wired together.
 * To use a real socket, replace `new SimulatedFeed()` with a class implementing PriceFeed
 * and drop `onSnapshot`. Nothing else changes.
 */
export const priceStore = new PriceStore();
export const simulatedFeed = new SimulatedFeed();

export const market = createMarket({
  priceStore,
  feed: simulatedFeed,
  fetchQuotes,
  getSymbols: () => {
    const { holdings, watchlist } = usePortfolioStore.getState();
    return [...new Set([...SYMBOLS, ...holdings.map(h => h.symbol), ...watchlist])];
  },
  onSnapshot: quotes => simulatedFeed.seed(quotes),
});
