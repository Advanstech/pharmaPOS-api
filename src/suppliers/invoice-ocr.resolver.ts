import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards, UsePipes, ValidationPipe, Optional, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { InvoiceOcrService } from './invoice-ocr.service';
import { S3UploadService } from '../products/s3-upload.service';
import { DataSource } from 'typeorm';
import {
  UploadSupplierInvoiceInput,
  ConfirmOcrInvoiceInput,
  RecordSupplierPaymentInput,
  UploadInvoiceResponse,
  InvoiceOcrJob,
  ConfirmInvoiceResponse,
  EnhancedSupplierInvoice,
  OcrStatus,
  PaymentTerms,
  PaymentStatus,
} from './dto/invoice-ocr.types';

const ALLOWED_INVOICE_MIME_TYPES = new Set([
  'application/pdf',
  'application/x-pdf',
  'image/png',
  'image/x-png',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/bmp',
]);

const ALLOWED_INVOICE_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.tif', '.tiff', '.bmp'];
const MAX_INVOICE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function isAllowedInvoiceFile(mimetype: string | undefined, filename: string | undefined): boolean {
  const normalizedMime = (mimetype || '').toLowerCase();
  const lowerFilename = (filename || '').toLowerCase();
  const extensionAllowed = ALLOWED_INVOICE_EXTENSIONS.some((ext) => lowerFilename.endsWith(ext));
  return ALLOWED_INVOICE_MIME_TYPES.has(normalizedMime) || extensionAllowed;
}

