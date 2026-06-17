import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

const ALL_SCOPE_ROLES = ['tenant_admin', 'shop_manager'];

function inferDataScope(roles: string[]): 'self' | 'shop' | 'all' {
  if (roles.some(r => ALL_SCOPE_ROLES.includes(r))) {
    return 'all';
  }
  return 'shop';
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(phone: string, password: string) {
    const users = await this.prisma.user.findMany({
      where: { phone, status: 'active' },
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

    if (users.length === 0) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    if (users.length > 1) {
      throw new ConflictException('该手机号关联多个账号，请联系管理员处理');
    }

    const user = users[0];

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    if (user.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
      });
      if (!tenant || tenant.status !== 'active') {
        throw new ForbiddenException('租户账号状态异常(已停用或过期)，请联系客服');
      }
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    );

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      shopId: user.employee?.shopId || null,
      isPlatform: user.isPlatform,
      roles: [...new Set(roles)],
      permissions: [...new Set(permissions)],
      dataScope: user.isPlatform ? undefined : inferDataScope([...new Set(roles)]),
      audience: 'employee',
    };

    const tokens = await this.generateTokens(payload);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const result: any = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        isPlatform: user.isPlatform,
        tenantId: user.tenantId,
        shopId: user.employee?.shopId || null,
        roles: payload.roles,
        permissions: payload.permissions,
      },
    };

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
        result.subscription = {
          status: tenant.subscriptionStatus,
          endAt: endAt ? endAt.toISOString() : null,
          daysRemaining,
        };
      }
    }

    return result;
  }

  async refresh(refreshToken: string) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
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
        },
      },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('refresh token 无效或已过期');
    }

    if (tokenRecord.user.status !== 'active') {
      throw new ForbiddenException('账号已被禁用');
    }

    if (tokenRecord.user.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tokenRecord.user.tenantId },
      });
      if (!tenant || tenant.status !== 'active') {
        throw new ForbiddenException('租户账号状态异常(已停用或过期)，无法获取新访问令牌');
      }
    }

    const user = tokenRecord.user;
    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    );

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      shopId: user.employee?.shopId || null,
      isPlatform: user.isPlatform,
      roles: [...new Set(roles)],
      permissions: [...new Set(permissions)],
      dataScope: user.isPlatform ? undefined : inferDataScope([...new Set(roles)]),
      audience: 'employee',
    };

    const tokens = await this.generateTokens(payload);

    // 删除旧 refresh token，保存新的
    await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: '已退出登录' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    );

    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      isPlatform: user.isPlatform,
      tenantId: user.tenantId,
      shopId: user.employee?.shopId || null,
      roles: [...new Set(roles)],
      permissions: [...new Set(permissions)],
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
