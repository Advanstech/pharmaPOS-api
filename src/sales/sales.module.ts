import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesResolver } from './sales.resolver';
import { AuthModule } from '../auth/auth.module';
import { PharmacyModule } from '../pharmacy/pharmacy.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [AuthModule, PharmacyModule, InventoryModule],
  providers: [SalesService, SalesResolver],
  exports: [SalesService],
})
export class SalesModule {}
