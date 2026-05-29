import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@TenantRequired()
export class ReportController {
  constructor(private service: ReportService) {}

  @Get('daily')
  @RequirePermissions('tenant:report:view')
  @ApiOperation({ summary: '营业日报' })
  getDailyReport(@CurrentUser() user: JwtPayload, @Query() query: { startDate: string; endDate: string; shopId?: string }) {
    return this.service.getDailyReport(user, query);
  }

  @Get('technician')
  @RequirePermissions('tenant:report:view')
  @ApiOperation({ summary: '技师产值' })
  getTechnicianReport(@CurrentUser() user: JwtPayload, @Query() query: { startDate: string; endDate: string }) {
    return this.service.getTechnicianReport(user, query);
  }

  @Get('low-stock')
  @RequirePermissions('tenant:report:view')
  @ApiOperation({ summary: '库存预警' })
  getLowStockAlert(@CurrentUser() user: JwtPayload) {
    return this.service.getLowStockAlert(user);
  }

  @Get('customers')
  @RequirePermissions('tenant:report:view')
  @ApiOperation({ summary: '客户统计' })
  getCustomerStats(@CurrentUser() user: JwtPayload) {
    return this.service.getCustomerStats(user);
  }

  @Get('stored-value')
  @RequirePermissions('tenant:report:view')
  @ApiOperation({ summary: '储值余额报表' })
  getStoredValueReport(@CurrentUser() user: JwtPayload) {
    return this.service.getStoredValueReport(user);
  }

  @Get('package-card')
  @RequirePermissions('tenant:report:view')
  @ApiOperation({ summary: '套餐核销流水报表' })
  getPackageCardReport(@CurrentUser() user: JwtPayload, @Query() query: { startDate: string; endDate: string }) {
    return this.service.getPackageCardReport(user, query);
  }
}
