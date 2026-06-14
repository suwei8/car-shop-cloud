import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MarketingService } from './marketing.service';
import { CurrentUser, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';
import { SegmentPreviewDto } from './dto/segment.dto';
import { CreateCampaignDto } from './dto/campaign.dto';
import { CreateCouponDto, DistributeCouponDto } from './dto/coupon.dto';

@ApiTags('marketing')
@ApiBearerAuth()
@Controller('marketing')
@TenantRequired()
export class MarketingController {
  constructor(private service: MarketingService) {}

  // ==================== 客户分群 ====================

  @Post('segments/preview')
  @ApiOperation({ summary: '预览客户分群' })
  async previewSegment(
    @CurrentUser() user: JwtPayload,
    @Body() query: SegmentPreviewDto,
  ) {
    return this.service.previewSegment(user, query);
  }

  // ==================== 营销活动 ====================

  @Post('campaigns')
  @ApiOperation({ summary: '创建营销活动（批量发短信）' })
  async createCampaign(
    @CurrentUser() user: JwtPayload,
    @Body() data: CreateCampaignDto,
  ) {
    return this.service.createCampaign(user, data);
  }

  // ==================== 优惠券 ====================

  @Get('coupons')
  @ApiOperation({ summary: '优惠券列表' })
  async getCoupons(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.service.getCoupons(user, { page, pageSize });
  }

  @Post('coupons')
  @ApiOperation({ summary: '创建优惠券' })
  async createCoupon(
    @CurrentUser() user: JwtPayload,
    @Body() data: CreateCouponDto,
  ) {
    return this.service.createCoupon(user, data);
  }

  @Post('coupons/:id/distribute')
  @ApiOperation({ summary: '发放优惠券' })
  async distributeCoupon(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() data: DistributeCouponDto,
  ) {
    return this.service.distributeCoupon(user, id, data);
  }

  @Get('coupons/customer/:customerId')
  @ApiOperation({ summary: '客户可用优惠券' })
  async getCustomerCoupons(
    @CurrentUser() user: JwtPayload,
    @Param('customerId') customerId: string,
  ) {
    return this.service.getCustomerCoupons(user, customerId);
  }
}
