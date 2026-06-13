import {
  Controller, Get, Post,
  Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public, CurrentUser } from '../common/decorators';
import { CustomerPortalAuthService } from './customer-portal-auth.service';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerJwtAuthGuard } from './customer-jwt-auth.guard';
import {
  CustomerWxLoginDto,
  CustomerBindDto,
  CustomerSwitchShopDto,
} from './dto/customer-portal.dto';
import { JwtPayload } from '@car/shared';
import { Request } from 'express';

@ApiTags('customer-portal')
@Controller('customer-portal')
@UseGuards(CustomerJwtAuthGuard)
export class CustomerPortalController {
  constructor(
    private authService: CustomerPortalAuthService,
    private portalService: CustomerPortalService,
  ) {}

  // ---- Auth (Public) ----

  @Post('auth/login')
  @Public()
  @ApiOperation({ summary: '微信小程序登录（code 换 openid / token）' })
  async wxLogin(@Body() dto: CustomerWxLoginDto) {
    return this.authService.wxLogin(dto.code);
  }

  @Post('auth/bind')
  @Public()
  @ApiOperation({ summary: '手机号绑定并登录' })
  async bind(@Body() dto: CustomerBindDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || '0.0.0.0';
    return this.authService.bindAndLogin(dto.openid, dto.phone, dto.code, ip);
  }

  @Post('auth/send-code')
  @Public()
  @ApiOperation({ summary: '发送短信验证码' })
  async sendCode(@Body('phone') phone: string, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || '0.0.0.0';
    return this.authService.sendSmsCode(phone, ip);
  }

  // ---- Protected endpoints ----

  @Post('auth/switch-shop')
  @ApiOperation({ summary: '切换门店' })
  async switchShop(
    @Body() dto: CustomerSwitchShopDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const openid = user.sub.replace('wx:', '');
    return this.authService.switchShop(openid, dto.tenantId, dto.customerId);
  }

  @Get('me')
  @ApiOperation({ summary: '当前客户信息' })
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.portalService.getMe(user.customerId!, user.tenantId!);
  }

  @Get('bindings')
  @ApiOperation({ summary: '查询当前 openid 绑定的所有门店' })
  async getBindings(@CurrentUser() user: JwtPayload) {
    const openid = user.sub.replace('wx:', '');
    return this.authService.getBindings(openid);
  }

  @Get('work-orders')
  @ApiBearerAuth()
  @ApiOperation({ summary: '我的工单列表' })
  async getWorkOrders(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.portalService.getWorkOrders(user.customerId!, user.tenantId!, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('work-orders/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '工单详情' })
  async getWorkOrderDetail(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.portalService.getWorkOrderDetail(id, user.customerId!, user.tenantId!);
  }

  @Get('cards')
  @ApiBearerAuth()
  @ApiOperation({ summary: '储值卡余额 + 套餐卡剩余次数' })
  async getCards(@CurrentUser() user: JwtPayload) {
    return this.portalService.getCards(user.customerId!, user.tenantId!);
  }
}
