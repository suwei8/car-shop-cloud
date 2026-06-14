import { Controller, Post, Headers, Req, HttpCode, Logger, Header } from '@nestjs/common';
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
  @Header('Content-Type', 'text/xml')
  async wechatCallback(
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const rawBody = (req as any).rawBody || req.body;
    try {
      await this.gateway.handleCallback('wechat', headers, rawBody);
      return '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
    } catch (err: any) {
      this.logger.error(`wechatCallback error: ${err}`);
      return `<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[${err.message || 'Error'}]]></return_msg></xml>`;
    }
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
