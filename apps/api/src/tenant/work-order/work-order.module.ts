import { Module } from '@nestjs/common';
import { WorkOrderService } from './work-order.service';
import { WorkOrderController } from './work-order.controller';
import { StockModule } from '../stock/stock.module';
import { NotificationModule } from '../../notification/notification.module';

@Module({
  imports: [StockModule, NotificationModule],
  controllers: [WorkOrderController],
  providers: [WorkOrderService],
  exports: [WorkOrderService],
})
export class WorkOrderModule {}
