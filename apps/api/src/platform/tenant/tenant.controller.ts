import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlatformTenantService } from './tenant.service';
import { Roles, RequirePermissions, CurrentUser } from '../../common/decorators';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';
import { RenewDto } from './dto/renew.dto';
import { ExtendDto } from './dto/extend.dto';
import { SuspendDto } from './dto/suspend.dto';
import { JwtPayload } from '@car/shared';

@ApiTags('platform/tenants')
@ApiBearerAuth()
@Controller('platform/tenants')
@Roles('platform_admin')
export class PlatformTenantController {
  constructor(private service: PlatformTenantService) {}

  @Get()
  @RequirePermissions('platform:tenant:view')
  @ApiOperation({ summary: '商户列表' })
  findAll(@Query() query: { page?: number; pageSize?: number; status?: string }) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('platform:tenant:view')
  @ApiOperation({ summary: '商户详情' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('platform:tenant:create')
  @ApiOperation({ summary: '创建商户' })
  create(@Body() dto: CreateTenantDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions('platform:tenant:update')
  @ApiOperation({ summary: '编辑商户' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('platform:tenant:delete')
  @ApiOperation({ summary: '停用商户' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/renew')
  @RequirePermissions('platform:tenant:update')
  @ApiOperation({ summary: '续费' })
  renew(@Param('id') id: string, @Body() dto: RenewDto, @CurrentUser() user: JwtPayload) {
    return this.service.renew(id, dto.planId, dto.months, user.sub);
  }

  @Post(':id/extend')
  @RequirePermissions('platform:tenant:update')
  @ApiOperation({ summary: '延期' })
  extend(@Param('id') id: string, @Body() dto: ExtendDto, @CurrentUser() user: JwtPayload) {
    return this.service.extend(id, dto.days, dto.reason, user.sub);
  }

  @Post(':id/suspend')
  @RequirePermissions('platform:tenant:update')
  @ApiOperation({ summary: '手动停用' })
  suspend(@Param('id') id: string, @Body() dto: SuspendDto, @CurrentUser() user: JwtPayload) {
    return this.service.suspend(id, dto.reason, user.sub);
  }

  @Post(':id/resume')
  @RequirePermissions('platform:tenant:update')
  @ApiOperation({ summary: '恢复' })
  resume(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.resume(id, user.sub);
  }

  @Post(':id/impersonate')
  @RequirePermissions('platform:tenant:update')
  @ApiOperation({ summary: '代登录' })
  impersonate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user.isPlatform) {
      throw new ForbiddenException('仅平台管理员可执行代登录');
    }
    return this.service.impersonate(id, user.sub);
  }
}
