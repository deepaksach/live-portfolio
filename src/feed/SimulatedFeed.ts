import { roundToTick } from '../domain/money';
import type { Paise, Quote, Tick } from '../domain/types';
import type { PriceFeed, TickHandler, Unsubscribe } from './PriceFeed';

export interface SimulatorOptions {
  /** Ticks per second across all symbols. */
  ticksPerSecond?: number;
  /** Max move per tick as a fraction (0.002 = ±0.2 %). */
  maxMove?: number;
  /** Share of ticks delivered late and out of order. */
  lateRatio?: number;
  /** Average gap between silences, and how long each silence lasts. */
  silenceEveryMs?: number;
  silenceForMs?: number;
  random?: () => number;
  now?: () => number;
}

interface SimState {
  ltp: Paise;
  high: Paise;
  low: Paise;
  volume: number;
  seq: number;
  /** After a tick was held back, the next one carries every field so nothing is lost. */
  sendFull: boolean;
}

/**
 * Behaves like a socket client: connect / disconnect / onTick.
 * It keeps its own copy of "exchange" prices, seeded from the REST snapshot,
 * and emits partial ticks on top of them.
 */
export class SimulatedFeed implements PriceFeed {
  private readonly handlers = new Set<TickHandler>();
  private readonly state = new Map<string, SimState>();
  private readonly pending = new Set<ReturnType<typeof setTimeout>>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextSilenceAt = 0;
  private silentUntil = 0;

  private readonly intervalMs: number;
  private readonly maxMove: number;
  private readonly lateRatio: number;
  private readonly silenceEveryMs: number;
  private readonly silenceForMs: number;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(opts: SimulatorOptions = {}) {
    this.intervalMs = 1000 / (opts.ticksPerSecond ?? 20);
    this.maxMove = opts.maxMove ?? 0.002;
    this.lateRatio = opts.lateRatio ?? 0.02;
    this.silenceEveryMs = opts.silenceEveryMs ?? 60_000;
    this.silenceForMs = opts.silenceForMs ?? 5_000;
    this.random = opts.random ?? Math.random;
    this.now = opts.now ?? Date.now;
  }

  /** Simulator-only: (re)seed exchange prices from a REST snapshot. Sequence numbers keep counting. */
  seed(quotes: readonly Quote[]): void {
    for (const q of quotes) {
      if (q.ltp === null) {
        continue; // never invent a price for a symbol the API did not price
      }
      const prev = this.state.get(q.symbol);
      this.state.set(q.symbol, {
        ltp: q.ltp,
        high: Math.max(q.high ?? q.ltp, q.ltp),
        low: Math.min(q.low ?? q.ltp, q.ltp),
        volume: q.volume ?? 0,
        seq: prev?.seq ?? 0,
        sendFull: true,
      });
    }
  }

  connect(): void {
    if (this.timer !== null) {
      return;
    }
    this.scheduleNextSilence();
    this.timer = setInterval(() => this.step(), this.intervalMs);
  }

  disconnect(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.pending.forEach(clearTimeout);
    this.pending.clear();
  }

  onTick(handler: TickHandler): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  get isConnected(): boolean {
    return this.timer !== null;
  }

  /** Dev helper: go silent right now. */
  forceSilence(ms = this.silenceForMs): void {
    this.silentUntil = this.now() + ms;
  }

  private scheduleNextSilence(): void {
    // 0.75x – 1.25x of the average gap, so it is "roughly once a minute"
    this.nextSilenceAt = this.now() + this.silenceEveryMs * (0.75 + this.random() * 0.5);
  }

  private step(): void {
    const now = this.now();
    if (now < this.silentUntil) {
      return;
    }
    if (now >= this.nextSilenceAt) {
      this.silentUntil = now + this.silenceForMs;
      this.scheduleNextSilence();
      this.nextSilenceAt += this.silenceForMs;
      return;
    }
    const symbols = [...this.state.keys()];
    if (symbols.length === 0) {
      return;
    }
    const symbol = symbols[Math.floor(this.random() * symbols.length)];
    if (symbol === undefined) {
      return;
    }
    const tick = this.nextTick(symbol);
    if (tick === null) {
      return;
    }
    if (this.random() < this.lateRatio) {
      // Hold this tick back; a newer tick for the symbol (carrying all fields) overtakes it.
      const s = this.state.get(symbol);
      if (s) {
        s.sendFull = true;
      }
      const t = setTimeout(() => {
        this.pending.delete(t);
        this.emit(tick);
      }, 300 + this.random() * 700);
      this.pending.add(t);
      // Emit the overtaking tick straight away, so the held one is guaranteed to arrive out of order.
      const overtaking = this.nextTick(symbol);
      if (overtaking !== null) {
        this.emit(overtaking);
      }
      return;
    }
    this.emit(tick);
  }

  private nextTick(symbol: string): Tick | null {
    const s = this.state.get(symbol);
    if (!s) {
      return null;
    }
    const move = (this.random() * 2 - 1) * this.maxMove;
    const ltp = roundToTick(s.ltp * (1 + move));
    const full = s.sendFull;
    const tick: Tick = { symbol, seq: ++s.seq };

    if (ltp !== s.ltp || full) {
      s.ltp = ltp;
      tick.ltp = ltp / 100;
    }
    if (ltp > s.high || full) {
      s.high = Math.max(s.high, ltp);
      tick.high = s.high / 100;
    }
    if (ltp < s.low || full) {
      s.low = Math.min(s.low, ltp);
      tick.low = s.low / 100;
    }
    if (this.random() < 0.7 || full) {
      s.volume += 1 + Math.floor(this.random() * 500);
      tick.volume = s.volume;
    }
    s.sendFull = false;
    return tick;
  }

  private emit(tick: Tick): void {
    this.handlers.forEach(h => h(tick));
  }
}
