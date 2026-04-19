import { Module, forwardRef } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryResolver } from './inventory.resolver';
import { AuthModule } from '../auth/auth.module';
import { RealtimeStockService } from './realtime-stock.service';
import { StockAlertsService } from './stock-alerts.service';
import { StockCountService } from './stock-count.service';
import { StockTransferService } from './stock-transfer.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [AuthModule, NotificationsModule, forwardRef(() => AccountingModule)],
  providers: [InventoryService, InventoryResolver, RealtimeStockService, StockAlertsService, StockCountService, StockTransferService],
  exports: [InventoryService, RealtimeStockService, StockCountService, StockTransferService],
})
export class InventoryModule {}
