import {
  Controller, Get, Post, Put,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@TenantRequired()
export class UserController {
  constructor(private service: UserService) {}

  @Get()
  @RequirePermissions('tenant:user:view')
  @ApiOperation({ summary: '员工列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; shopId?: string }) {
    return this.service.findAll(user, query);
  }

  @Get(':id')
  @RequirePermissions('tenant:user:view')
  @ApiOperation({ summary: '员工详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:user:create')
  @ApiOperation({ summary: '创建员工' })
  create(@Body() body: { name: string; phone: string; password: string; shopId: string; position?: string; roleIds: string[] }, @CurrentUser() user: JwtPayload) {
    return this.service.create(body, user);
  }

  @Put(':id')
  @RequirePermissions('tenant:user:update')
  @ApiOperation({ summary: '编辑员工' })
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, body, user);
  }

  @Put(':id/status')
  @RequirePermissions('tenant:user:update')
  @ApiOperation({ summary: '更新员工状态' })
  updateStatus(@Param('id') id: string, @Body() body: { status: string }, @CurrentUser() user: JwtPayload) {
    return this.service.updateStatus(id, body.status, user);
  }
}
