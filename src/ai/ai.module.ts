import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ProductImageService } from './product-image.service';
import { ImagePipelineProcessor } from './image-pipeline.processor';
import { ProductsModule } from '../products/products.module';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] !== 'false';

/**
 * AI Capabilities Module
 * 
 * Features:
 * - Product image sourcing (RxImage, OpenFDA, Google, Unsplash, DALL-E)
 * - Demand forecasting (planned)
 * - Invoice OCR extraction (planned)
 * - Anomaly detection (planned)
 */
@Module({
  imports: [
    // BullMQ queue for async image processing
    ...(REDIS_ENABLED
      ? [
          BullModule.registerQueue({
            name: 'image-pipeline',
          }),
        ]
      : []),
    ProductsModule,
  ],
  providers: [
    ProductImageService,
    ...(REDIS_ENABLED ? [ImagePipelineProcessor] : []),
  ],
  exports: [ProductImageService],
})
export class AiModule {}
