"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RealtimeStockService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeStockService = void 0;
const common_1 = require("@nestjs/common");
const events_1 = require("events");
let RealtimeStockService = RealtimeStockService_1 = class RealtimeStockService {
    constructor() {
        this.emitter = new events_1.EventEmitter();
    }
    publishStockChanged(seed) {
        const payload = Object.assign(Object.assign({}, seed), { stockStatus: this.calcStockStatus(seed.quantityOnHand, seed.reorderLevel), changedAt: new Date() });
        this.emitter.emit(RealtimeStockService_1.EVENT_NAME, payload);
    }
    onStockChanged(listener) {
        this.emitter.on(RealtimeStockService_1.EVENT_NAME, listener);
        return () => this.emitter.off(RealtimeStockService_1.EVENT_NAME, listener);
    }
    asyncIterator() {
        const pullQueue = [];
        const pushQueue = [];
        const pushValue = (value) => {
            const resolver = pullQueue.shift();
            if (resolver) {
                resolver({ value, done: false });
                return;
            }
            pushQueue.push(value);
        };
        const onEvent = (event) => pushValue({ stockChanged: event });
        this.emitter.on(RealtimeStockService_1.EVENT_NAME, onEvent);
        let listening = true;
        const cleanup = () => {
            if (!listening)
                return;
            listening = false;
            this.emitter.off(RealtimeStockService_1.EVENT_NAME, onEvent);
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
            throw: (err) => {
                cleanup();
                return Promise.reject(err);
            },
            [Symbol.asyncIterator]() {
                return this;
            },
        };
    }
    calcStockStatus(quantityOnHand, reorderLevel) {
        if (quantityOnHand <= 0)
            return 'out';
        if (quantityOnHand <= Math.max(1, Math.floor(reorderLevel * 0.2)))
            return 'critical';
        if (quantityOnHand <= reorderLevel)
            return 'low';
        return 'ok';
    }
};
exports.RealtimeStockService = RealtimeStockService;
RealtimeStockService.EVENT_NAME = 'stock.changed';
exports.RealtimeStockService = RealtimeStockService = RealtimeStockService_1 = __decorate([
    (0, common_1.Injectable)()
], RealtimeStockService);
//# sourceMappingURL=realtime-stock.service.js.map