/**
 * Money is stored as integer paise (1 rupee = 100 paise) everywhere in the app.
 * Floats are only used at the edges: parsing the API and the tick wire format.
 * `null` always means "unknown" – it is never replaced by 0.
 */
export type Paise = number;

export interface Quote {
  symbol: string;
  ltp: Paise | null;
  open: Paise | null;
  high: Paise | null;
  low: Paise | null;
  prevClose: Paise | null;
  volume: number | null;
}

/** We store the total amount invested, not the average price, so totals never drift. */
export interface Holding {
  symbol: string;
  qty: number;
  investedPaise: Paise;
}

export type OrderSide = 'buy' | 'sell';

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  qty: number;
  pricePaise: Paise;
  at: number;
}

/** Partial update coming off the (simulated) socket. Prices are in rupees, like a real feed. */
export interface Tick {
  symbol: string;
  seq: number;
  ltp?: number;
  high?: number;
  low?: number;
  volume?: number;
}
