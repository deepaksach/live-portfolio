import { toPaise } from '../domain/money';
import type { Quote } from '../domain/types';

const OHLC_URL = 'https://api.v2.liquide.life/api/markets/ohlc';
const TIMEOUT_MS = 10_000;

export class OhlcError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'OhlcError';
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Turns one raw API row into a Quote. Any field that is missing or not a number becomes null. */
export function parseOhlcRow(row: unknown): Quote | null {
  if (!isRecord(row) || typeof row.symbol !== 'string' || row.symbol === '') {
    return null;
  }
  const ltp = toPaise(row.ltp);
  const volume = typeof row.volume === 'number' && Number.isFinite(row.volume) ? row.volume : null;
  return {
    symbol: row.symbol.toUpperCase(),
    // A price of 0 is not a real price for a listed stock: treat it as unknown, never as zero.
    ltp: ltp !== null && ltp > 0 ? ltp : null,
    open: positiveOrNull(toPaise(row.open)),
    high: positiveOrNull(toPaise(row.high)),
    low: positiveOrNull(toPaise(row.low)),
    prevClose: positiveOrNull(toPaise(row.prevClose)),
    volume,
  };
}

function positiveOrNull(v: number | null): number | null {
  return v !== null && v > 0 ? v : null;
}

/** Response shape: { status, code, message: { data: [...] } }. Symbols the API does not know are simply absent. */
export function parseOhlcResponse(body: unknown): Quote[] {
  if (!isRecord(body) || !isRecord(body.message) || !Array.isArray(body.message.data)) {
    throw new OhlcError('Unexpected response from price server');
  }
  return body.message.data.map(parseOhlcRow).filter((q): q is Quote => q !== null);
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** One POST for all symbols. Called once at start and on pull-to-refresh, never polled. */
export async function fetchQuotes(symbols: readonly string[], fetchFn: FetchFn = fetch): Promise<Quote[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(OHLC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbols }),
      signal: controller.signal,
    });
    // The API answers 201 on success; accept any 2xx.
    if (!res.ok) {
      throw new OhlcError(`Price server returned ${res.status}`, res.status);
    }
    return parseOhlcResponse(await res.json());
  } catch (e) {
    if (e instanceof OhlcError) {
      throw e;
    }
    if (e instanceof Error && e.name === 'AbortError') {
      throw new OhlcError('Price server timed out');
    }
    throw new OhlcError('Could not reach the price server. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
}
