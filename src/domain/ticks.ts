import { toPaise } from './money';
import type { Quote, Tick } from './types';

/**
 * Applies a partial tick to a quote.
 * Returns null when the tick must be ignored: unknown symbol, or a late/out-of-order tick
 * (seq not greater than the last applied seq for that symbol).
 */
export function applyTick(quote: Quote | undefined, lastSeq: number | undefined, tick: Tick): Quote | null {
  if (quote === undefined) {
    return null;
  }
  if (lastSeq !== undefined && tick.seq <= lastSeq) {
    return null;
  }
  const next: Quote = { ...quote };
  if (tick.ltp !== undefined) {
    const ltp = toPaise(tick.ltp);
    if (ltp !== null && ltp > 0) {
      next.ltp = ltp;
    }
  }
  if (tick.high !== undefined) {
    next.high = toPaise(tick.high) ?? next.high;
  }
  if (tick.low !== undefined) {
    next.low = toPaise(tick.low) ?? next.low;
  }
  if (tick.volume !== undefined && Number.isFinite(tick.volume)) {
    next.volume = tick.volume;
  }
  return next;
}

export function dayChange(quote: Quote | undefined): { abs: number | null; pct: number | null } {
  if (!quote || quote.ltp === null || quote.prevClose === null) {
    return { abs: null, pct: null };
  }
  const abs = quote.ltp - quote.prevClose;
  return { abs, pct: quote.prevClose === 0 ? null : (abs / quote.prevClose) * 100 };
}
