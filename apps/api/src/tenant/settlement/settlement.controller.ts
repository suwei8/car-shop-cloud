import {
  Controller, Get, Post,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettlementService } from './settlement.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';
import { SettleDto } from './dto/settlement.dto';
import { RefundDto } from '../payment/dto/refund.dto';

@ApiTags('settlements')
@ApiBearerAuth()
@Controller('settlements')
@TenantRequired()
export class SettlementController {
  constructor(private service: SettlementService) {}

  @Get()
  @RequirePermissions('tenant:settlement:view')
  @ApiOperation({ summary: '结算单列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; shopId?: string; status?: string; workOrderId?: string }) {
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

  @Get(':id/payment-status')
  @RequirePermissions('tenant:settlement:view')
  @ApiOperation({ summary: '查询结算单支付状态' })
  getPaymentStatus(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getPaymentStatus(id, user);
  }

  @Post()
  @RequirePermissions('tenant:settlement:manage')
  @ApiOperation({ summary: '工单结算' })
  settle(@Body() dto: SettleDto, @CurrentUser() user: JwtPayload) {
    return this.service.settle(dto, user);
  }

  @Post(':id/reverse')
  @RequirePermissions('tenant:settlement:manage')
  @ApiOperation({ summary: '反结算' })
  reverse(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.reverse(id, user);
  }

  @Post(':id/payments/:paymentId/refund')
  @RequirePermissions('tenant:settlement:manage')
  @ApiOperation({ summary: '发起退款' })
  refund(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: RefundDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.refundPayment(id, paymentId, dto, user);
  }
}
