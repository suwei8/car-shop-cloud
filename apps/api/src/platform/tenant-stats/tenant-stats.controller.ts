import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantStatsService } from './tenant-stats.service';
import { Roles, RequirePermissions } from '../../common/decorators';

@ApiTags('platform/tenant-stats')
@ApiBearerAuth()
@Controller('platform/tenant-stats')
@Roles('platform_admin')
export class TenantStatsController {
  constructor(private service: TenantStatsService) {}

  @Get()
  @RequirePermissions('platform:tenant:view')
  @ApiOperation({ summary: '全部商户概览' })
  getAll() {
    return this.service.getAllTenantsOverview();
  }

  @Get(':tenantId')
  @RequirePermissions('platform:tenant:view')
  @ApiOperation({ summary: '单个商户使用统计' })
  getOne(@Param('tenantId') tenantId: string) {
    return this.service.getTenantStats(tenantId);
  }
}
