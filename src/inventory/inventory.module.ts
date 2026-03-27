import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryResolver } from './inventory.resolver';
import { AuthModule } from '../auth/auth.module';
import { RealtimeStockService } from './realtime-stock.service';
import { StockAlertsService } from './stock-alerts.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  providers: [InventoryService, InventoryResolver, RealtimeStockService, StockAlertsService],
  exports: [InventoryService, RealtimeStockService],
})
export class InventoryModule {}
