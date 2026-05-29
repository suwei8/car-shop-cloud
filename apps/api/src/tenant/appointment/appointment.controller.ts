import {
  Controller, Get, Post, Put,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AppointmentService } from './appointment.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
@TenantRequired()
export class AppointmentController {
  constructor(private service: AppointmentService) {}

  @Get()
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '预约列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; status?: string; shopId?: string; date?: string }) {
    return this.service.findAll(user, query);
  }

  @Get(':id')
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '预约详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:workorder:create')
  @ApiOperation({ summary: '创建预约' })
  create(@Body() body: any, @CurrentUser() user: JwtPayload) {
    return this.service.create(body, user);
  }

  @Put(':id/status')
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '更新预约状态' })
  updateStatus(@Param('id') id: string, @Body() body: { status: string }, @CurrentUser() user: JwtPayload) {
    return this.service.updateStatus(id, body.status, user);
  }
}
