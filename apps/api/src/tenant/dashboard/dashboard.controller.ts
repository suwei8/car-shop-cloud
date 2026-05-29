import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@TenantRequired()
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: '工作台概览' })
  getOverview(@CurrentUser() user: JwtPayload) {
    return this.service.getOverview(user);
  }

  @Get('recent-orders')
  @ApiOperation({ summary: '最近工单' })
  getRecentOrders(@CurrentUser() user: JwtPayload, @Query('limit') limit?: number) {
    return this.service.getRecentOrders(user, limit || 10);
  }

  @Get('today-appointments')
  @ApiOperation({ summary: '今日预约' })
  getTodayAppointments(@CurrentUser() user: JwtPayload) {
    return this.service.getTodayAppointments(user);
  }
}
