import { Module } from '@nestjs/common';
import { PlatformTenantService } from './tenant.service';
import { PlatformTenantController } from './tenant.controller';
import { TenantInitializerService } from './tenant-initializer.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformTenantController],
  providers: [PlatformTenantService, TenantInitializerService],
  exports: [PlatformTenantService, TenantInitializerService],
})
export class PlatformTenantModule {}
