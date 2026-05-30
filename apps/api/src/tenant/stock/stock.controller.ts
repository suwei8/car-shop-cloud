import {
  Controller, Get, Post,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('stock')
@ApiBearerAuth()
@Controller('stock')
@TenantRequired()
export class StockController {
  constructor(private service: StockService) {}

  @Get('balances')
  @RequirePermissions('tenant:inventory:view')
  @ApiOperation({ summary: '库存余额' })
  getBalances(@CurrentUser() user: JwtPayload, @Query() query: { warehouseId?: string; partId?: string; lowStock?: boolean }) {
    return this.service.getBalances(user, query);
  }

  @Get('movements')
  @RequirePermissions('tenant:inventory:view')
  @ApiOperation({ summary: '库存流水' })
  getMovements(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; partId?: string; movementType?: string }) {
    return this.service.getMovements(user, query);
  }

  @Get('bills')
  @RequirePermissions('tenant:inventory:view')
  @ApiOperation({ summary: '库存单据' })
  getBills(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; billType?: string; shopId?: string }) {
    return this.service.getBills(user, query);
  }

  @Post('in')
  @RequirePermissions('tenant:inventory:manage')
  @ApiOperation({ summary: '入库' })
  stockIn(@Body() body: { shopId: string; supplierId?: string; remark?: string; items: { partId: string; quantity: number; unitPrice: number }[] }, @CurrentUser() user: JwtPayload) {
    return this.service.stockIn(body, user);
  }

  @Post('out/work-order/:workOrderId')
  @RequirePermissions('tenant:inventory:manage')
  @ApiOperation({ summary: '工单出库' })
  stockOutForWorkOrder(@Param('workOrderId') workOrderId: string, @CurrentUser() user: JwtPayload) {
    return this.service.stockOutForWorkOrder(workOrderId, user);
  }
}
