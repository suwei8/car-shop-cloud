import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CurrentUser, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@TenantRequired()
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  @Get('revenue')
  @ApiOperation({ summary: '营收趋势' })
  async getRevenue(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.service.getRevenueTrend(user, query);
  }

  @Get('work-orders')
  @ApiOperation({ summary: '工单统计' })
  async getWorkOrders(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.service.getWorkOrderStats(user, query);
  }

  @Get('technicians')
  @ApiOperation({ summary: '技师产能排行' })
  async getTechnicians(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.service.getTechnicianRanking(user, query);
  }

  @Get('customers')
  @ApiOperation({ summary: '客户分析' })
  async getCustomers(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.service.getCustomerAnalysis(user, query);
  }

  @Get('parts')
  @ApiOperation({ summary: '配件消耗 TOP 10' })
  async getParts(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.service.getPartsConsumption(user, query);
  }
}
