import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SubscriptionPlanService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { priceYearly: 'asc' },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('套餐不存在');
    return plan;
  }

  async create(data: {
    name: string; description?: string; priceYearly: number;
    maxShops: number; maxEmployees: number; features?: any;
  }) {
    return this.prisma.subscriptionPlan.create({ data });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.subscriptionPlan.update({ where: { id }, data });
  }

  async subscribe(tenantId: string, planId: string, months = 12) {
    const plan = await this.findOne(planId);
    const startAt = new Date();
    const endAt = new Date();
    endAt.setMonth(endAt.getMonth() + months);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const sub = await tx.tenantSubscription.create({
        data: { tenantId, planId, startAt, endAt, status: 'active' },
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionStatus: 'active',
          subscriptionEndAt: endAt,
        },
      });

      return sub;
    });
  }
}
