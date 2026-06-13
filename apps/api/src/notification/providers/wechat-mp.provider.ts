import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WechatMpProvider {
  private readonly logger = new Logger(WechatMpProvider.name);
  private readonly appId: string;
  private readonly appSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.appId = this.config.get<string>('WX_MINI_APPID', '');
    this.appSecret = this.config.get<string>('WX_MINI_SECRET', '');
  }

  isConfigured(): boolean {
    return !!(this.appId && this.appSecret);
  }

  async sendSubscribeMessage(input: {
    openid: string;
    templateId: string;
    data: Record<string, { value: string }>;
    page?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured()) {
      this.logger.warn('WeChat MP not configured, mocking subscribe message');
      return { ok: true };
    }

    try {
      const accessToken = await this.getAccessToken();
      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          touser: input.openid,
          template_id: input.templateId,
          page: input.page || '',
          data: input.data,
        }),
      });

      const data = await res.json() as any;
      if (data.errcode && data.errcode !== 0) {
        this.logger.warn(`WeChat subscribe message failed: ${data.errmsg}`);
        return { ok: false, error: data.errmsg };
      }

      return { ok: true };
    } catch (err) {
      this.logger.error(`WeChat subscribe message error: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  async lookupOpenid(tenantId: string, customerId: string): Promise<string | null> {
    const binding = await this.prisma.customerWxBinding.findFirst({
      where: { tenantId, customerId },
    });
    return binding?.openid || null;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;
    const res = await fetch(url);
    const data = await res.json() as any;

    if (data.errcode) {
      throw new Error(`Failed to get access token: ${data.errmsg}`);
    }

    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
    return this.accessToken!;
  }
}
