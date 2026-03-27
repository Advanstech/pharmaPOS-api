import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface StockChangedEventPayload {
  productId: string;
  branchId: string;
  quantityOnHand: number;
  reorderLevel: number;
  stockStatus: string;
  changedAt: Date;
}

interface StockChangedSeed {
  productId: string;
  branchId: string;
  quantityOnHand: number;
  reorderLevel: number;
}

@Injectable()
export class RealtimeStockService {
  private static readonly EVENT_NAME = 'stock.changed';
  private readonly emitter = new EventEmitter();

  publishStockChanged(seed: StockChangedSeed): void {
    const payload: StockChangedEventPayload = {
      ...seed,
      stockStatus: this.calcStockStatus(seed.quantityOnHand, seed.reorderLevel),
      changedAt: new Date(),
    };
    this.emitter.emit(RealtimeStockService.EVENT_NAME, payload);
  }

  onStockChanged(listener: (payload: StockChangedEventPayload) => void): () => void {
    this.emitter.on(RealtimeStockService.EVENT_NAME, listener);
    return () => this.emitter.off(RealtimeStockService.EVENT_NAME, listener);
  }

  asyncIterator(): AsyncIterableIterator<{ stockChanged: StockChangedEventPayload }> {
    const pullQueue: Array<(result: IteratorResult<{ stockChanged: StockChangedEventPayload }>) => void> = [];
    const pushQueue: Array<{ stockChanged: StockChangedEventPayload }> = [];

    const pushValue = (value: { stockChanged: StockChangedEventPayload }) => {
      const resolver = pullQueue.shift();
      if (resolver) {
        resolver({ value, done: false });
        return;
      }
      pushQueue.push(value);
    };

    const onEvent = (event: StockChangedEventPayload) => pushValue({ stockChanged: event });
    this.emitter.on(RealtimeStockService.EVENT_NAME, onEvent);
    let listening = true;

    const cleanup = () => {
      if (!listening) return;
      listening = false;
      this.emitter.off(RealtimeStockService.EVENT_NAME, onEvent);
    };

    return {
      next: () => {
        if (!listening) {
          return Promise.resolve({ value: undefined, done: true });
        }
        const value = pushQueue.shift();
        if (value) {
          return Promise.resolve({ value, done: false });
        }
        return new Promise((resolve) => {
          pullQueue.push(resolve);
        });
      },
      return: () => {
        cleanup();
        return Promise.resolve({ value: undefined, done: true });
      },
      throw: (err: unknown) => {
        cleanup();
        return Promise.reject(err);
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }

  private calcStockStatus(quantityOnHand: number, reorderLevel: number): string {
    if (quantityOnHand <= 0) return 'out';
    if (quantityOnHand <= Math.max(1, Math.floor(reorderLevel * 0.2))) return 'critical';
    if (quantityOnHand <= reorderLevel) return 'low';
    return 'ok';
  }
}
