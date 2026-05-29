import { Module } from '@nestjs/common';
import { ServiceItemService } from './service-item.service';
import { ServiceItemController } from './service-item.controller';

@Module({
  controllers: [ServiceItemController],
  providers: [ServiceItemService],
  exports: [ServiceItemService],
})
export class ServiceItemModule {}
