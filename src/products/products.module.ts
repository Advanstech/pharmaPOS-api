import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';
import { ProductsResolver } from './products.resolver';
import { PriceService } from './price.service';
import { PriceResolver } from './price.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  providers: [ProductsService, ProductsResolver, PriceService, PriceResolver],
  exports: [ProductsService, PriceService],
})
export class ProductsModule {}
