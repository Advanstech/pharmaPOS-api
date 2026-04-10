import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { SuppliersService } from './suppliers.service';
import { SuppliersResolver } from './suppliers.resolver';
import { InvoiceOcrService } from './invoice-ocr.service';
import { InvoiceOcrResolver } from './invoice-ocr.resolver';
import { InvoiceOcrProcessor } from './invoice-ocr.processor';
import { Supplier } from './entities/supplier.entity';
import { ProductsModule } from '../products/products.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier]),
    BullModule.registerQueue({
      name: 'invoice-ocr',
    }),
    ProductsModule, // For S3UploadService
    AiModule, // For ProductImageService
  ],
  providers: [
    SuppliersService,
    SuppliersResolver,
    InvoiceOcrService,
    InvoiceOcrResolver,
    InvoiceOcrProcessor,
  ],
  exports: [SuppliersService, InvoiceOcrService],
})
export class SuppliersModule {}
