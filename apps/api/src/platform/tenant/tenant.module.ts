import { Module } from '@nestjs/common';
import { PlatformTenantService } from './tenant.service';
import { PlatformTenantController } from './tenant.controller';

@Module({
  controllers: [PlatformTenantController],
  providers: [PlatformTenantService],
  exports: [PlatformTenantService],
})
export class PlatformTenantModule {}
