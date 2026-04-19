import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InvoiceOcrService } from './invoice-ocr.service';
import { ProductImageService } from '../ai/product-image.service';

interface InvoiceOcrJob {
  jobId: string;
  fileUrl: string;
  fileType: string;
  supplierId: string | null;
  branchId: string;
  createdBy: string;
}

@Processor('invoice-ocr')
export class InvoiceOcrProcessor {
  private readonly logger = new Logger(InvoiceOcrProcessor.name);

  constructor(
    private readonly ocrService: InvoiceOcrService,
    private readonly imageService: ProductImageService,
  ) {}

  /**
   * Process invoice OCR job
   */
  @Process('extract-invoice')
  async extractInvoice(job: Job<InvoiceOcrJob>): Promise<void> {
    const { jobId, fileUrl, fileType, supplierId, branchId } = job.data;

    this.logger.log(`Processing invoice OCR job ${jobId}`);

    try {
      // Update status to processing
      await this.ocrService.updateOcrJob(jobId, 'processing', 10);

      // Extract invoice data using GPT-4 Vision
      const extractedData = await this.ocrService.extractInvoiceData(
        fileUrl,
        fileType,
        supplierId || undefined,
      );

      await this.ocrService.updateOcrJob(jobId, 'processing', 50, extractedData);

      // Match supplier if not provided
      let matchedSupplierId = supplierId;
      if (!matchedSupplierId && extractedData.supplierName) {
        matchedSupplierId = await this.ocrService.matchSupplier(
          extractedData.supplierName,
          extractedData.supplierPhone,
        );
      }

      await this.ocrService.updateOcrJob(jobId, 'processing', 60, extractedData);

      // Match products
      if (matchedSupplierId && extractedData.items.length > 0) {
        const productMatches = await this.ocrService.matchProducts(
          extractedData.items,
          matchedSupplierId,
          branchId,
        );

        // Enhance extracted data with product matches
        extractedData.items = extractedData.items.map((item, index) => ({
          ...item,
          matches: productMatches[index]?.matches || [],
        } as any));

        await this.ocrService.updateOcrJob(jobId, 'processing', 80, extractedData);

        // Fetch images for unmatched products
        await this.fetchImagesForUnmatchedProducts(productMatches, extractedData);
      }

      // Mark as completed
      await this.ocrService.updateOcrJob(jobId, 'completed', 100, extractedData);

      this.logger.log(`Invoice OCR job ${jobId} completed successfully`);
    } catch (error) {
      this.logger.error(
        `Invoice OCR job ${jobId} failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      await this.ocrService.updateOcrJob(
        jobId,
        'failed',
        0,
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
      );

      throw error;
    }
  }

  /**
   * Fetch product images for items that don't have matches
   */
  private async fetchImagesForUnmatchedProducts(
    productMatches: Array<{ ocrItem: any; matches: any[] }>,
    extractedData: any,
  ): Promise<void> {
    for (const match of productMatches) {
      if (match.matches.length === 0) {
        // No product match found, try to fetch image for this description
        try {
          const imageSource = await this.imageService.findProductImage(
            match.ocrItem.description,
            match.ocrItem.description, // Use description as generic name too
            'OTC', // Default classification
            {
              allowGenericImages: false,
              allowAiGeneration: false,
            },
          );

          if (imageSource) {
            // Store image URL in extracted data for later use
            match.ocrItem.suggestedImageUrl = imageSource.url;
            match.ocrItem.imageSource = imageSource.source;
            match.ocrItem.imageConfidence = imageSource.confidence;
          }
        } catch (error) {
          this.logger.warn(
            `Failed to fetch image for ${match.ocrItem.description}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  }
}
