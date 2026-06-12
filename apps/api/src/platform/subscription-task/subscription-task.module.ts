import { Module } from '@nestjs/common';
import { SubscriptionTaskService } from './subscription-task.service';
import { SubscriptionTaskController } from './subscription-task.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SubscriptionTaskController],
  providers: [SubscriptionTaskService, SubscriptionGuard],
  exports: [SubscriptionTaskService, SubscriptionGuard],
})
export class SubscriptionTaskModule {}
