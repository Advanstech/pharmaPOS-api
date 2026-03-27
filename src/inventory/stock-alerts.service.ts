import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeStockService, StockChangedEventPayload } from './realtime-stock.service';

type AlertStatus = 'low' | 'critical' | 'out';

interface RecipientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

interface ProductSupplierRow {
  product_id: string;
  product_name: string;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  supplier_email: string | null;
}

@Injectable()
export class StockAlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StockAlertsService.name);
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly realtimeStock: RealtimeStockService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.realtimeStock.onStockChanged((payload) => {
      void this.processStockEvent(payload);
    });
  }

  onModuleDestroy(): void {
    if (this.unsubscribe) this.unsubscribe();
  }

  private async processStockEvent(event: StockChangedEventPayload): Promise<void> {
    if (event.stockStatus === 'ok') return;
    const status = event.stockStatus as AlertStatus;

    const cooldownKey = `stock-alert:${event.branchId}:${event.productId}:${status}`;
    const recent = await this.cache.get<boolean>(cooldownKey);
    if (recent) return;
    await this.cache.set(cooldownKey, true, 30 * 60 * 1000); // 30m cooldown per status

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
    `, [event.productId]) as ProductSupplierRow[];

    if (!product) return;

    const recipients = await this.dataSource.query(`
      SELECT id, name, email, phone, role
      FROM users
      WHERE branch_id = $1
        AND is_active = true
        AND role = ANY($2)
    `, [event.branchId, ['owner', 'se_admin', 'manager', 'head_pharmacist']]) as RecipientRow[];

    if (recipients.length === 0) return;

    const suggestedReorderQty = this.suggestReorderQty(event.reorderLevel, event.quantityOnHand, status);
    const supplierHint = product.supplier_name
      ? `Supplier: ${product.supplier_name}${product.supplier_phone ? ` (${product.supplier_phone})` : ''}.`
      : 'Supplier not linked yet.';
    const subject = `[Stock Alert] ${product.product_name} is ${status.toUpperCase()}`;
    const message = `${product.product_name} is ${status.toUpperCase()} at ${event.quantityOnHand} left (reorder ${event.reorderLevel}). ${supplierHint} Suggested reorder: ${suggestedReorderQty}.`;

    for (const recipient of recipients) {
      const channels: string[] = ['in_app'];

      // Persist in-app alert first so managers see it immediately in UI.
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
        } catch (error) {
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
        } catch (error) {
          this.logger.warn(`SMS alert failed for ${normalizedPhone}: ${String(error)}`);
        }

        if (this.notifications.isWhatsAppConfigured()) {
          try {
            await this.notifications.sendWhatsApp({
              to: normalizedPhone,
              message,
            });
            channels.push('whatsapp');
          } catch (error) {
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

  private suggestReorderQty(reorderLevel: number, quantityOnHand: number, status: AlertStatus): number {
    const buffer = status === 'out' ? 3 : status === 'critical' ? 2.5 : 2;
    const target = Math.max(Math.ceil(reorderLevel * buffer), reorderLevel + 5);
    return Math.max(0, target - quantityOnHand);
  }

  private normalizeGhPhone(phone: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/[^\d+]/g, '');
    if (digits.startsWith('+233')) return digits;
    if (digits.startsWith('233')) return `+${digits}`;
    if (digits.startsWith('0') && digits.length >= 10) return `+233${digits.slice(1)}`;
    return null;
  }
}
