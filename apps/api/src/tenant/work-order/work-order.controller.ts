import {
  Controller, Get, Post, Put,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkOrderService } from './work-order.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('work-orders')
@ApiBearerAuth()
@Controller('work-orders')
@TenantRequired()
export class WorkOrderController {
  constructor(private service: WorkOrderService) {}

  @Get()
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '工单列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; status?: string; shopId?: string; orderType?: string }) {
    return this.service.findAll(user, query);
  }

  @Get(':id')
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '工单详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:workorder:create')
  @ApiOperation({ summary: '创建工单（接车开单）' })
  create(@Body() body: any, @CurrentUser() user: JwtPayload) {
    return this.service.create(body, user);
  }

  @Put(':id/status')
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '更新工单状态' })
  updateStatus(@Param('id') id: string, @Body() body: { status: string }, @CurrentUser() user: JwtPayload) {
    return this.service.updateStatus(id, body.status, user);
  }

  @Post(':id/items')
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '添加工单项目' })
  addItems(@Param('id') id: string, @Body() body: { items: any[] }, @CurrentUser() user: JwtPayload) {
    return this.service.addItems(id, body.items, user);
  }
}
