import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SmsCodeService } from './sms-code.service';
import { TenantInitializerService } from '../platform/tenant/tenant-initializer.service';
import { NotificationService } from '../notification/notification.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { JwtPayload } from '@car/shared';

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private smsCodeService: SmsCodeService,
    private initializer: TenantInitializerService,
    private notificationService: NotificationService,
  ) {}

  async sendCode(phone: string, ip: string) {
    const code = await this.smsCodeService.generateCode(phone, ip);

    // Send SMS via notification service
    await this.notificationService.send({
      tenantId: 'platform',
      channel: 'sms',
      scene: 'sms_verify_code',
      recipient: phone,
      content: `您的验证码是 ${code}，5分钟内有效。`,
    });

    this.logger.log(`Verification code sent to ${phone.slice(0, 3)}****${phone.slice(-4)}`);
    const isDev = process.env.NODE_ENV !== 'production';
    return { 
      message: '验证码已发送',
      ...(isDev ? { code } : {})
    };
  }

  async register(data: {
    shopName: string;
    phone: string;
    code: string;
    password?: string;
    businessType: string;
    employeeCount?: number;
    ip: string;
  }) {
    const { shopName, phone, code, password, businessType, employeeCount, ip } = data;

    // Check register rate limit
    await this.smsCodeService.checkRegisterLimit(ip);

    // Verify code
    await this.smsCodeService.verifyCode(phone, code);

    // Check if phone already registered
    const existingUser = await this.prisma.user.findFirst({
      where: { phone },
    });
    if (existingUser) {
      throw new BadRequestException('该手机号已注册，请直接登录');
    }

    // Hash password if provided, otherwise use a placeholder
    const passwordHash = password
      ? await bcrypt.hash(password, 10)
      : await bcrypt.hash(randomUUID(), 10); // placeholder, user cannot login without setting password

    const trialDays = parseInt(this.config.get('TRIAL_DAYS', '30'));
    const now = new Date();
    const trialEndAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create tenant
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

      // 2. Create trial subscription
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

      // 3. Initialize tenant (shop, warehouse, roles, service items, dictionaries)
      await this.initializer.initialize(
        tx,
        tenant.id,
        shopName,
        phone,
        passwordHash,
        '管理员',
      );

      // 4. 默认启用简易模式（面向 1-5 人小店；员工数 > 5 不默认开启）
      if (employeeCount == null || employeeCount <= 5) {
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
      }

      return tenant;
    });

    // Generate login tokens
    const user = await this.prisma.user.findFirst({
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

    if (!user) {
      throw new BadRequestException('注册失败，用户创建异常');
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
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

    const tokens = await this.generateTokens(payload);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    const endAt = result.subscriptionEndAt;
    const daysRemaining = endAt
      ? Math.ceil((endAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : 0;

    this.logger.log(`Registration successful: ${shopName} (${phone.slice(0, 3)}****${phone.slice(-4)})`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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
      subscription: {
        status: 'trial',
        endAt: endAt ? endAt.toISOString() : null,
        daysRemaining,
      },
    };
  }

  private async generateTokens(payload: JwtPayload) {
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get('JWT_ACCESS_TOKEN_TTL', '15m'),
    });

    const refreshToken = randomUUID();
    const refreshTtl = this.config.get('JWT_REFRESH_TOKEN_TTL', '7d');
    const expiresAt = new Date();
    const days = parseInt(refreshTtl) || 7;
    expiresAt.setDate(expiresAt.getDate() + days);

    return { accessToken, refreshToken, expiresAt };
  }

  private async saveRefreshToken(userId: string, token: string) {
    const refreshTtl = this.config.get('JWT_REFRESH_TOKEN_TTL', '7d');
    const days = parseInt(refreshTtl) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });
  }
}
