import {
  Controller, Get, Post,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeatureFlagService } from './feature-flag.service';
import { Roles, RequirePermissions } from '../../common/decorators';

@ApiTags('platform/feature-flags')
@ApiBearerAuth()
@Controller('platform/feature-flags')
@Roles('platform_admin')
export class FeatureFlagController {
  constructor(private service: FeatureFlagService) {}

  @Get()
  @RequirePermissions('platform:feature:manage')
  @ApiOperation({ summary: '功能开关列表' })
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @RequirePermissions('platform:feature:manage')
  @ApiOperation({ summary: '创建功能开关' })
  create(@Body() body: { code: string; name: string; description?: string }) {
    return this.service.create(body);
  }

  @Post(':tenantId/:flagId')
  @RequirePermissions('platform:feature:manage')
  @ApiOperation({ summary: '设置商户功能开关' })
  setTenantFlag(
    @Param('tenantId') tenantId: string,
    @Param('flagId') flagId: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.service.setTenantFlag(tenantId, flagId, body.enabled);
  }
}
