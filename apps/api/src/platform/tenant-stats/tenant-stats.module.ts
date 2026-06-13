import { Module } from '@nestjs/common';
import { TenantStatsService } from './tenant-stats.service';
import { TenantStatsController } from './tenant-stats.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TenantStatsController],
  providers: [TenantStatsService],
  exports: [TenantStatsService],
})
export class TenantStatsModule {}
