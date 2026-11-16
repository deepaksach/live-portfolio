import type { Paise } from './types';

/** Rupees (float from the wire) -> integer paise. Returns null for anything that is not a finite number. */
export function toPaise(rupees: unknown): Paise | null {
  if (typeof rupees !== 'number' || !Number.isFinite(rupees)) {
    return null;
  }
  // Math.round handles float noise such as 1319.59 * 100 = 131958.99999999999
  return Math.round(rupees * 100);
}

/** Integer division rounded half away from zero. Used wherever paise must be split. */
export function divRound(numerator: number, denominator: number): number {
  if (denominator === 0) {
    throw new Error('divRound: division by zero');
  }
  const q = numerator / denominator;
  return q < 0 ? -Math.round(-q) : Math.round(q);
}

/** Percentage (e.g. 12.34 for 12.34 %) or null when the base is unknown / zero. */
export function percentOf(part: Paise | null, base: Paise | null): number | null {
  if (part === null || base === null || base === 0) {
    return null;
  }
  return (part / base) * 100;
}

/** Round to the nearest exchange tick size (default 5 paise, like NSE). */
export function roundToTick(paise: number, tickSize: Paise = 5): Paise {
  return Math.max(tickSize, Math.round(paise / tickSize) * tickSize);
}
