import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { ProductImageService } from './product-image.service';

interface FetchImageJob {
  productId: string;
  productName: string;
  genericName: string;
  classification: string;
  retryCount?: number;
}

@Processor('image-pipeline')
export class ImagePipelineProcessor {
  private readonly logger = new Logger(ImagePipelineProcessor.name);

  constructor(
    private readonly imageService: ProductImageService,
    private readonly dataSource: DataSource,
    @InjectQueue('image-pipeline') private readonly imageQueue: Queue,
  ) {}

  /**
   * Fetch product image from external sources
   * Triggered on product creation or manual refresh
   */
  @Process('fetch-product-image')
  async fetchProductImage(job: Job<FetchImageJob>): Promise<void> {
    const { productId, productName, genericName, classification, retryCount = 0 } = job.data;

    this.logger.log(`Processing image fetch for product ${productId}: ${productName}`);

    try {
      // Check if product already has an approved image
      const [existing] = await this.dataSource.query(
        `SELECT pi.id FROM product_images pi 
         WHERE pi.product_id = $1 AND pi.is_approved = true 
         AND pi.source != 'PLACEHOLDER'
         LIMIT 1`,
        [productId],
      ) as Array<{ id: string }>;

      if (existing) {
        this.logger.log(`Product ${productId} already has an approved image, skipping`);
        return;
      }

      // Find best image from available sources
      // By default: only exact product photos (RxImage, OpenFDA, Google)
      // No generic stock photos or AI generation unless explicitly enabled
      const imageSource = await this.imageService.findProductImage(
        productName,
        genericName,
        classification,
        {
          allowGenericImages: false, // Only exact product photos
          allowAiGeneration: false,  // No AI-generated images
        },
      );

      if (!imageSource) {
        this.logger.warn(`No image found for product ${productId}: ${productName}`);
        
        // Retry up to 3 times with exponential backoff
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 60000; // 1min, 2min, 4min
          throw new Error(`No image found, will retry in ${delay / 1000}s`);
        }
        return;
      }

      // Download and upload to S3
      const cdnUrl = await this.imageService.downloadAndUploadToS3(
        imageSource.url,
        productId,
        imageSource.source,
      );

      // Create product_images record
      const [imageRecord] = await this.dataSource.query(
        `INSERT INTO product_images (id, product_id, cdn_url, url_thumb, source, is_approved, metadata)
         VALUES (gen_random_uuid(), $1, $2, $2, $3, true, $4)
         RETURNING id`,
        [
          productId,
          cdnUrl,
          imageSource.source.toUpperCase(),
          JSON.stringify({ confidence: imageSource.confidence, original_url: imageSource.url }),
        ],
      ) as Array<{ id: string }>;

      // Update product.image_id
      await this.dataSource.query(
        `UPDATE products SET image_id = $1 WHERE id = $2`,
        [imageRecord.id, productId],
      );

      this.logger.log(
        `Successfully fetched and uploaded image for product ${productId} from ${imageSource.source} (confidence: ${imageSource.confidence})`,
      );
    } catch (error) {
      this.logger.error(`Failed to fetch image for product ${productId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error; // Let BullMQ handle retry logic
    }
  }

  /**
   * Batch process images for all products without images
   * Triggered manually or via cron job
   */
  @Process('batch-fetch-images')
  async batchFetchImages(job: Job<{ limit?: number }>): Promise<void> {
    const limit = job.data.limit || 100;

    this.logger.log(`Starting batch image fetch for up to ${limit} products`);

    try {
      // Find products without approved images
      const products = await this.dataSource.query(
        `SELECT p.id, p.name, p.generic_name, p.classification
         FROM products p
         LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_approved = true AND pi.source != 'PLACEHOLDER'
         WHERE p.is_active = true AND pi.id IS NULL
         ORDER BY p.created_at DESC
         LIMIT $1`,
        [limit],
      ) as Array<{
        id: string;
        name: string;
        generic_name: string;
        classification: string;
      }>;

      this.logger.log(`Found ${products.length} products without images`);

      // Queue individual fetch jobs with rate limiting
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        // Add job with delay to respect API rate limits
        // RxImage: no limit, OpenFDA: 240 requests/minute, Unsplash: 50/hour
        const delay = i * 2000; // 2 seconds between requests = 30 requests/minute

        await this.imageQueue.add(
          'fetch-product-image',
          {
            productId: product.id,
            productName: product.name,
            genericName: product.generic_name,
            classification: product.classification,
          },
          {
            delay,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 60000, // Start with 1 minute
            },
          },
        );
      }

      this.logger.log(`Queued ${products.length} image fetch jobs`);
    } catch (error) {
      this.logger.error(`Batch image fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Refresh images for products with low confidence scores
   * Triggered weekly via cron
   */
  @Process('refresh-low-confidence-images')
  async refreshLowConfidenceImages(job: Job): Promise<void> {
    this.logger.log('Refreshing low confidence product images');

    try {
      // Find products with AI-generated or low-confidence images
      const products = await this.dataSource.query(
        `SELECT p.id, p.name, p.generic_name, p.classification, pi.metadata
         FROM products p
         JOIN product_images pi ON pi.product_id = p.id AND pi.is_approved = true
         WHERE p.is_active = true 
         AND (pi.source = 'AI_GENERATED' OR (pi.metadata->>'confidence')::int < 70)
         ORDER BY (pi.metadata->>'confidence')::int ASC
         LIMIT 50`,
      ) as Array<{
        id: string;
        name: string;
        generic_name: string;
        classification: string;
        metadata: { confidence: number };
      }>;

      this.logger.log(`Found ${products.length} products with low confidence images`);

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const delay = i * 3000; // 3 seconds between requests

        await this.imageQueue.add(
          'fetch-product-image',
          {
            productId: product.id,
            productName: product.name,
            genericName: product.generic_name,
            classification: product.classification,
          },
          { delay, attempts: 2 },
        );
      }

      this.logger.log(`Queued ${products.length} image refresh jobs`);
    } catch (error) {
      this.logger.error(`Image refresh failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
