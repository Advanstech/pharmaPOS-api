import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';
export declare class NotificationsService {
    private readonly config;
    private readonly dataSource;
    private readonly cache;
    private readonly logger;
    private readonly hubtelClientId;
    private readonly hubtelClientSecret;
    private readonly emailProvider;
    private readonly emailApiKey;
    private readonly emailFrom;
    private readonly whatsappWebhookUrl;
    private readonly whatsappFallbackToSms;
    constructor(config: ConfigService, dataSource: DataSource, cache: Cache);
    sendEmail(params: {
        to: string;
        subject: string;
        html: string;
        from?: string;
    }): Promise<void>;
    sendSms(params: {
        to: string;
        message: string;
        customerId?: string;
    }): Promise<void>;
    sendWelcomeEmail(email: string, name: string): Promise<void>;
    sendRxReadyNotification(phone: string, customerName: string, customerId: string): Promise<void>;
    sendMoMoConfirmation(phone: string, amount: number, reference: string, customerId: string): Promise<void>;
    sendLowStockAlert(phone: string, productName: string, currentStock: number): Promise<void>;
    isWhatsAppConfigured(): boolean;
    isEmailConfigured(): boolean;
    isSmsConfigured(): boolean;
    sendWhatsApp(params: {
        to: string;
        message: string;
    }): Promise<void>;
    getMyStockAlerts(userId: string, branchId: string, limit?: number): Promise<Array<{
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
    }>>;
    private sendViaResend;
    private sendViaSendGrid;
    private sendViaSES;
    private sendViaHubtel;
}
