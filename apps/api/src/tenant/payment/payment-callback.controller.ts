import { Controller, Post, Headers, Req, HttpCode, Logger } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../common/decorators';
import { PaymentGatewayService } from './payment-gateway.service';

@Controller('payment-callbacks')
export class PaymentCallbackController {
  private logger = new Logger('PaymentCallback');

  constructor(private gateway: PaymentGatewayService) {}

  @Public()
  @Post('wechat')
  @HttpCode(200)
  async wechatCallback(
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    await this.gateway.handleCallback('wechat', headers, rawBody);
    return { code: 'SUCCESS', message: 'OK' };
  }

  @Public()
  @Post('alipay')
  @HttpCode(200)
  async alipayCallback(
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    await this.gateway.handleCallback('alipay', headers, rawBody);
    return 'success';
  }
}
