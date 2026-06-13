import { Module } from '@nestjs/common';
import { WorkOrderService } from './work-order.service';
import { WorkOrderController } from './work-order.controller';
import { StockModule } from '../stock/stock.module';
import { NotificationModule } from '../../notification/notification.module';
import { PlatformFeatureFlagModule } from '../../platform/feature-flag/feature-flag.module';

@Module({
  imports: [StockModule, NotificationModule, PlatformFeatureFlagModule],
  controllers: [WorkOrderController],
  providers: [WorkOrderService],
  exports: [WorkOrderService],
})
export class WorkOrderModule {}
