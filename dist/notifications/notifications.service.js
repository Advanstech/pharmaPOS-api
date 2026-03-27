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
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const common_2 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const constants_1 = require("../config/constants");
const typeorm_1 = require("typeorm");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    constructor(config, dataSource, cache) {
        this.config = config;
        this.dataSource = dataSource;
        this.cache = cache;
        this.logger = new common_1.Logger(NotificationsService_1.name);
        this.hubtelClientId = this.config.get('HUBTEL_CLIENT_ID') || '';
        this.hubtelClientSecret = this.config.get('HUBTEL_CLIENT_SECRET') || '';
        this.emailProvider = this.config.get('EMAIL_PROVIDER') || 'resend';
        this.emailApiKey = this.config.get('EMAIL_API_KEY') || '';
        const envFrom = this.config.get('EMAIL_FROM') || '';
        this.emailFrom = envFrom || (this.emailProvider === 'resend'
            ? 'PharmaPOS <onboarding@resend.dev>'
            : 'PharmaPOS <noreply@pharmapos.com>');
        this.whatsappWebhookUrl = this.config.get('WHATSAPP_WEBHOOK_URL') || '';
        this.whatsappFallbackToSms = (this.config.get('WHATSAPP_FALLBACK_TO_SMS') || 'true') !== 'false';
    }
    async sendEmail(params) {
        const { to, subject, html, from = this.emailFrom } = params;
        if (!this.emailApiKey) {
            this.logger.warn(`EMAIL_API_KEY missing; skipped email to ${to}`);
            return;
        }
        try {
            if (this.emailProvider === 'resend') {
                await this.sendViaResend({ to, subject, html, from });
            }
            else if (this.emailProvider === 'sendgrid') {
                await this.sendViaSendGrid({ to, subject, html, from });
            }
            else if (this.emailProvider === 'ses') {
                await this.sendViaSES({ to, subject, html, from });
            }
            else {
                this.logger.warn(`Email provider ${this.emailProvider} not configured — email not sent`);
            }
        }
        catch (error) {
            this.logger.error(`Failed to send email to ${to}:`, error);
            throw error;
        }
    }
    async sendSms(params) {
        const { to, message, customerId } = params;
        if (!this.hubtelClientId || !this.hubtelClientSecret) {
            this.logger.warn(`Hubtel not configured; skipped SMS to ${to}`);
            return;
        }
        if (customerId) {
            const rateLimitKey = `sms:rate:${customerId}:${new Date().toISOString().split('T')[0]}`;
            const count = (await this.cache.get(rateLimitKey)) || 0;
            if (count >= constants_1.SMS_CONFIG.maxPerCustomerPerDay) {
                this.logger.warn(`SMS rate limit exceeded for customer ${customerId}`);
                throw new Error('SMS_RATE_LIMIT_EXCEEDED');
            }
            await this.cache.set(rateLimitKey, count + 1, 86400000);
        }
        try {
            await this.sendViaHubtel({ to, message });
        }
        catch (error) {
            this.logger.error(`Failed to send SMS to ${to}:`, error);
            throw error;
        }
    }
    async sendWelcomeEmail(email, name) {
        const html = `
      <h1>Welcome to PharmaPOS Pro, ${name}!</h1>
      <p>Your account has been created successfully.</p>
      <p>Start managing your pharmacy operations with ease.</p>
    `;
        await this.sendEmail({ to: email, subject: 'Welcome to PharmaPOS Pro', html });
    }
    async sendRxReadyNotification(phone, customerName, customerId) {
        const message = `Hi ${customerName}, your prescription is ready for collection at Azzay Pharmacy. ${constants_1.SMS_CONFIG.senderId}`;
        await this.sendSms({ to: phone, message, customerId });
    }
    async sendMoMoConfirmation(phone, amount, reference, customerId) {
        const message = `Payment of GH₵${(amount / 100).toFixed(2)} received. Ref: ${reference}. Thank you! ${constants_1.SMS_CONFIG.senderId}`;
        await this.sendSms({ to: phone, message, customerId });
    }
    async sendLowStockAlert(phone, productName, currentStock) {
        const message = `LOW STOCK ALERT: ${productName} has only ${currentStock} units remaining. Reorder now. ${constants_1.SMS_CONFIG.senderId}`;
        await this.sendSms({ to: phone, message });
    }
    isWhatsAppConfigured() {
        return Boolean(this.whatsappWebhookUrl);
    }
    isEmailConfigured() {
        return Boolean(this.emailApiKey);
    }
    isSmsConfigured() {
        return Boolean(this.hubtelClientId && this.hubtelClientSecret);
    }
    async sendWhatsApp(params) {
        if (!this.whatsappWebhookUrl) {
            if (this.whatsappFallbackToSms) {
                await this.sendSms({ to: params.to, message: params.message });
            }
            return;
        }
        const response = await fetch(this.whatsappWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: params.to,
                message: params.message,
                channel: 'whatsapp',
            }),
        });
        if (!response.ok) {
            throw new Error(`WhatsApp webhook error: ${response.statusText}`);
        }
    }
    async getMyStockAlerts(userId, branchId, limit = 20) {
        const rows = await this.dataSource.query(`
      SELECT id, metadata, created_at
      FROM audit_logs
      WHERE branch_id = $1
        AND user_id = $2
        AND type = 'LOW_STOCK_ALERT_NOTIFICATION'
      ORDER BY created_at DESC
      LIMIT $3
    `, [branchId, userId, limit]);
        return rows.map((row) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const m = ((_a = row.metadata) !== null && _a !== void 0 ? _a : {});
            return {
                id: row.id,
                productId: String((_b = m.productId) !== null && _b !== void 0 ? _b : ''),
                productName: String((_c = m.productName) !== null && _c !== void 0 ? _c : 'Unknown product'),
                stockStatus: String((_d = m.stockStatus) !== null && _d !== void 0 ? _d : 'low'),
                quantityOnHand: Number((_e = m.quantityOnHand) !== null && _e !== void 0 ? _e : 0),
                reorderLevel: Number((_f = m.reorderLevel) !== null && _f !== void 0 ? _f : 0),
                suggestedReorderQty: Number((_g = m.suggestedReorderQty) !== null && _g !== void 0 ? _g : 0),
                supplierId: m.supplierId ? String(m.supplierId) : undefined,
                supplierName: m.supplierName ? String(m.supplierName) : undefined,
                supplierPhone: m.supplierPhone ? String(m.supplierPhone) : undefined,
                channels: Array.isArray(m.channels) ? m.channels.map(String) : ['in_app'],
                message: String((_h = m.message) !== null && _h !== void 0 ? _h : ''),
                createdAt: row.created_at,
            };
        });
    }
    async sendViaResend(params) {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.emailApiKey}`,
            },
            body: JSON.stringify(params),
        });
        if (!response.ok) {
            throw new Error(`Resend API error: ${response.statusText}`);
        }
    }
    async sendViaSendGrid(params) {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.emailApiKey}`,
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: params.to }] }],
                from: { email: params.from },
                subject: params.subject,
                content: [{ type: 'text/html', value: params.html }],
            }),
        });
        if (!response.ok) {
            throw new Error(`SendGrid API error: ${response.statusText}`);
        }
    }
    async sendViaSES(params) {
        this.logger.warn('AWS SES not yet implemented — install @aws-sdk/client-ses');
        throw new Error('AWS_SES_NOT_IMPLEMENTED');
    }
    async sendViaHubtel(params) {
        const auth = Buffer.from(`${this.hubtelClientId}:${this.hubtelClientSecret}`).toString('base64');
        const response = await fetch('https://smsc.hubtel.com/v1/messages/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${auth}`,
            },
            body: JSON.stringify({
                From: constants_1.SMS_CONFIG.senderId,
                To: params.to,
                Content: params.message,
            }),
        });
        if (!response.ok) {
            throw new Error(`Hubtel API error: ${response.statusText}`);
        }
        this.logger.log(`SMS sent to ${params.to} via Hubtel`);
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_2.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_1.DataSource, Object])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map