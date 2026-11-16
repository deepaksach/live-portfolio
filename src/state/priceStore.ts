import { applyTick } from '../domain/ticks';
import type { Quote, Tick } from '../domain/types';

type Listener = () => void;
type Schedule = (flush: () => void) => void;

const defaultSchedule: Schedule = flush => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => flush());
  } else {
    setTimeout(flush, 16);
  }
};

/**
 * "Hot" state: live quotes, kept outside React.
 *
 * - Each symbol has its own listener set, so a tick for TCS only wakes up components showing TCS.
 * - Notifications are batched to one flush per animation frame, so several ticks inside one
 *   frame cause a single React commit.
 * - Late / out-of-order ticks are dropped using the per-symbol seq.
 *
 * Components read it through useSyncExternalStore (see hooks.ts).
 */
export class PriceStore {
  private readonly quotes = new Map<string, Quote>();
  private readonly lastSeq = new Map<string, number>();
  private readonly symbolListeners = new Map<string, Set<Listener>>();
  private readonly anyListeners = new Set<Listener>();
  private readonly dirty = new Set<string>();
  private flushScheduled = false;
  private lastTickAt = 0;
  private version = 0;

  constructor(
    private readonly schedule: Schedule = defaultSchedule,
    private readonly now: () => number = Date.now,
  ) {}

  getQuote = (symbol: string): Quote | undefined => this.quotes.get(symbol);

  getVersion = (): number => this.version;

  /** Time of the last accepted tick, 0 if none yet. */
  getLastTickAt = (): number => this.lastTickAt;

  hasSnapshot(): boolean {
    return this.quotes.size > 0;
  }

  /** Apply a REST snapshot. Sequence numbers are kept, so late ticks are still rejected afterwards. */
  setSnapshot(quotes: readonly Quote[]): void {
    for (const q of quotes) {
      this.quotes.set(q.symbol, q);
      this.dirty.add(q.symbol);
    }
    this.requestFlush();
  }

  /** Returns true when the tick was applied, false when it was ignored. */
  applyTick = (tick: Tick): boolean => {
    const next = applyTick(this.quotes.get(tick.symbol), this.lastSeq.get(tick.symbol), tick);
    if (next === null) {
      return false;
    }
    this.lastSeq.set(tick.symbol, tick.seq);
    this.quotes.set(tick.symbol, next);
    this.lastTickAt = this.now();
    this.dirty.add(tick.symbol);
    this.requestFlush();
    return true;
  };

  subscribe(symbol: string, listener: Listener): () => void {
    let set = this.symbolListeners.get(symbol);
    if (!set) {
      set = new Set();
      this.symbolListeners.set(symbol, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  /** For consumers that need every price (summary, sorting). They should throttle themselves. */
  subscribeAll(listener: Listener): () => void {
    this.anyListeners.add(listener);
    return () => {
      this.anyListeners.delete(listener);
    };
  }

  private requestFlush(): void {
    if (this.flushScheduled) {
      return;
    }
    this.flushScheduled = true;
    this.schedule(this.flush);
  }

  /** Exposed for tests. */
  flush = (): void => {
    this.flushScheduled = false;
    if (this.dirty.size === 0) {
      return;
    }
    this.version += 1;
    const symbols = [...this.dirty];
    this.dirty.clear();
    for (const s of symbols) {
      this.symbolListeners.get(s)?.forEach(l => l());
    }
    this.anyListeners.forEach(l => l());
  };
}
