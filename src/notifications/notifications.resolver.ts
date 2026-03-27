import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { StockAlertNotification } from './dto/stock-alert-notification.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsResolver {
  constructor(private readonly notifications: NotificationsService) {}

  @Query(() => [StockAlertNotification], { name: 'myStockAlerts' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  myStockAlerts(
    @CurrentUser() actor: JwtUser,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<StockAlertNotification[]> {
    return this.notifications.getMyStockAlerts(actor.sub, actor.branchId, limit ?? 20);
  }
}
