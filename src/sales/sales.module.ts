import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesResolver } from './sales.resolver';
import { AuthModule } from '../auth/auth.module';
import { PharmacyModule } from '../pharmacy/pharmacy.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountingModule } from '../accounting/accounting.module';
import { TaxConfigService } from '../config/tax-config.service';

@Module({
  imports: [AuthModule, PharmacyModule, InventoryModule, NotificationsModule, AccountingModule],
  providers: [SalesService, SalesResolver, TaxConfigService],
  exports: [SalesService],
})
export class SalesModule {}
