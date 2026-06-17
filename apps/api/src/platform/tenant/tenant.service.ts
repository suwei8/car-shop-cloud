import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { TenantInitializerService } from './tenant-initializer.service';
import { AuditService } from '../../audit/audit.service';
import { JwtService } from '@nestjs/jwt';
import { ModuleRef } from '@nestjs/core';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { JwtPayload } from '@car/shared';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PlatformTenantService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private initializer: TenantInitializerService,
    private audit: AuditService,
    private jwtService: JwtService,
    private moduleRef: ModuleRef,
  ) {}

  async findAll(query: { page?: number; pageSize?: number; status?: string }) {
    const { page = 1, pageSize = 20, status } = query;
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { subscriptions: { include: { plan: true }, take: 1 } },
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        subscriptions: { include: { plan: true } },
        featureFlags: { include: { featureFlag: true } },
      },
    });
    if (!tenant) throw new NotFoundException('商户不存在');
    return tenant;
  }

  async create(data: { name: string; contactName?: string; contactPhone?: string; password: string }) {
    const { password, ...tenantData } = data;

    if (data.contactPhone) {
      const existingUser = await this.prisma.user.findFirst({
        where: { phone: data.contactPhone },
      });
      if (existingUser) {
        throw new ConflictException('该手机号已被其他账号使用');
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const trialDays = parseInt(this.config.get('TRIAL_DAYS', '14'));

    const now = new Date();
    const trialEndAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          ...tenantData,
          subscriptionStatus: 'trial',
          subscriptionEndAt: trialEndAt,
        },
      });

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

      // 调用初始化器创建基础数据（门店、仓库、角色、服务项目、字典）
      await this.initializer.initialize(
        tx,
        tenant.id,
        tenant.name,
        data.contactPhone || '',
        passwordHash,
        data.contactName || '管理员',
      );

      return tenant;
    });

    return {
      ...result,
      adminPassword: password,
    };
  }

  async update(id: string, data: { name?: string; contactName?: string; contactPhone?: string; password?: string; status?: string }) {
    const { password, ...tenantData } = data;
    const tenant = await this.findOne(id);

    if (data.contactPhone && data.contactPhone !== tenant.contactPhone) {
      const existingUser = await this.prisma.user.findFirst({
        where: { phone: data.contactPhone },
      });
      if (existingUser) {
        throw new ConflictException('该手机号已被其他账号使用');
      }
    }

    const updated = await this.prisma.tenant.update({ where: { id }, data: tenantData });

    if (password) {
      const phone = data.contactPhone || tenant.contactPhone || '';
      const user = await this.prisma.user.findFirst({
        where: { tenantId: id, phone },
      });
      if (user) {
        const passwordHash = await bcrypt.hash(password, 10);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
        });
      }
    }

    return updated;
  }

  async remove(id: string) {
    const tenant = await this.findOne(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        status: 'suspended',
        subscriptionStatus: 'suspended',
      },
    });

    await this.audit.log({
      action: 'remove',
      targetType: 'tenant',
      targetId: id,
      changes: {
        previousStatus: tenant.status,
        previousSubscriptionStatus: tenant.subscriptionStatus,
      },
    });

    this.invalidateGuardCache(id);

    return updated;
  }

  private invalidateGuardCache(tenantId: string) {
    try {
      const guard = this.moduleRef.get(SubscriptionGuard, { strict: false });
      guard.invalidateCache(tenantId);
    } catch {
      // guard may not be available in test context
    }
  }

  async renew(tenantId: string, planId: string, months: number, operatorUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('商户不存在');

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('套餐不存在');

    const now = new Date();
    const baseDate = tenant.subscriptionEndAt && tenant.subscriptionEndAt > now
      ? tenant.subscriptionEndAt
      : now;
    const oldEndAt = tenant.subscriptionEndAt;

    const startAt = new Date(baseDate);
    const endAt = new Date(baseDate);
    endAt.setMonth(endAt.getMonth() + months);

    const result = await this.prisma.$transaction(async (tx) => {
      const sub = await tx.tenantSubscription.create({
        data: { tenantId, planId, startAt, endAt, status: 'active' },
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: { subscriptionStatus: 'active', subscriptionEndAt: endAt },
      });

      return sub;
    });

    await this.audit.log({
      userId: operatorUserId,
      action: 'renew',
      targetType: 'tenant',
      targetId: tenantId,
      changes: { planId, months, oldEndAt: oldEndAt?.toISOString() || null, newEndAt: endAt.toISOString() },
    });

    this.invalidateGuardCache(tenantId);
    return result;
  }

  async extend(tenantId: string, days: number, reason: string, operatorUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('商户不存在');

    const baseDate = tenant.subscriptionEndAt && tenant.subscriptionEndAt > new Date()
      ? tenant.subscriptionEndAt
      : new Date();
    const newEndAt = new Date(baseDate);
    newEndAt.setDate(newEndAt.getDate() + days);

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { subscriptionEndAt: newEndAt },
      });

      const activeSub = await tx.tenantSubscription.findFirst({
        where: {
          tenantId,
          status: { in: ['active', 'trial'] },
        },
        orderBy: { endAt: 'desc' },
      });

      if (activeSub) {
        await tx.tenantSubscription.update({
          where: { id: activeSub.id },
          data: { endAt: newEndAt },
        });
      }
    });

    await this.audit.log({
      userId: operatorUserId,
      action: 'extend',
      targetType: 'tenant',
      targetId: tenantId,
      changes: { days, reason, newEndAt: newEndAt.toISOString() },
    });

    this.invalidateGuardCache(tenantId);
    return { newEndAt };
  }

  async suspend(tenantId: string, reason: string | undefined, operatorUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('商户不存在');

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: 'suspended' },
    });

    await this.audit.log({
      userId: operatorUserId,
      action: 'suspend',
      targetType: 'tenant',
      targetId: tenantId,
      changes: { reason: reason || null },
    });

    this.invalidateGuardCache(tenantId);
    return { message: '已停用' };
  }

  async resume(tenantId: string, operatorUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('商户不存在');

    const now = new Date();
    const subscriptionStatus = tenant.subscriptionEndAt && tenant.subscriptionEndAt > now
      ? 'active'
      : 'suspended';

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'active', subscriptionStatus },
    });

    await this.audit.log({
      userId: operatorUserId,
      action: 'resume',
      targetType: 'tenant',
      targetId: tenantId,
      changes: { subscriptionStatus },
    });

    this.invalidateGuardCache(tenantId);
    return { status: 'active', subscriptionStatus };
  }

  async impersonate(tenantId: string, operatorUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('商户不存在');

    const adminUser = await this.prisma.user.findFirst({
      where: {
        tenantId,
        status: 'active',
        userRoles: { some: { role: { code: 'tenant_admin' } } },
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
        employee: true,
      },
    });

    if (!adminUser) throw new BadRequestException('该商户没有可用的管理员账号');

    const roles = adminUser.userRoles.map((ur) => ur.role.code);
    const permissions = adminUser.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    );

    const payload: JwtPayload = {
      sub: adminUser.id,
      tenantId: adminUser.tenantId,
      shopId: adminUser.employee?.shopId || null,
      isPlatform: false,
      roles: [...new Set(roles)],
      permissions: [...new Set(permissions)],
      dataScope: 'all',
      audience: 'employee',
      impersonatedBy: operatorUserId,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '30m' });

    await this.audit.log({
      userId: operatorUserId,
      action: 'impersonate',
      targetType: 'tenant',
      targetId: tenantId,
      changes: { impersonatedUserId: adminUser.id },
    });

    return { accessToken, expiresIn: 1800 };
  }
}
