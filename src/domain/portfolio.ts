import { divRound, percentOf } from './money';
import type { Holding, OrderSide, Paise, Quote } from './types';

export interface PositionMetrics {
  symbol: string;
  qty: number;
  investedPaise: Paise;
  /** Average buy price rounded to the paisa, for display only. */
  avgPricePaise: Paise;
  ltpPaise: Paise | null;
  valuePaise: Paise | null;
  pnlPaise: Paise | null;
  pnlPct: number | null;
  dayPnlPaise: Paise | null;
}

export function avgPrice(holding: Holding): Paise {
  return holding.qty === 0 ? 0 : divRound(holding.investedPaise, holding.qty);
}

/** Every value that depends on a price is null when that price is unknown. Nothing is guessed. */
export function positionMetrics(holding: Holding, quote: Quote | undefined): PositionMetrics {
  const ltp = quote?.ltp ?? null;
  const prevClose = quote?.prevClose ?? null;
  const valuePaise = ltp === null ? null : ltp * holding.qty;
  const pnlPaise = valuePaise === null ? null : valuePaise - holding.investedPaise;
  const dayPnlPaise = ltp === null || prevClose === null ? null : (ltp - prevClose) * holding.qty;
  return {
    symbol: holding.symbol,
    qty: holding.qty,
    investedPaise: holding.investedPaise,
    avgPricePaise: avgPrice(holding),
    ltpPaise: ltp,
    valuePaise,
    pnlPaise,
    pnlPct: percentOf(pnlPaise, holding.investedPaise),
    dayPnlPaise,
  };
}

export interface PortfolioSummary {
  /** All totals below cover priced holdings only. */
  currentValuePaise: Paise;
  investedPaise: Paise;
  pnlPaise: Paise;
  pnlPct: number | null;
  /** Today's P&L over holdings that have both ltp and previous close. */
  dayPnlPaise: Paise | null;
  dayPnlPct: number | null;
  pricedCount: number;
  /** Holdings left out of the totals because there is no price for them. */
  unpriced: { symbol: string; investedPaise: Paise }[];
  /** Holdings that are priced but have no previous close, so are left out of today's P&L. */
  dayPnlExcluded: string[];
}

/**
 * Totals are sums of the exact integer row values, so they always match the rows as displayed.
 * Percentages are recomputed from the totals (summing row percentages would be wrong).
 */
export function summarize(holdings: readonly Holding[], getQuote: (symbol: string) => Quote | undefined): PortfolioSummary {
  let currentValue = 0;
  let invested = 0;
  let dayPnl = 0;
  let dayBase = 0;
  let dayCount = 0;
  let pricedCount = 0;
  const unpriced: PortfolioSummary['unpriced'] = [];
  const dayPnlExcluded: string[] = [];

  for (const h of holdings) {
    const m = positionMetrics(h, getQuote(h.symbol));
    if (m.valuePaise === null) {
      unpriced.push({ symbol: h.symbol, investedPaise: h.investedPaise });
      continue;
    }
    pricedCount += 1;
    currentValue += m.valuePaise;
    invested += h.investedPaise;
    if (m.dayPnlPaise === null) {
      dayPnlExcluded.push(h.symbol);
    } else {
      dayPnl += m.dayPnlPaise;
      dayBase += m.valuePaise - m.dayPnlPaise; // = prevClose * qty
      dayCount += 1;
    }
  }

  const pnl = currentValue - invested;
  return {
    currentValuePaise: currentValue,
    investedPaise: invested,
    pnlPaise: pnl,
    pnlPct: percentOf(pnl, invested),
    dayPnlPaise: dayCount === 0 ? null : dayPnl,
    dayPnlPct: dayCount === 0 ? null : percentOf(dayPnl, dayBase),
    pricedCount,
    unpriced,
    dayPnlExcluded,
  };
}

/** Buy: invested grows by exactly qty * fill price; the average is derived from it. */
export function applyBuy(existing: Holding | undefined, symbol: string, qty: number, fillPaise: Paise): Holding {
  assertWholePositive(qty);
  return {
    symbol,
    qty: (existing?.qty ?? 0) + qty,
    investedPaise: (existing?.investedPaise ?? 0) + qty * fillPaise,
  };
}

/**
 * Sell: the average price does not change. Invested cost is reduced proportionally
 * and rounded to the paisa. Returns null when the whole position is sold.
 */
export function applySell(existing: Holding, qty: number): Holding | null {
  assertWholePositive(qty);
  if (qty > existing.qty) {
    throw new Error(`Cannot sell ${qty}, only ${existing.qty} held`);
  }
  const remaining = existing.qty - qty;
  if (remaining === 0) {
    return null;
  }
  return {
    symbol: existing.symbol,
    qty: remaining,
    investedPaise: divRound(existing.investedPaise * remaining, existing.qty),
  };
}

function assertWholePositive(qty: number): void {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error(`Quantity must be a whole number above zero, got ${qty}`);
  }
}

export const MAX_ORDER_QTY = 1_000_000;

export type QtyValidation = { ok: true; qty: number } | { ok: false; error: string };

/** Validates the raw text from the quantity input. */
export function validateOrderQty(input: string, side: OrderSide, heldQty: number): QtyValidation {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { ok: false, error: 'Enter a quantity' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: 'Quantity must be a whole number' };
  }
  const qty = Number(trimmed);
  if (qty <= 0) {
    return { ok: false, error: 'Quantity must be above zero' };
  }
  if (qty > MAX_ORDER_QTY) {
    return { ok: false, error: `Maximum ${MAX_ORDER_QTY.toLocaleString('en-IN')} per order` };
  }
  if (side === 'sell' && qty > heldQty) {
    return { ok: false, error: heldQty === 0 ? 'You do not hold this stock' : `You only hold ${heldQty}` };
  }
  return { ok: true, qty };
}

export type SortKey = 'name' | 'value' | 'pnl';
export type SortDir = 'asc' | 'desc';

/**
 * Sorts holdings for display. Holdings whose sort value is unknown always go last,
 * whatever the direction, so "--" rows never jump to the top.
 */
export function sortSymbols(
  metrics: readonly PositionMetrics[],
  key: SortKey,
  dir: SortDir,
): string[] {
  const sign = dir === 'asc' ? 1 : -1;
  const valueOf = (m: PositionMetrics): number | null =>
    key === 'value' ? m.valuePaise : key === 'pnl' ? m.pnlPaise : null;

  return [...metrics]
    .sort((a, b) => {
      if (key === 'name') {
        return sign * a.symbol.localeCompare(b.symbol);
      }
      const va = valueOf(a);
      const vb = valueOf(b);
      if (va === null && vb === null) {
        return a.symbol.localeCompare(b.symbol);
      }
      if (va === null) {
        return 1;
      }
      if (vb === null) {
        return -1;
      }
      return va === vb ? a.symbol.localeCompare(b.symbol) : sign * (va - vb);
    })
    .map(m => m.symbol);
}

export function filterBySymbol<T extends { symbol: string }>(items: readonly T[], query: string): T[] {
  const q = query.trim().toUpperCase();
  return q === '' ? [...items] : items.filter(i => i.symbol.includes(q));
}
