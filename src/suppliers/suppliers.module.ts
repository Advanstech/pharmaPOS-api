import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { MulterModule } from '@nestjs/platform-express';
import { SuppliersService } from './suppliers.service';
import { SuppliersResolver } from './suppliers.resolver';
import { InvoiceOcrService } from './invoice-ocr.service';
import { InvoiceOcrResolver } from './invoice-ocr.resolver';
import { InvoiceOcrProcessor } from './invoice-ocr.processor';
import { InvoiceUploadController } from './invoice-upload.controller';
import { Supplier } from './entities/supplier.entity';
import { ProductsModule } from '../products/products.module';
import { AiModule } from '../ai/ai.module';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] !== 'false';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier]),
    ...(REDIS_ENABLED ? [BullModule.registerQueue({ name: 'invoice-ocr' })] : []),
    MulterModule.register({ storage: undefined }), // memoryStorage (default)
    ProductsModule,
    AiModule,
  ],
  controllers: [InvoiceUploadController],
  providers: [
    SuppliersService,
    SuppliersResolver,
    InvoiceOcrService,
    InvoiceOcrResolver,
    ...(REDIS_ENABLED ? [InvoiceOcrProcessor] : []),
  ],
  exports: [SuppliersService, InvoiceOcrService],
})
export class SuppliersModule {}
