import { Controller, Get, Query, Res, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportService } from './report.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@TenantRequired()
export class ReportController {
  constructor(private service: ReportService) {}

  private validateDates(query: { startDate?: string; endDate?: string }) {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('缺少 startDate 或 endDate 参数');
    }
    const s = new Date(query.startDate);
    const e = new Date(query.endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      throw new BadRequestException('startDate 或 endDate 格式无效');
    }
  }

  @Get('daily')
  @RequirePermissions('tenant:report:view')
  @ApiOperation({ summary: '营业日报' })
  getDailyReport(@CurrentUser() user: JwtPayload, @Query() query: { startDate: string; endDate: string; shopId?: string }) {
    this.validateDates(query);
    return this.service.getDailyReport(user, query);
  }

  @Get('daily/export')
  @RequirePermissions('tenant:report:view')
  @ApiOperation({ summary: '营业日报导出 Excel' })
  async exportDailyReport(
    @CurrentUser() user: JwtPayload,
    @Query() query: { startDate: string; endDate: string; shopId?: string },
    @Res() res: Response,
  ) {
    this.validateDates(query);
    const buffer = await this.service.exportDailyReport(user, query);
    const filename = encodeURIComponent(`营业日报_${query.startDate}_${query.endDate}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('technician')
  @RequirePermissions('tenant:report:view')
  @ApiOperation({ summary: '技师产值' })
  getTechnicianReport(@CurrentUser() user: JwtPayload, @Query() query: { startDate: string; endDate: string }) {
    this.validateDates(query);
    return this.service.getTechnicianReport(user, query);
  }

  @Get('technician/export')
  @RequirePermissions('tenant:report:view')
  @ApiOperation({ summary: '技师产值导出 Excel' })
  async exportTechnicianReport(
    @CurrentUser() user: JwtPayload,
    @Query() query: { startDate: string; endDate: string },
    @Res() res: Response,
  ) {
    this.validateDates(query);
    const buffer = await this.service.exportTechnicianReport(user, query);
    const filename = encodeURIComponent(`技师产值_${query.startDate}_${query.endDate}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
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
    this.validateDates(query);
    return this.service.getPackageCardReport(user, query);
  }
}
