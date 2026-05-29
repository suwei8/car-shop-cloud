import {
  Controller, Get, Post,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoredValueCardService } from './stored-value-card.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('stored-value-cards')
@ApiBearerAuth()
@Controller('stored-value-cards')
@TenantRequired()
export class StoredValueCardController {
  constructor(private service: StoredValueCardService) {}

  @Get()
  @RequirePermissions('tenant:member:view')
  @ApiOperation({ summary: '储值卡列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; customerId?: string; status?: string }) {
    return this.service.findAll(user, query);
  }

  @Get('transactions')
  @RequirePermissions('tenant:member:view')
  @ApiOperation({ summary: '储值流水' })
  getTransactions(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; cardId?: string }) {
    return this.service.getTransactions(user, query);
  }

  @Get(':id')
  @RequirePermissions('tenant:member:view')
  @ApiOperation({ summary: '储值卡详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:member:manage')
  @ApiOperation({ summary: '售卡' })
  create(@Body() body: { cardNo: string; customerId: string; amount: number; gift?: number; remark?: string }, @CurrentUser() user: JwtPayload) {
    return this.service.create(body, user);
  }

  @Post(':id/recharge')
  @RequirePermissions('tenant:member:manage')
  @ApiOperation({ summary: '充值' })
  recharge(@Param('id') id: string, @Body() body: { amount: number; gift?: number; remark?: string }, @CurrentUser() user: JwtPayload) {
    return this.service.recharge(id, body, user);
  }

  @Post(':id/refund')
  @RequirePermissions('tenant:member:manage')
  @ApiOperation({ summary: '退款' })
  refund(@Param('id') id: string, @Body() body: { amount: number; remark: string }, @CurrentUser() user: JwtPayload) {
    return this.service.refund(id, body, user);
  }
}
