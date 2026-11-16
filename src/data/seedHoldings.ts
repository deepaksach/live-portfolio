import { toPaise } from '../domain/money';
import type { Holding } from '../domain/types';

/** Starting holdings bundled with the app, exactly as given in the brief. OLDCO is deliberate. */
export const SEED_HOLDINGS_CSV = `symbol,qty,avgPrice
RELIANCE,25,1319.59
TCS,40,2589.71
HDFCBANK,10,755.86
INFY,10,1114.7
ICICIBANK,5,1566.04
SBIN,15,800.62
BHARTIARTL,40,1890.8
ITC,15,225.74
LT,40,3250.32
HINDUNILVR,100,1605.15
KOTAKBANK,15,474.57
AXISBANK,100,1378.55
BAJFINANCE,100,951.52
MARUTI,5,13017.25
SUNPHARMA,5,1784.28
TITAN,12,4061.93
ASIANPAINT,12,2316.35
ULTRACEMCO,100,10181.27
WIPRO,12,169.36
NTPC,100,326
OLDCO,30,412.5`;

/** Parses the holdings CSV. Invalid lines throw: bad seed data should fail loudly, not silently. */
export function parseHoldingsCsv(csv: string): Holding[] {
  const lines = csv.trim().split(/\r?\n/);
  const [header, ...rows] = lines;
  if (header?.trim() !== 'symbol,qty,avgPrice') {
    throw new Error(`Unexpected holdings header: ${header ?? ''}`);
  }
  return rows.map((line, i) => {
    const [symbol, qtyText, avgText] = line.split(',').map(s => s.trim());
    const qty = Number(qtyText);
    const avgPaise = toPaise(Number(avgText));
    if (!symbol || !Number.isInteger(qty) || qty <= 0 || avgPaise === null || avgPaise <= 0) {
      throw new Error(`Invalid holdings row ${i + 2}: ${line}`);
    }
    return { symbol: symbol.toUpperCase(), qty, investedPaise: qty * avgPaise };
  });
}

export const SEED_HOLDINGS: Holding[] = parseHoldingsCsv(SEED_HOLDINGS_CSV);
