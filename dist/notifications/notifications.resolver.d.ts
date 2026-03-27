import { NotificationsService } from './notifications.service';
import { StockAlertNotification } from './dto/stock-alert-notification.types';
import { JwtUser } from '../auth/decorators/current-user.decorator';
export declare class NotificationsResolver {
    private readonly notifications;
    constructor(notifications: NotificationsService);
    myStockAlerts(actor: JwtUser, limit?: number): Promise<StockAlertNotification[]>;
}
