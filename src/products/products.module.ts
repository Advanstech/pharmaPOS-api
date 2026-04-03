import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';
import { ProductsResolver } from './products.resolver';
import { PriceService } from './price.service';
import { PriceResolver } from './price.resolver';
import { S3UploadService } from './s3-upload.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  providers: [ProductsService, ProductsResolver, PriceService, PriceResolver, S3UploadService],
  exports: [ProductsService, PriceService],
})
export class ProductsModule {}
