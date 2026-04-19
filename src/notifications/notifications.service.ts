import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SMS_CONFIG } from '../config/constants';
import { DataSource } from 'typeorm';

/**
 * Notifications Service — Email + SMS
 * Email: Transactional emails (welcome, Rx ready, invoice)
 * SMS: Hubtel SMS (Rx refill reminders, MoMo confirmation, low stock alerts)
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly hubtelClientId: string;
  private readonly hubtelClientSecret: string;
  private readonly emailProvider: string;
  private readonly emailApiKey: string;
  private readonly emailFrom: string;
  private readonly whatsappWebhookUrl: string;
  private readonly whatsappFallbackToSms: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    this.hubtelClientId = this.config.get('HUBTEL_CLIENT_ID') || '';
    this.hubtelClientSecret = this.config.get('HUBTEL_CLIENT_SECRET') || '';
    this.emailProvider = this.config.get('EMAIL_PROVIDER') || 'resend';
    this.emailApiKey = this.config.get('EMAIL_API_KEY') || '';
    const envFrom = this.config.get<string>('EMAIL_FROM') || '';
    this.emailFrom = envFrom || (
      this.emailProvider === 'resend'
        ? 'PharmaPOS <onboarding@resend.dev>'
        : 'PharmaPOS <noreply@pharmapos.com>'
    );
    this.whatsappWebhookUrl = this.config.get('WHATSAPP_WEBHOOK_URL') || '';
    this.whatsappFallbackToSms = (this.config.get('WHATSAPP_FALLBACK_TO_SMS') || 'true') !== 'false';
  }

  /**
   * Send transactional email
   * Supports: Resend, SendGrid, AWS SES
   */
  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    from?: string;
  }): Promise<void> {
    const { to, subject, html, from = this.emailFrom } = params;
    if (!this.emailApiKey) {
      this.logger.warn(`EMAIL_API_KEY missing; skipped email to ${to}`);
      return;
    }

    try {
      if (this.emailProvider === 'resend') {
        await this.sendViaResend({ to, subject, html, from });
      } else if (this.emailProvider === 'sendgrid') {
        await this.sendViaSendGrid({ to, subject, html, from });
      } else if (this.emailProvider === 'ses') {
        await this.sendViaSES({ to, subject, html, from });
      } else {
        this.logger.warn(`Email provider ${this.emailProvider} not configured — email not sent`);
      }
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Send SMS via Hubtel (Ghana-native)
   * Rate-limited: max 5 SMS per customer per day
   */
  async sendSms(params: {
    to: string; // Ghana phone format: +233XXXXXXXXX
    message: string;
    customerId?: string;
  }): Promise<void> {
    const { to, message, customerId } = params;
    if (!this.hubtelClientId || !this.hubtelClientSecret) {
      this.logger.warn(`Hubtel not configured; skipped SMS to ${to}`);
      return;
    }

    // Rate-limit check: max 5 SMS per customer per day
    if (customerId) {
      const rateLimitKey = `sms:rate:${customerId}:${new Date().toISOString().split('T')[0]}`;
      const count = (await this.cache.get<number>(rateLimitKey)) || 0;

      if (count >= SMS_CONFIG.maxPerCustomerPerDay) {
        this.logger.warn(`SMS rate limit exceeded for customer ${customerId}`);
        throw new Error('SMS_RATE_LIMIT_EXCEEDED');
      }

      await this.cache.set(rateLimitKey, count + 1, 86400000); // 24h TTL
    }

    try {
      await this.sendViaHubtel({ to, message });
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const html = `
      <h1>Welcome to PharmaPOS Pro, ${name}!</h1>
      <p>Your account has been created successfully.</p>
      <p>Start managing your pharmacy operations with ease.</p>
    `;
    await this.sendEmail({ to: email, subject: 'Welcome to PharmaPOS Pro', html });
  }

  /**
   * Send Rx ready notification
   */
  async sendRxReadyNotification(phone: string, customerName: string, customerId: string): Promise<void> {
    const message = `Hi ${customerName}, your prescription is ready for collection at Azzay Pharmacy. ${SMS_CONFIG.senderId}`;
    await this.sendSms({ to: phone, message, customerId });
  }

  /**
   * Send MoMo payment confirmation
   */
  async sendMoMoConfirmation(phone: string, amount: number, reference: string, customerId: string): Promise<void> {
    const message = `Payment of GH₵${(amount / 100).toFixed(2)} received. Ref: ${reference}. Thank you! ${SMS_CONFIG.senderId}`;
    await this.sendSms({ to: phone, message, customerId });
  }

  /**
   * Send low stock alert to staff
   */
  async sendLowStockAlert(phone: string, productName: string, currentStock: number): Promise<void> {
    const message = `LOW STOCK ALERT: ${productName} has only ${currentStock} units remaining. Reorder now. ${SMS_CONFIG.senderId}`;
    await this.sendSms({ to: phone, message });
  }

  isWhatsAppConfigured(): boolean {
    return Boolean(this.whatsappWebhookUrl);
  }

  isEmailConfigured(): boolean {
    return Boolean(this.emailApiKey);
  }

  isSmsConfigured(): boolean {
    return Boolean(this.hubtelClientId && this.hubtelClientSecret);
  }

  /**
   * Send WhatsApp message via configured webhook provider.
   * If WhatsApp is not configured and fallback is enabled, sends SMS instead.
   */
  async sendWhatsApp(params: { to: string; message: string }): Promise<void> {
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

  async getMyStockAlerts(
    userId: string,
    branchId: string,
    limit = 20,
  ): Promise<Array<{
    id: string;
    productId: string;
    productName: string;
    stockStatus: string;
    quantityOnHand: number;
    reorderLevel: number;
    suggestedReorderQty: number;
    supplierId?: string;
    supplierName?: string;
    supplierPhone?: string;
    channels: string[];
    message: string;
    createdAt: Date;
  }>> {
    const rows = await this.dataSource.query(`
      SELECT id, metadata, created_at
      FROM audit_logs
      WHERE branch_id = $1
        AND user_id = $2
        AND type = 'LOW_STOCK_ALERT_NOTIFICATION'
        AND (metadata->>'resolved' IS NULL OR metadata->>'resolved' = 'false')
      ORDER BY created_at DESC
      LIMIT $3
    `, [branchId, userId, limit]) as Array<{
      id: string;
      metadata: Record<string, unknown> | null;
      created_at: Date;
    }>;

    const productIds = Array.from(new Set(
      rows
        .map((row) => String((row.metadata ?? {}).productId ?? ''))
        .filter((id) => id.length > 0),
    ));

    const inventoryRows = productIds.length > 0
      ? await this.dataSource.query(`
        SELECT
          inv.product_id,
          inv.quantity_on_hand,
          inv.reorder_level,
          p.name AS product_name
        FROM inventory inv
        JOIN products p ON p.id = inv.product_id
        WHERE inv.branch_id = $1
          AND inv.product_id = ANY($2)
          AND p.is_active = true
      `, [branchId, productIds]) as Array<{
        product_id: string;
        quantity_on_hand: number;
        reorder_level: number;
        product_name: string;
      }>
      : [];

    const inventoryByProduct = new Map(inventoryRows.map((row) => [row.product_id, row]));
    const staleAlertIdsToResolve: string[] = [];

    const alerts = rows.flatMap((row) => {
      const m = (row.metadata ?? {}) as Record<string, unknown>;
      const productId = String(m.productId ?? '');
      const live = inventoryByProduct.get(productId);
      const quantityOnHand = live ? Number(live.quantity_on_hand) : Number(m.quantityOnHand ?? 0);
      const reorderLevel = live ? Number(live.reorder_level) : Number(m.reorderLevel ?? 0);
      const liveStatus = this.calcStockStatus(quantityOnHand, reorderLevel);

      if (!live || liveStatus === 'ok') {
        staleAlertIdsToResolve.push(row.id);
        return [];
      }

      return [{
        id: row.id,
        productId,
        productName: live.product_name || String(m.productName ?? 'Unknown product'),
        stockStatus: liveStatus,
        quantityOnHand,
        reorderLevel,
        suggestedReorderQty: this.suggestReorderQty(reorderLevel, quantityOnHand, liveStatus),
        supplierId: m.supplierId ? String(m.supplierId) : undefined,
        supplierName: m.supplierName ? String(m.supplierName) : undefined,
        supplierPhone: m.supplierPhone ? String(m.supplierPhone) : undefined,
        channels: Array.isArray(m.channels) ? m.channels.map(String) : ['in_app'],
        message: String(m.message ?? ''),
        createdAt: row.created_at,
      }];
    });

    if (staleAlertIdsToResolve.length > 0) {
      await this.dataSource.query(`
        UPDATE audit_logs
        SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{resolved}', 'true'::jsonb)
        WHERE id = ANY($1)
      `, [staleAlertIdsToResolve]);
    }

    return alerts;
  }

  private calcStockStatus(quantityOnHand: number, reorderLevel: number): 'out' | 'critical' | 'low' | 'ok' {
    if (quantityOnHand <= 0) return 'out';
    if (quantityOnHand <= Math.max(1, Math.floor(reorderLevel * 0.2))) return 'critical';
    if (quantityOnHand <= reorderLevel) return 'low';
    return 'ok';
  }

  private suggestReorderQty(
    reorderLevel: number,
    quantityOnHand: number,
    status: 'out' | 'critical' | 'low' | 'ok',
  ): number {
    if (status === 'ok') return 0;
    const buffer = status === 'out' ? 3 : status === 'critical' ? 2.5 : 2;
    const target = Math.max(Math.ceil(reorderLevel * buffer), reorderLevel + 5);
    return Math.max(0, target - quantityOnHand);
  }

  // ─── Private Email Providers ─────────────────────────────────────────────

  private async sendViaResend(params: {
    to: string;
    subject: string;
    html: string;
    from: string;
  }): Promise<void> {
    // Resend API: https://resend.com/docs/send-with-nodejs
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

  private async sendViaSendGrid(params: {
    to: string;
    subject: string;
    html: string;
    from: string;
  }): Promise<void> {
    // SendGrid API: https://docs.sendgrid.com/api-reference/mail-send/mail-send
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

  private async sendViaSES(params: {
    to: string;
    subject: string;
    html: string;
    from: string;
  }): Promise<void> {
    // AWS SES — requires AWS SDK
    this.logger.warn('AWS SES not yet implemented — install @aws-sdk/client-ses');
    throw new Error('AWS_SES_NOT_IMPLEMENTED');
  }

  // ─── Private SMS Provider ────────────────────────────────────────────────

  private async sendViaHubtel(params: { to: string; message: string }): Promise<void> {
    // Hubtel SMS API: https://developers.hubtel.com/documentations/sendmessage
    const auth = Buffer.from(`${this.hubtelClientId}:${this.hubtelClientSecret}`).toString('base64');

    const response = await fetch('https://smsc.hubtel.com/v1/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        From: SMS_CONFIG.senderId,
        To: params.to,
        Content: params.message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Hubtel API error: ${response.statusText}`);
    }

    this.logger.log(`SMS sent to ${params.to} via Hubtel`);
  }
}
