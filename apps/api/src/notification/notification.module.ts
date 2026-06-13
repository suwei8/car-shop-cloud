import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { WechatMpProvider } from './providers/wechat-mp.provider';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [NotificationService, WechatMpProvider],
  exports: [NotificationService],
})
export class NotificationModule {}
