import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InspectionService } from './inspection.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('inspections')
@ApiBearerAuth()
@Controller('inspections')
@TenantRequired()
export class InspectionController {
  constructor(private service: InspectionService) {}

  @Get()
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '查询工单检查记录' })
  findByWorkOrder(@Query('workOrderId') workOrderId: string, @CurrentUser() user: JwtPayload) {
    return this.service.findByWorkOrder(workOrderId, user);
  }

  @Post()
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '创建检查记录' })
  create(@Body() body: any, @CurrentUser() user: JwtPayload) {
    return this.service.create(body, user);
  }

  @Post('batch')
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '批量创建检查记录' })
  batchCreate(@Body() body: { workOrderId: string; records: any[] }, @CurrentUser() user: JwtPayload) {
    return this.service.batchCreate(body.workOrderId, body.records, user);
  }

  @Put(':id')
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '更新检查记录' })
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, body, user);
  }

  @Delete(':id')
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '删除检查记录' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }
}
