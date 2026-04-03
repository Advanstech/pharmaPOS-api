import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PharmacyService } from './pharmacy.service';

interface ExternalPrescriptionItem {
  productId: string;
  quantity: number;
  dosageInstructions?: string;
}

interface ExternalPrescriptionPayload {
  partnerId: string;
  branchCode: string;
  customer: {
    name: string;
    phone?: string;
    email?: string;
  };
  prescriber: {
    name: string;
    licenceNo: string;
    facility?: string;
  };
  prescribedDate: string;
  items: ExternalPrescriptionItem[];
  notes?: string;
}

@Controller('webhooks/prescriptions')
export class PrescriptionWebhookController {
  private readonly logger = new Logger(PrescriptionWebhookController.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly pharmacyService: PharmacyService,
    private readonly config: ConfigService,
  ) {}

  /**
   * External webhook for partner clinics/hospitals to submit prescriptions electronically.
   * Authenticated via X-Partner-API-Key header.
   * 
   * Flow:
   * 1. Validate API key
   * 2. Find or create customer by phone/name
   * 3. Validate prescriber GMDC licence
   * 4. Create prescription with PENDING status
   * 5. Return prescription ID for tracking
   */
  @Post('incoming')
  @HttpCode(HttpStatus.CREATED)
  async receiveExternalPrescription(
    @Body() payload: ExternalPrescriptionPayload,
    @Headers('x-partner-api-key') apiKey: string,
    @Headers('x-partner-id') partnerIdHeader: string,
  ): Promise<{
    success: boolean;
    prescriptionId: string;
    customerId: string;
    status: string;
    message: string;
  }> {
    // Validate API key
    const validApiKey = this.config.get<string>('PARTNER_PRESCRIPTION_API_KEY');
    if (!validApiKey || apiKey !== validApiKey) {
      this.logger.warn(`Invalid API key attempt from partner: ${partnerIdHeader || 'unknown'}`);
      throw new UnauthorizedException('Invalid API key');
    }

    // Validate payload
    if (!payload.customer?.name || !payload.prescriber?.licenceNo || !payload.prescriber?.name) {
      throw new BadRequestException('Missing required fields: customer.name, prescriber.licenceNo, prescriber.name');
    }

    if (!payload.items || payload.items.length === 0) {
      throw new BadRequestException('At least one prescription item is required');
    }

    // Validate prescribed date
    const prescribedDate = new Date(payload.prescribedDate);
    if (isNaN(prescribedDate.getTime())) {
      throw new BadRequestException('Invalid prescribedDate format. Use ISO 8601 (YYYY-MM-DD)');
    }

    // Validate GMDC licence before creating anything
    const gmdcResult = await this.pharmacyService.validateGmdcLicence(payload.prescriber.licenceNo);
    if (!gmdcResult.valid) {
      throw new BadRequestException(`Invalid GMDC licence: ${payload.prescriber.licenceNo}`);
    }

    // Look up branch by code
    const [branch] = await this.dataSource.query(
      `SELECT id FROM branches WHERE code = $1 AND is_active = true`,
      [payload.branchCode || 'MAIN'],
    ) as Array<{ id: string }>;

    if (!branch) {
      throw new BadRequestException(`Branch not found: ${payload.branchCode}`);
    }

    return await this.dataSource.transaction(async (em) => {
      // Find existing customer by phone, or create new one
      let customerId: string;
      
      if (payload.customer?.phone) {
        const [existingCustomer] = await em.query(
          `SELECT id FROM customers WHERE phone_hash = encode(digest($1, 'sha256'), 'hex') AND branch_id = $2 LIMIT 1`,
          [payload.customer.phone, branch.id],
        ) as Array<{ id: string }>;
        
        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          // Create new customer
          const [newCustomer] = await em.query(
            `INSERT INTO customers (id, branch_id, name, phone_hash, age_years, is_active, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, encode(digest($3, 'sha256'), 'hex'), NULL, true, NOW(), NOW())
             RETURNING id`,
            [branch.id, payload.customer.name, payload.customer.phone],
          ) as Array<{ id: string }>;
          customerId = newCustomer.id;
        }
      } else {
        // Create anonymous customer with just name
        const [newCustomer] = await em.query(
          `INSERT INTO customers (id, branch_id, name, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
           RETURNING id`,
          [branch.id, payload.customer.name],
        ) as Array<{ id: string }>;
        customerId = newCustomer.id;
      }

      // Calculate expiry date (30 days from prescribed date)
      const expiryDate = new Date(prescribedDate);
      expiryDate.setDate(expiryDate.getDate() + 30);

      // Create prescription
      const [prescription] = await em.query(
        `INSERT INTO prescriptions
          (id, branch_id, customer_id, prescriber_licence_no, prescriber_name, prescribed_date, expiry_date, status, approval_count, external_partner_id, external_notes)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'PENDING', 0, $7, $8)
         RETURNING id`,
        [
          branch.id,
          customerId,
          payload.prescriber.licenceNo,
          payload.prescriber.name,
          prescribedDate,
          expiryDate,
          payload.partnerId || partnerIdHeader || 'external',
          payload.notes || null,
        ],
      ) as Array<{ id: string }>;

      // Create prescription items
      for (const item of payload.items) {
        await em.query(
          `INSERT INTO prescription_items (id, prescription_id, product_id, quantity, dosage_instructions)
           VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
          [prescription.id, item.productId, item.quantity, item.dosageInstructions || null],
        );
      }

      // Audit log
      await em.query(
        `INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
         VALUES (gen_random_uuid(), $1, $2, 'RX_EXTERNAL_CREATED', 'prescription', $3, $4)`,
        [
          branch.id,
          'system-webhook',
          prescription.id,
          JSON.stringify({
            partner_id: payload.partnerId || partnerIdHeader,
            prescriber_licence: payload.prescriber.licenceNo,
            item_count: payload.items.length,
            source: 'external_webhook',
          }),
        ],
      );

      this.logger.log(`External prescription created: ${prescription.id} from partner ${payload.partnerId}`);

      return {
        success: true,
        prescriptionId: prescription.id,
        customerId,
        status: 'PENDING',
        message: 'Prescription received and pending pharmacist verification',
      };
    });
  }

  /**
   * Health check endpoint for partners to verify connectivity
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck(
    @Headers('x-partner-api-key') apiKey: string,
  ): Promise<{ status: string; timestamp: string }> {
    const validApiKey = this.config.get<string>('PARTNER_PRESCRIPTION_API_KEY');
    if (!validApiKey || apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
