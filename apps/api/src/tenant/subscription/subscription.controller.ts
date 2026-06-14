import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CurrentUser, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';
import { CreateSubscriptionOrderDto } from './dto/create-subscription-order.dto';
import { PaySubscriptionOrderDto } from './dto/pay-subscription-order.dto';

@ApiTags('subscription')
@ApiBearerAuth()
@Controller('subscription')
@TenantRequired()
export class SubscriptionController {
  constructor(private service: SubscriptionService) {}

  @Get('plans')
  @ApiOperation({ summary: '查询可购买套餐列表' })
  getPlans() {
    return this.service.getPlans();
  }

  @Get('current')
  @ApiOperation({ summary: '查看当前订阅信息' })
  getCurrentSubscription(@CurrentUser() user: JwtPayload) {
    return this.service.getCurrentSubscription(user);
  }

  @Post('orders')
  @ApiOperation({ summary: '创建订阅订单' })
  createOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSubscriptionOrderDto,
  ) {
    return this.service.createOrder(user, dto);
  }

  @Post('orders/:id/pay')
  @ApiOperation({ summary: '发起支付' })
  payOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: PaySubscriptionOrderDto,
  ) {
    return this.service.payOrder(user, id, dto);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: '查询订单状态' })
  getOrder(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getOrder(user, id);
  }

  @Get('history')
  @ApiOperation({ summary: '查看订阅历史' })
  getHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: { page?: number; pageSize?: number },
  ) {
    return this.service.getHistory(user, query);
  }
}
