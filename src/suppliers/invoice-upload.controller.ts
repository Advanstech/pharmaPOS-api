import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { InvoiceOcrService } from './invoice-ocr.service';
import { OcrStatus } from './dto/invoice-ocr.types';

const ALLOWED_MIME = new Set([
  'application/pdf', 'application/x-pdf',
  'image/png', 'image/x-png', 'image/jpeg', 'image/jpg',
  'image/pjpeg', 'image/webp', 'image/heic', 'image/heif',
  'image/tiff', 'image/bmp',
]);
const ALLOWED_EXT = ['.pdf','.png','.jpg','.jpeg','.webp','.heic','.heif','.tif','.tiff','.bmp'];

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceUploadController {
  private readonly logger = new Logger(InvoiceUploadController.name);

  constructor(private readonly ocrService: InvoiceOcrService) {}

  @Post('upload')
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist', 'technician')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const mime = (file.mimetype || '').toLowerCase();
      const name = (file.originalname || '').toLowerCase();
      const ok = ALLOWED_MIME.has(mime) || ALLOWED_EXT.some(e => name.endsWith(e));
      ok ? cb(null, true) : cb(new BadRequestException(`Invalid file type: ${file.mimetype}`), false);
    },
  }))
  async uploadInvoice(
    @UploadedFile() file: Express.Multer.File,
    @Body('supplierId') supplierId: string | undefined,
    @CurrentUser() actor: JwtUser,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    this.logger.log(`Invoice upload: ${file.originalname} (${file.size} bytes, ${file.mimetype}) by ${actor.sub}`);

    // Convert buffer to base64 data URL for GPT-4o
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    // Create job record
    const jobId = await this.ocrService.createOcrJob(
      actor.branchId,
      supplierId || null,
      `memory/${actor.branchId}/${Date.now()}-${file.originalname}`,
      file.mimetype,
      file.size,
      actor.sub,
    );

    this.logger.log(`OCR job created: ${jobId}`);

    // Process OCR in background using setImmediate
    setImmediate(() => {
      this.processOcr(jobId, dataUrl, file.mimetype, supplierId || null, actor.branchId, actor.sub)
        .catch(err => this.logger.error(`OCR failed for ${jobId}: ${err.message}`));
    });

    return {
      id: jobId,
      status: OcrStatus.PENDING,
      ocrJobId: jobId,
      message: `Invoice uploaded (${file.originalname}, ${(file.size / 1024).toFixed(1)} KB). OCR processing started.`,
    };
  }

  // Process OCR in background
  private async processOcr(
    jobId: string,
    dataUrl: string,
    fileType: string,
    supplierId: string | null,
    branchId: string,
    createdBy: string,
  ): Promise<void> {
    try {
      this.logger.log(`🔄 OCR processing started for job ${jobId}`);
      await this.ocrService.updateOcrJob(jobId, 'processing', 10);

      this.logger.log(`🤖 Calling GPT-4o for invoice extraction...`);
      const extractedData = await this.ocrService.extractInvoiceData(dataUrl, fileType, supplierId || undefined);
      this.logger.log(`✅ Extraction complete: ${extractedData.items.length} items, ${extractedData.confidence}% confidence`);

      await this.ocrService.updateOcrJob(jobId, 'processing', 60, extractedData);

      // Match supplier
      let matchedSupplierId = supplierId;
      if (!matchedSupplierId && extractedData.supplierName) {
        this.logger.log(`🔍 Matching supplier: ${extractedData.supplierName}`);
        matchedSupplierId = await this.ocrService.matchSupplier(extractedData.supplierName, (extractedData as any).supplierPhone);
        if (matchedSupplierId) {
          this.logger.log(`✅ Supplier matched: ${matchedSupplierId}`);
          await this.ocrService.updateOcrJobSupplierId(jobId, matchedSupplierId);
        } else {
          this.logger.warn(`⚠️ No supplier match for: ${extractedData.supplierName}`);
        }
      }

      // Match products
      if (matchedSupplierId && extractedData.items.length > 0) {
        this.logger.log(`🔍 Matching ${extractedData.items.length} products...`);
        const productMatches = await this.ocrService.matchProducts(extractedData.items, matchedSupplierId, branchId);
        extractedData.items = extractedData.items.map((item, i) => ({ ...item, matches: productMatches[i]?.matches || [] } as any));
        const matched = extractedData.items.filter((item: any) => item.matches?.length > 0).length;
        this.logger.log(`✅ Product matching: ${matched}/${extractedData.items.length} matched`);
      }

      await this.ocrService.updateOcrJob(jobId, 'completed', 100, extractedData);
      this.logger.log(`🎉 OCR job ${jobId} completed`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`❌ OCR job ${jobId} failed: ${msg}`);
      await this.ocrService.updateOcrJob(jobId, 'failed', 0, undefined, msg);
    }
  }
}
