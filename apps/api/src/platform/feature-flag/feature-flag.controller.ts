import {
  Controller, Get, Post,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeatureFlagService } from './feature-flag.service';
import { Roles, RequirePermissions, CurrentUser, TenantRequired } from '../../common/decorators';
import { CreateFeatureFlagDto, SetTenantFlagDto } from './dto/feature-flag.dto';
import { JwtPayload } from '@car/shared';

@ApiTags('platform/feature-flags')
@ApiBearerAuth()
@Controller('feature-flags')
export class FeatureFlagController {
  constructor(private service: FeatureFlagService) {}

  // ---- 商户端：查询当前租户的 flags ----
  @Get('my')
  @TenantRequired()
  @ApiOperation({ summary: '查询当前租户的功能开关' })
  async getMyFlags(@CurrentUser() user: JwtPayload) {
    return this.service.getTenantFlagsAsMap(user.tenantId!);
  }

  // ---- 平台端（需 platform_admin）----
  @Get()
  @Roles('platform_admin')
  @RequirePermissions('platform:feature:manage')
  @ApiOperation({ summary: '功能开关列表' })
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles('platform_admin')
  @RequirePermissions('platform:feature:manage')
  @ApiOperation({ summary: '创建功能开关' })
  create(@Body() dto: CreateFeatureFlagDto) {
    return this.service.create(dto);
  }

  @Post(':tenantId/:flagId')
  @Roles('platform_admin')
  @RequirePermissions('platform:feature:manage')
  @ApiOperation({ summary: '设置商户功能开关' })
  setTenantFlag(
    @Param('tenantId') tenantId: string,
    @Param('flagId') flagId: string,
    @Body() dto: SetTenantFlagDto,
  ) {
    return this.service.setTenantFlag(tenantId, flagId, dto.enabled);
  }
}
