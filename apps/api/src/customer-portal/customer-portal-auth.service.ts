import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SmsCodeService } from '../auth/sms-code.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class CustomerPortalAuthService {
  private readonly logger = new Logger(CustomerPortalAuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private smsCodeService: SmsCodeService,
  ) {}

  async wxLogin(code: string): Promise<{ openid: string; bound: boolean; token?: string }> {
    const appId = this.config.get<string>('WX_MINI_APPID');
    const appSecret = this.config.get<string>('WX_MINI_SECRET');

    let openid: string;

    if (!appId || !appSecret) {
      this.logger.warn('WX_MINI_APPID/SECRET not configured, using mock openid for development');
      openid = `mock_openid_${code}`;
    } else {
      try {
        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
        const res = await fetch(url);
        const data = await res.json() as any;
        if (data.errcode) {
          throw new BadRequestException(`微信登录失败: ${data.errmsg}`);
        }
        openid = data.openid;
      } catch (err) {
        this.logger.error(`wx code2session failed: ${err.message}`);
        throw new BadRequestException('微信登录服务暂时不可用');
      }
    }

    const bindings = await this.prisma.customerWxBinding.findMany({
      where: { openid },
      include: { customer: true, tenant: true },
    });

    if (bindings.length === 0) {
      return { openid, bound: false };
    }

    const binding = bindings[0];
    const token = await this.signCustomerToken(binding.tenantId, binding.customerId, openid);

    return { openid, bound: true, token };
  }

  async bindAndLogin(openid: string, phone: string, smsCode: string, ip: string): Promise<{ token: string }> {
    await this.smsCodeService.verifyCode(phone, smsCode);

    const customers = await this.prisma.customer.findMany({
      where: { phone, status: 'active' },
      include: { tenant: true },
    });

    if (customers.length === 0) {
      throw new BadRequestException('未找到该手机号关联的客户记录');
    }

    for (const customer of customers) {
      const existing = await this.prisma.customerWxBinding.findFirst({
        where: { tenantId: customer.tenantId, openid },
      });
      if (!existing) {
        await this.prisma.customerWxBinding.create({
          data: {
            tenantId: customer.tenantId,
            customerId: customer.id,
            openid,
          },
        });
      }
    }

    const firstCustomer = customers[0];
    const token = await this.signCustomerToken(firstCustomer.tenantId, firstCustomer.id, openid);

    return { token };
  }

  async switchShop(openid: string, tenantId: string, customerId: string): Promise<{ token: string }> {
    const binding = await this.prisma.customerWxBinding.findFirst({
      where: { openid, tenantId, customerId },
    });

    if (!binding) {
      throw new UnauthorizedException('无权切换到该门店');
    }

    const token = await this.signCustomerToken(tenantId, customerId, openid);
    return { token };
  }

  async getBindings(openid: string) {
    const bindings = await this.prisma.customerWxBinding.findMany({
      where: { openid },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        tenant: { select: { id: true, name: true } },
      },
    });

    return bindings.map(b => ({
      tenantId: b.tenantId,
      tenantName: b.tenant.name,
      customerId: b.customerId,
      customerName: b.customer.name,
      phone: b.customer.phone,
    }));
  }

  async sendSmsCode(phone: string, ip: string) {
    const code = await this.smsCodeService.generateCode(phone, ip);
    this.logger.log(`Customer portal SMS code generated for ${phone}: ${code}`);
    return { message: '验证码已发送' };
  }

  private async signCustomerToken(tenantId: string, customerId: string, openid: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { tenant: { select: { name: true, status: true } } },
    });

    if (!customer) {
      throw new UnauthorizedException('客户不存在');
    }

    const payload: JwtPayload = {
      sub: `wx:${openid}`,
      tenantId,
      shopId: null,
      isPlatform: false,
      roles: ['customer'],
      permissions: [],
      audience: 'customer',
      customerId,
    };

    const secret =
      this.config.get<string>('JWT_CUSTOMER_SECRET') ||
      this.config.get<string>('JWT_SECRET') + ':customer';

    return this.jwtService.sign(payload, {
      secret,
      expiresIn: '7d',
    });
  }
}
