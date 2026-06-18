import { Injectable, BadRequestException, Logger, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SmsCodeService } from './sms-code.service';
import { TenantInitializerService } from '../platform/tenant/tenant-initializer.service';
import { NotificationService } from '../notification/notification.service';
import { randomUUID } from 'crypto';
import { JwtPayload } from '@car/shared';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

interface WechatSessionResult {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class WechatLoginService {
  private readonly logger = new Logger(WechatLoginService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private smsCodeService: SmsCodeService,
    private initializer: TenantInitializerService,
    private notificationService: NotificationService,
  ) {}

  /**
   * 微信小程序登录：用 code 换 openid，已绑定则登录，未绑定则返回 needBind
   */
  async login(code: string): Promise<
    | { needBind: false; accessToken: string; refreshToken: string; user: any; subscription?: any }
    | { needBind: true; openid: string }
  > {
    const openid = await this.code2Session(code);

    // 查找已绑定此 openid 的用户
    const user = await this.prisma.user.findFirst({
      where: { wxOpenid: openid, status: 'active' },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        employee: true,
      },
    });

    if (user) {
      // 已绑定 → 直接登录
      const loginResult = await this.generateLoginResult(user);
      return { needBind: false as const, ...loginResult };
    }

    // 未绑定 → 返回 needBind
    return { needBind: true, openid };
  }

  /**
   * 微信绑定： openid + 手机号 + 验证码 → 绑定或注册
   */
  async bind(data: {
    code: string;
    phone: string;
    smsCode: string;
    shopName?: string;
    businessType?: string;
    employeeCount?: number;
    address?: string;
    ip: string;
  }): Promise<{ accessToken: string; refreshToken: string; user: any; subscription?: any }> {
    const { code, phone, smsCode, shopName, businessType, employeeCount, address, ip } = data;

    // 1. 用 code 换 openid
    const openid = await this.code2Session(code);

    // 2. 验证短信验证码
    await this.smsCodeService.verifyCode(phone, smsCode);

    // 3. 查找该手机号是否已有用户
    const existingUsers = await this.prisma.user.findMany({
      where: { phone },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        employee: true,
      },
    });

    if (existingUsers.length > 1) {
      throw new ConflictException('该手机号关联多个账号，请联系管理员处理');
    }

    if (existingUsers.length === 1) {
      const existingUser = existingUsers[0];
      // 已有用户 → 绑定 openid
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { wxOpenid: openid },
      });

      return this.generateLoginResult(existingUser);
    }

    // 4. 新用户 → 需要 shopName / businessType
    if (!shopName || !businessType) {
      throw new BadRequestException('新用户绑定需要提供 shopName、businessType');
    }

    // 检查注册限流
    await this.smsCodeService.checkRegisterLimit(ip);

    const trialDays = parseInt(this.config.get('TRIAL_DAYS', '30'));
    const now = new Date();
    const trialEndAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
    const passwordHash = await bcrypt.hash(randomUUID(), 10);

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 5. 创建租户
      const tenant = await tx.tenant.create({
        data: {
          name: shopName,
          contactPhone: phone,
          businessType,
          employeeCount,
          subscriptionStatus: 'trial',
          subscriptionEndAt: trialEndAt,
        },
      });

      // 6. 创建试用订阅
      const trialPlan = await tx.subscriptionPlan.findUnique({
        where: { id: 'plan-trial' },
      });
      const planId = trialPlan?.id || 'plan-basic';

      await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId,
          startAt: now,
          endAt: trialEndAt,
          status: 'trial',
        },
      });

      // 7. 初始化租户
      await this.initializer.initialize(
        tx,
        tenant.id,
        shopName,
        phone,
        passwordHash,
        '管理员',
        address,
      );

      // 8. 默认启用简易模式（面向小店，单店版）
      const simpleModeFlag = await tx.featureFlag.findUnique({
        where: { code: 'simple_mode' },
      });
      if (simpleModeFlag) {
        await tx.tenantFeatureFlag.upsert({
          where: {
            tenantId_featureFlagId: {
              tenantId: tenant.id,
              featureFlagId: simpleModeFlag.id,
            },
          },
          update: { enabled: true },
          create: { tenantId: tenant.id, featureFlagId: simpleModeFlag.id, enabled: true },
        });
      }

      return tenant;
    });

    // 9. 更新用户 openid
    const user = await this.prisma.user.findFirst({
      where: { phone, tenantId: result.id },
    });

    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { wxOpenid: openid },
      });
    }

    // 10. 生成登录 token
    const fullUser = await this.prisma.user.findFirst({
      where: { phone, tenantId: result.id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        employee: true,
      },
    });

    if (!fullUser) {
      throw new BadRequestException('绑定失败，用户创建异常');
    }

    return this.generateLoginResult(fullUser);
  }

  /**
   * 调用微信 code2session 接口换取 openid
   */
  private async code2Session(code: string): Promise<string> {
    const appid = this.config.get<string>('WX_MINI_APPID');
    const secret = this.config.get<string>('WX_MINI_SECRET');

    if (!appid || !secret) {
      // Mock mode for development/testing
      this.logger.warn('WX_MINI_APPID/WX_MINI_SECRET not configured, using mock openid');
      return `mock_openid_${code}`;
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;

    try {
      const res = await fetch(url);
      const data = (await res.json()) as WechatSessionResult;

      if (data.errcode) {
        if (process.env.NODE_ENV !== 'production') {
          this.logger.warn(`微信 jscode2session 失败 (${data.errcode}: ${data.errmsg}), 开发模式下降级使用 Mock OpenID`);
          return `mock_openid_${code}`;
        }
        throw new BadRequestException(`微信登录失败: ${data.errmsg}`);
      }

      return data.openid;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`微信 code2session 请求失败: ${err.message}`);
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn('开发模式下，微信服务请求异常，降级使用 Mock OpenID');
        return `mock_openid_${code}`;
      }
      throw new BadRequestException('微信登录服务异常，请稍后重试');
    }
  }

  /**
   * 生成登录结果（token + 用户信息）
   */
  private async generateLoginResult(user: any) {
    const roles: string[] = user.userRoles.map((ur: any) => ur.role.code);
    const permissions: string[] = user.userRoles.flatMap((ur: any) =>
      ur.role.rolePermissions.map((rp: any) => rp.permission.code),
    );

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      shopId: user.employee?.shopId || null,
      isPlatform: false,
      roles: [...new Set(roles)],
      permissions: [...new Set(permissions)],
      dataScope: 'all',
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get('JWT_ACCESS_TOKEN_TTL', '15m'),
    });

    const refreshToken = randomUUID();
    const refreshTtl = this.config.get('JWT_REFRESH_TOKEN_TTL', '7d');
    const expiresAt = new Date();
    const days = parseInt(refreshTtl) || 7;
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt },
    });

    let subscription = undefined;
    if (user.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { subscriptionStatus: true, subscriptionEndAt: true },
      });
      if (tenant) {
        const endAt = tenant.subscriptionEndAt;
        const daysRemaining = endAt
          ? Math.ceil((endAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
          : 0;
        subscription = {
          status: tenant.subscriptionStatus,
          endAt: endAt ? endAt.toISOString() : null,
          daysRemaining,
        };
      }
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        isPlatform: false,
        tenantId: user.tenantId,
        shopId: user.employee?.shopId || null,
        roles: payload.roles,
        permissions: payload.permissions,
      },
      subscription,
    };
  }
}
