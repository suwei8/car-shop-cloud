import {
  Controller, Get, Post, Put, Delete,
  Body, Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
@TenantRequired()
export class RoleController {
  constructor(private service: RoleService) {}

  @Get()
  @RequirePermissions('tenant:role:view')
  @ApiOperation({ summary: '角色列表' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @RequirePermissions('tenant:role:view')
  @ApiOperation({ summary: '角色详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:role:manage')
  @ApiOperation({ summary: '创建角色' })
  create(@Body() body: { name: string; code: string; description?: string; permissionIds: string[] }, @CurrentUser() user: JwtPayload) {
    return this.service.create(body, user);
  }

  @Put(':id')
  @RequirePermissions('tenant:role:manage')
  @ApiOperation({ summary: '编辑角色' })
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, body, user);
  }

  @Delete(':id')
  @RequirePermissions('tenant:role:manage')
  @ApiOperation({ summary: '删除角色' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }
}
