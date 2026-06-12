import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PlatformTenantService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
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
    const passwordHash = await bcrypt.hash(password, 10);
    const trialDays = parseInt(this.config.get('TRIAL_DAYS', '14'));

    const now = new Date();
    const trialEndAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
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

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          phone: data.contactPhone || '',
          name: data.contactName || '管理员',
          passwordHash,
          isPlatform: false,
          status: 'active',
        },
      });

      const adminRole = await tx.role.findFirst({
        where: { code: 'tenant_admin', tenantId: null },
      });
      if (adminRole) {
        await tx.userRole.create({
          data: { userId: user.id, roleId: adminRole.id },
        });
      }

      return tenant;
    });
  }

  async update(id: string, data: { name?: string; contactName?: string; contactPhone?: string; password?: string; status?: string }) {
    const { password, ...tenantData } = data;
    await this.findOne(id);

    const tenant = await this.prisma.tenant.update({ where: { id }, data: tenantData });

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

    return tenant;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'suspended' },
    });
  }
}
