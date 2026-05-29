import {
  Controller, Get, Post,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettlementService } from './settlement.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('settlements')
@ApiBearerAuth()
@Controller('settlements')
@TenantRequired()
export class SettlementController {
  constructor(private service: SettlementService) {}

  @Get()
  @RequirePermissions('tenant:settlement:view')
  @ApiOperation({ summary: '结算单列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; shopId?: string; status?: string }) {
    return this.service.findAll(user, query);
  }

  @Get('payments')
  @RequirePermissions('tenant:settlement:view')
  @ApiOperation({ summary: '收款记录' })
  getPayments(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; payMethod?: string; startDate?: string; endDate?: string }) {
    return this.service.getPayments(user, query);
  }

  @Get(':id')
  @RequirePermissions('tenant:settlement:view')
  @ApiOperation({ summary: '结算单详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:settlement:manage')
  @ApiOperation({ summary: '工单结算' })
  settle(@Body() body: { workOrderId: string; discountAmount?: number; payments: any[] }, @CurrentUser() user: JwtPayload) {
    return this.service.settle(body, user);
  }

  @Post(':id/reverse')
  @RequirePermissions('tenant:settlement:manage')
  @ApiOperation({ summary: '反结算' })
  reverse(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.reverse(id, user);
  }
}
