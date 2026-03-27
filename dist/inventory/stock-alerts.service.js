"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var StockAlertsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockAlertsService = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const typeorm_1 = require("typeorm");
const notifications_service_1 = require("../notifications/notifications.service");
const realtime_stock_service_1 = require("./realtime-stock.service");
let StockAlertsService = StockAlertsService_1 = class StockAlertsService {
    constructor(realtimeStock, notifications, dataSource, cache) {
        this.realtimeStock = realtimeStock;
        this.notifications = notifications;
        this.dataSource = dataSource;
        this.cache = cache;
        this.logger = new common_1.Logger(StockAlertsService_1.name);
        this.unsubscribe = null;
    }
    onModuleInit() {
        this.unsubscribe = this.realtimeStock.onStockChanged((payload) => {
            void this.processStockEvent(payload);
        });
    }
    onModuleDestroy() {
        if (this.unsubscribe)
            this.unsubscribe();
    }
    async processStockEvent(event) {
        if (event.stockStatus === 'ok')
            return;
        const status = event.stockStatus;
        const cooldownKey = `stock-alert:${event.branchId}:${event.productId}:${status}`;
        const recent = await this.cache.get(cooldownKey);
        if (recent)
            return;
        await this.cache.set(cooldownKey, true, 30 * 60 * 1000);
        const [product] = await this.dataSource.query(`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        s.id AS supplier_id,
        s.name AS supplier_name,
        s.phone AS supplier_phone,
        s.email AS supplier_email
      FROM products p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.id = $1
      LIMIT 1
    `, [event.productId]);
        if (!product)
            return;
        const recipients = await this.dataSource.query(`
      SELECT id, name, email, phone, role
      FROM users
      WHERE branch_id = $1
        AND is_active = true
        AND role = ANY($2)
    `, [event.branchId, ['owner', 'se_admin', 'manager', 'head_pharmacist']]);
        if (recipients.length === 0)
            return;
        const suggestedReorderQty = this.suggestReorderQty(event.reorderLevel, event.quantityOnHand, status);
        const supplierHint = product.supplier_name
            ? `Supplier: ${product.supplier_name}${product.supplier_phone ? ` (${product.supplier_phone})` : ''}.`
            : 'Supplier not linked yet.';
        const subject = `[Stock Alert] ${product.product_name} is ${status.toUpperCase()}`;
        const message = `${product.product_name} is ${status.toUpperCase()} at ${event.quantityOnHand} left (reorder ${event.reorderLevel}). ${supplierHint} Suggested reorder: ${suggestedReorderQty}.`;
        for (const recipient of recipients) {
            const channels = ['in_app'];
            await this.dataSource.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'LOW_STOCK_ALERT_NOTIFICATION', 'product', $3, $4)
      `, [
                event.branchId,
                recipient.id,
                event.productId,
                JSON.stringify({
                    productId: product.product_id,
                    productName: product.product_name,
                    stockStatus: status,
                    quantityOnHand: event.quantityOnHand,
                    reorderLevel: event.reorderLevel,
                    suggestedReorderQty,
                    supplierId: product.supplier_id,
                    supplierName: product.supplier_name,
                    supplierPhone: product.supplier_phone,
                    supplierEmail: product.supplier_email,
                    channels,
                    message,
                    changedAt: event.changedAt.toISOString(),
                }),
            ]);
            if (recipient.email && this.notifications.isEmailConfigured()) {
                try {
                    await this.notifications.sendEmail({
                        to: recipient.email,
                        subject,
                        html: `
              <h3>${subject}</h3>
              <p>${message}</p>
              <p><strong>Branch:</strong> ${event.branchId}</p>
              <p><strong>Triggered:</strong> ${event.changedAt.toISOString()}</p>
            `,
                    });
                    channels.push('email');
                }
                catch (error) {
                    this.logger.warn(`Email alert failed for ${recipient.email}: ${String(error)}`);
                }
            }
            const normalizedPhone = this.normalizeGhPhone(recipient.phone);
            if (normalizedPhone && this.notifications.isSmsConfigured()) {
                try {
                    await this.notifications.sendSms({
                        to: normalizedPhone,
                        message,
                        customerId: recipient.id,
                    });
                    channels.push('sms');
                }
                catch (error) {
                    this.logger.warn(`SMS alert failed for ${normalizedPhone}: ${String(error)}`);
                }
                if (this.notifications.isWhatsAppConfigured()) {
                    try {
                        await this.notifications.sendWhatsApp({
                            to: normalizedPhone,
                            message,
                        });
                        channels.push('whatsapp');
                    }
                    catch (error) {
                        this.logger.warn(`WhatsApp alert failed for ${normalizedPhone}: ${String(error)}`);
                    }
                }
            }
            if (channels.length > 1) {
                await this.dataSource.query(`
          INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
          VALUES (gen_random_uuid(), $1, $2, 'LOW_STOCK_ALERT_DELIVERY', 'product', $3, $4)
        `, [
                    event.branchId,
                    recipient.id,
                    event.productId,
                    JSON.stringify({
                        productId: product.product_id,
                        stockStatus: status,
                        channels: channels.filter((c) => c !== 'in_app'),
                        changedAt: event.changedAt.toISOString(),
                    }),
                ]);
            }
        }
    }
    suggestReorderQty(reorderLevel, quantityOnHand, status) {
        const buffer = status === 'out' ? 3 : status === 'critical' ? 2.5 : 2;
        const target = Math.max(Math.ceil(reorderLevel * buffer), reorderLevel + 5);
        return Math.max(0, target - quantityOnHand);
    }
    normalizeGhPhone(phone) {
        if (!phone)
            return null;
        const digits = phone.replace(/[^\d+]/g, '');
        if (digits.startsWith('+233'))
            return digits;
        if (digits.startsWith('233'))
            return `+${digits}`;
        if (digits.startsWith('0') && digits.length >= 10)
            return `+233${digits.slice(1)}`;
        return null;
    }
};
exports.StockAlertsService = StockAlertsService;
exports.StockAlertsService = StockAlertsService = StockAlertsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [realtime_stock_service_1.RealtimeStockService,
        notifications_service_1.NotificationsService,
        typeorm_1.DataSource, Object])
], StockAlertsService);
//# sourceMappingURL=stock-alerts.service.js.map