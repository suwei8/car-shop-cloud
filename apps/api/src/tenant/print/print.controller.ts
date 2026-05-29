import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrintService } from './print.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('print')
@ApiBearerAuth()
@Controller('print')
@TenantRequired()
export class PrintController {
  constructor(private service: PrintService) {}

  @Get('work-order/:id')
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '工单打印数据' })
  getWorkOrderPrintData(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getWorkOrderPrintData(id, user);
  }

  @Get('settlement/:id')
  @RequirePermissions('tenant:settlement:view')
  @ApiOperation({ summary: '结算单打印数据' })
  getSettlementPrintData(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getSettlementPrintData(id, user);
  }
}
