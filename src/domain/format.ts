import type { Paise } from './types';

export const MISSING = '--';

/** Group an integer string the Indian way: 1234567 -> 12,34,567 */
function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) {
    return intDigits;
  }
  const last3 = intDigits.slice(-3);
  const rest = intDigits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

interface MoneyOptions {
  /** Show a leading + for positive values (used for P&L). */
  showPlus?: boolean;
}

/**
 * Format integer paise as Indian rupees: 123456789 -> "₹12,34,567.89".
 * Works on integers only, so there is no float formatting error and no dependency on Intl.
 */
export function formatINR(paise: Paise | null, opts: MoneyOptions = {}): string {
  if (paise === null || !Number.isFinite(paise)) {
    return MISSING;
  }
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100).toString();
  const fraction = (abs % 100).toString().padStart(2, '0');
  const body = `₹${groupIndian(rupees)}.${fraction}`;
  if (paise < 0 && abs !== 0) {
    return `-${body}`;
  }
  if (opts.showPlus && abs !== 0) {
    return `+${body}`;
  }
  return body;
}

/** 12.3456 -> "+12.35%", null -> "--" */
export function formatPercent(pct: number | null, opts: { showPlus?: boolean } = { showPlus: true }): string {
  if (pct === null || !Number.isFinite(pct)) {
    return MISSING;
  }
  const rounded = Math.round(pct * 100) / 100;
  const text = `${Math.abs(rounded).toFixed(2)}%`;
  if (rounded < 0) {
    return `-${text}`;
  }
  if (opts.showPlus && rounded > 0) {
    return `+${text}`;
  }
  return text;
}

/** Integer quantity / volume with Indian grouping. */
export function formatCount(n: number | null): string {
  if (n === null || !Number.isFinite(n)) {
    return MISSING;
  }
  const sign = n < 0 ? '-' : '';
  return sign + groupIndian(Math.abs(Math.round(n)).toString());
}

export type Trend = 'up' | 'down' | 'flat' | 'unknown';

export function trendOf(value: number | null): Trend {
  if (value === null) {
    return 'unknown';
  }
  if (value > 0) {
    return 'up';
  }
  if (value < 0) {
    return 'down';
  }
  return 'flat';
}
