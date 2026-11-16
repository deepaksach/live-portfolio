import type { Tick } from '../domain/types';

export type TickHandler = (tick: Tick) => void;
export type Unsubscribe = () => void;

/**
 * What the app needs from a live price source. The simulator implements this today;
 * a WebSocket client would implement the same three methods and nothing else changes.
 */
export interface PriceFeed {
  connect(): void;
  disconnect(): void;
  onTick(handler: TickHandler): Unsubscribe;
}
