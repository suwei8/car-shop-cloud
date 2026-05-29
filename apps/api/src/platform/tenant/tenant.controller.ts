import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlatformTenantService } from './tenant.service';
import { Roles, RequirePermissions } from '../../common/decorators';

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
  create(@Body() body: { name: string; contactName?: string; contactPhone?: string }) {
    return this.service.create(body);
  }

  @Put(':id')
  @RequirePermissions('platform:tenant:update')
  @ApiOperation({ summary: '编辑商户' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('platform:tenant:delete')
  @ApiOperation({ summary: '停用商户' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