function inferMimeTypeFromFilename(filename: string | undefined): string {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'application/octet-stream';
}

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceOcrResolver {
  private readonly logger = new Logger(InvoiceOcrResolver.name);

  constructor(
    private readonly ocrService: InvoiceOcrService,
    private readonly s3Upload: S3UploadService,
    private readonly dataSource: DataSource,
    @Optional() @InjectQueue('invoice-ocr') private readonly ocrQueue?: Queue,
  ) {}

  // ── Upload Invoice for OCR ────────────────────────────────────────────

  @Mutation(() => UploadInvoiceResponse, { name: 'uploadSupplierInvoice' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async uploadSupplierInvoice(
    @Args('input') input: UploadSupplierInvoiceInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<UploadInvoiceResponse> {
    // Upload file to S3
    const file = await (input.invoiceFile ?? (input as unknown as { file?: Promise<any> }).file);
    if (!file) {
      throw new Error('No invoice file provided. Attach a PDF or image and try again.');
    }
    const { createReadStream, filename, mimetype } = file;
    const normalizedMime = (mimetype || inferMimeTypeFromFilename(filename)).toLowerCase();

    // Validate file type
    if (!isAllowedInvoiceFile(normalizedMime, filename)) {
      throw new Error(
        `Invalid file type: ${normalizedMime}. Allowed: PDF and image files (JPG, JPEG, PNG, WEBP, HEIC, TIFF, BMP)`,
      );
    }

    // Generate S3 key
    const timestamp = Date.now();
    const s3Key = `invoices/${actor.branchId}/${timestamp}-${filename}`;

    // Upload to S3
    let buffer: Buffer;
    if (typeof createReadStream === 'function') {
      const stream = createReadStream();
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      for await (const chunk of stream) {
        const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += bufferChunk.length;
        if (totalBytes > MAX_INVOICE_SIZE_BYTES) {
          throw new Error(`Invoice file is too large. Maximum size is ${Math.floor(MAX_INVOICE_SIZE_BYTES / 1024 / 1024)}MB.`);
        }
        chunks.push(bufferChunk);
      }
      buffer = Buffer.concat(chunks);
    } else {
      const fileWithPath = file as unknown as { _path?: string };
      if (!fileWithPath._path) {
        throw new Error('Invalid file upload payload: stream not available');
      }
      const { readFile } = await import('node:fs/promises');
      buffer = await readFile(fileWithPath._path);
    }
    const fileSizeBytes = buffer.length;
    if (fileSizeBytes > MAX_INVOICE_SIZE_BYTES) {
      throw new Error(`Invoice file is too large. Maximum size is ${Math.floor(MAX_INVOICE_SIZE_BYTES / 1024 / 1024)}MB.`);
    }

    // Upload using S3 client directly
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
    const s3Client = new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    const bucket = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || 'pharmapos-images';
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: normalizedMime,
      }),
    );

    const fileUrl = `https://${bucket}.s3.amazonaws.com/${s3Key}`;

    // Create OCR job record
    const jobId = await this.ocrService.createOcrJob(
      actor.branchId,
      input.supplierId || null,
      s3Key,
      normalizedMime,
      fileSizeBytes,
      actor.sub,
    );

    // Queue OCR processing (degrade gracefully when Redis/Bull is disabled)
    if (this.ocrQueue) {
      await this.ocrQueue.add('extract-invoice', {
        jobId,
        fileUrl,
        fileType: normalizedMime,
        supplierId: input.supplierId || null,
        branchId: actor.branchId,
        createdBy: actor.sub,
      });
    } else {
      this.logger.warn(
        `OCR queue unavailable (REDIS_ENABLED=false or Redis down). Job ${jobId} stored but not enqueued.`,
      );
    }

    return {
      id: jobId,
      status: OcrStatus.PENDING,
      ocrJobId: jobId,
      message: 'Invoice uploaded successfully. OCR processing started.',
    };
  }

  // ── Get OCR Job Status ────────────────────────────────────────────────

  @Query(() => InvoiceOcrJob, { name: 'invoiceOcrJob' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician')
  async getOcrJob(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() _actor: JwtUser,
  ): Promise<InvoiceOcrJob> {
    const job = await this.ocrService.getOcrJob(id);

    if (!job) {
      throw new Error(`OCR job ${id} not found`);
    }

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      ocrProvider: job.ocr_provider,
      extractedData: job.extracted_data
        ? (typeof job.extracted_data === 'string'
            ? JSON.parse(job.extracted_data)
            : job.extracted_data)
        : null,
      confidenceScore: job.confidence_score,
      requiresReview: job.requires_review,
      errorMessage: job.error_message,
      fileS3Key: job.file_s3_key,
      fileType: job.file_type,
      fileSizeBytes: job.file_size_bytes,
      supplierName: job.supplier_name,
      supplierId: job.supplier_id,
      createdByName: job.created_by_name,
      createdAt: job.created_at,
      processingCompletedAt: job.processing_completed_at,
    };
  }

  // ── Confirm OCR Data and Create GRN ───────────────────────────────────

  @Mutation(() => ConfirmInvoiceResponse, { name: 'confirmOcrInvoice' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician')
  async confirmOcrInvoice(
    @Args('input') input: ConfirmOcrInvoiceInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<ConfirmInvoiceResponse> {
    // Get OCR job
    const ocrJob = await this.ocrService.getOcrJob(input.ocrJobId);
    if (!ocrJob) {
      throw new Error(`OCR job ${input.ocrJobId} not found`);
    }

    if (ocrJob.status !== 'completed') {
      throw new Error(`OCR job is not completed. Current status: ${ocrJob.status}`);
    }

    const supplierId = ocrJob.supplier_id;
    if (!supplierId) {
      throw new Error('Supplier not identified. Please select a supplier manually.');
    }

    // Create GRN and supplier invoice in a transaction
    const result = await this.dataSource.transaction(async (em) => {
      // 1. Create GRN
      const [grn] = await em.query(
        `
        INSERT INTO goods_received_notes (
          id, branch_id, received_by, notes
        )
        VALUES (gen_random_uuid(), $1, $2, $3)
        RETURNING id
      `,
        [actor.branchId, actor.sub, input.notes || null],
      );

      const grnId = grn.id;

      // 2. Create supplier invoice
      const [invoice] = await em.query(
        `
        INSERT INTO supplier_invoices (
          id, supplier_id, branch_id, grn_id, invoice_number, invoice_date,
          due_date, total_amount, paid_amount, status, payment_terms, payment_status,
          ocr_job_id
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::date, $6::date, $7, 0, 'PENDING', 'NET_30', 'UNPAID', $8)
        RETURNING id
      `,
        [
          supplierId,
          actor.branchId,
          grnId,
          input.invoiceNumber,
          input.invoiceDate,
          input.dueDate || null,
          input.totalAmountPesewas,
          input.ocrJobId,
        ],
      );

      const invoiceId = invoice.id;

      // 3. Process each item
      let imagesProcessed = 0;

      for (const item of input.items) {
        // Ensure inventory row exists
        await em.query(
          `
          INSERT INTO inventory (id, product_id, branch_id, quantity_on_hand, reorder_level)
          VALUES (gen_random_uuid(), $1, $2, 0, 10)
          ON CONFLICT (product_id, branch_id) DO NOTHING
        `,
          [item.productId, actor.branchId],
        );

        // Update inventory
        await em.query(
          `
          UPDATE inventory
          SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
          WHERE product_id = $2 AND branch_id = $3
        `,
          [item.quantity, item.productId, actor.branchId],
        );

        // Create stock movement
        await em.query(
          `
          INSERT INTO stock_movements (
            id, product_id, branch_id, batch_number, expiry_date,
            quantity, movement_type, reference_id, performed_by
          )
          VALUES (gen_random_uuid(), $1, $2, $3, $4::date, $5, 'PURCHASE', $6, $7)
        `,
          [item.productId, actor.branchId, item.batchNumber, item.expiryDate, item.quantity, grnId, actor.sub],
        );

        // Record cost history
        await em.query(
          `
          INSERT INTO product_cost_history (
            id, branch_id, product_id, supplier_id, source_type, source_reference_id,
            unit_cost_pesewas, currency, observed_at, created_by
          )
          VALUES (gen_random_uuid(), $1, $2, $3, 'GRN', $4, $5, 'GHS', NOW(), $6)
        `,
          [actor.branchId, item.productId, supplierId, grnId, item.unitPricePesewas, actor.sub],
        );

        // Handle product image if provided
        if (item.productImageUrl) {
          const [existingImage] = await em.query(
            `SELECT id FROM product_images WHERE product_id = $1 AND is_approved = true LIMIT 1`,
            [item.productId],
          );

          if (!existingImage) {
            const [imageRecord] = await em.query(
              `
              INSERT INTO product_images (
                id, product_id, cdn_url, url_thumb, source, is_approved, metadata
              )
              VALUES (gen_random_uuid(), $1, $2, $2, 'OCR_UPLOAD', true, $3)
              RETURNING id
            `,
              [
                item.productId,
                item.productImageUrl,
                JSON.stringify({ ocr_job_id: input.ocrJobId, original_description: item.ocrDescription }),
              ],
            );

            await em.query(`UPDATE products SET image_id = $1 WHERE id = $2`, [imageRecord.id, item.productId]);

            imagesProcessed++;
          }
        }
      }

      // 4. Create audit log
      await em.query(
        `
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'GRN_CREATED_FROM_OCR', 'grn', $3, $4)
      `,
        [
          actor.branchId,
          actor.sub,
          grnId,
          JSON.stringify({
            ocr_job_id: input.ocrJobId,
            invoice_number: input.invoiceNumber,
            total_amount: input.totalAmountPesewas,
            item_count: input.items.length,
            images_processed: imagesProcessed,
          }),
        ],
      );

      return { grnId, invoiceId, imagesProcessed };
    });

    return {
      grnId: result.grnId,
      supplierInvoiceId: result.invoiceId,
      stockUpdated: true,
      imagesProcessed: result.imagesProcessed,
      message: `GRN created successfully. ${input.items.length} products stocked. ${result.imagesProcessed} images processed.`,
    };
  }

  // ── Record Supplier Payment ───────────────────────────────────────────

  @Mutation(() => EnhancedSupplierInvoice, { name: 'recordSupplierPayment' })
  @Roles('owner', 'se_admin', 'manager')
  async recordSupplierPayment(
    @Args('input') input: RecordSupplierPaymentInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<EnhancedSupplierInvoice> {
    // Validate invoice exists
    const [invoice] = await this.dataSource.query(
      `SELECT id, total_amount, paid_amount FROM supplier_invoices WHERE id = $1`,
      [input.invoiceId],
    );

    if (!invoice) {
      throw new Error(`Invoice ${input.invoiceId} not found`);
    }

    const remainingBalance = invoice.total_amount - invoice.paid_amount;
    if (input.amountPesewas > remainingBalance) {
      throw new Error(
        `Payment amount (${input.amountPesewas}) exceeds remaining balance (${remainingBalance})`,
      );
    }

    // Record payment
    await this.dataSource.query(
      `
      INSERT INTO supplier_payments (
        id, invoice_id, branch_id, amount_pesewas, payment_method,
        reference, notes, paid_by
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
    `,
      [
        input.invoiceId,
        actor.branchId,
        input.amountPesewas,
        input.paymentMethod,
        input.reference || null,
        input.notes || null,
        actor.sub,
      ],
    );

    // Trigger will automatically update invoice payment_status

    // Return updated invoice
    return this.getEnhancedInvoice(input.invoiceId);
  }

  // ── Get Enhanced Supplier Invoice ─────────────────────────────────────

  @Query(() => EnhancedSupplierInvoice, { name: 'supplierInvoice' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  async getSupplierInvoice(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() _actor: JwtUser,
  ): Promise<EnhancedSupplierInvoice> {
    return this.getEnhancedInvoice(id);
  }

  // ── Helper: Get Enhanced Invoice ──────────────────────────────────────

  private async getEnhancedInvoice(invoiceId: string): Promise<EnhancedSupplierInvoice> {
    const [invoice] = await this.dataSource.query(
      `
      SELECT 
        si.*,
        s.name as supplier_name,
        EXTRACT(DAY FROM (NOW() - si.invoice_date))::INT as days_outstanding,
        (si.due_date IS NOT NULL AND si.due_date < CURRENT_DATE AND si.payment_status != 'PAID') as is_overdue,
        CASE 
          WHEN si.due_date IS NOT NULL AND si.due_date < CURRENT_DATE AND si.payment_status != 'PAID'
          THEN EXTRACT(DAY FROM (CURRENT_DATE - si.due_date))::INT
          ELSE 0
        END as overdue_by_days
      FROM supplier_invoices si
      JOIN suppliers s ON s.id = si.supplier_id
      WHERE si.id = $1
    `,
      [invoiceId],
    );

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    // Get payments
    const payments = await this.dataSource.query(
      `
      SELECT 
        sp.*,
        u.name as paid_by_name
      FROM supplier_payments sp
      JOIN users u ON u.id = sp.paid_by
      WHERE sp.invoice_id = $1
      ORDER BY sp.paid_at DESC
    `,
      [invoiceId],
    );

    const balancePesewas = invoice.total_amount - invoice.paid_amount;
    const paymentProgressPct = invoice.total_amount > 0
      ? Math.max(0, Math.min(100, Math.round((invoice.paid_amount / invoice.total_amount) * 100)))
      : 0;
    const suggestedNextPaymentPesewas = balancePesewas <= 0
      ? 0
      : invoice.is_overdue
        ? balancePesewas
        : balancePesewas <= 200_000
          ? balancePesewas
          : Math.ceil((balancePesewas * 0.5) / 100) * 100;
    const remainingAfterSuggestedPesewas = Math.max(0, balancePesewas - suggestedNextPaymentPesewas);
    const extractedDataJson = invoice.extracted_data
      ? (typeof invoice.extracted_data === 'string'
          ? invoice.extracted_data
          : JSON.stringify(invoice.extracted_data))
      : undefined;

    return {
      id: invoice.id,
      supplierId: invoice.supplier_id,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      totalAmountPesewas: invoice.total_amount,
      totalAmountFormatted: `GH₵${(invoice.total_amount / 100).toFixed(2)}`,
      paidAmountPesewas: invoice.paid_amount,
      paidAmountFormatted: `GH₵${(invoice.paid_amount / 100).toFixed(2)}`,
      balancePesewas,
      balanceFormatted: `GH₵${(balancePesewas / 100).toFixed(2)}`,
      paymentProgressPct,
      paymentTerms: invoice.payment_terms as PaymentTerms,
      paymentStatus: invoice.payment_status as PaymentStatus,
      daysOutstanding: invoice.days_outstanding,
      isOverdue: invoice.is_overdue,
      overdueByDays: invoice.overdue_by_days,
      suggestedNextPaymentPesewas,
      suggestedNextPaymentFormatted: `GH₵${(suggestedNextPaymentPesewas / 100).toFixed(2)}`,
      remainingAfterSuggestedPesewas,
      remainingAfterSuggestedFormatted: `GH₵${(remainingAfterSuggestedPesewas / 100).toFixed(2)}`,
      payments: payments.map((p: any) => ({
        id: p.id,
        amountPesewas: p.amount_pesewas,
        amountFormatted: `GH₵${(p.amount_pesewas / 100).toFixed(2)}`,
        paymentMethod: p.payment_method,
        reference: p.reference,
        notes: p.notes,
        paidByName: p.paid_by_name,
        paidAt: p.paid_at,
      })),
      supplierName: invoice.supplier_name,
      s3PdfKey: invoice.s3_pdf_key ?? undefined,
      extractedDataJson,
      grnId: invoice.grn_id,
    };
  }
}
