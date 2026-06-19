import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface TenantOverviewRecord {
  id: string;
  name: string;
  status: string;
  subscriptionStatus: string;
  subscriptionEndAt: Date | null;
  createdAt: Date;
}

interface CountGroupRecord {
  tenantId: string;
  _count: { id: number };
}

interface SumGroupRecord {
  tenantId: string;
  _sum: { paidAmount?: unknown; balance?: unknown };
}

@Injectable()
export class TenantStatsService {
  constructor(private prisma: PrismaService) {}

  async getTenantStats(tenantId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      workOrderCount30d,
      settlementResult,
      activeUserCount7d,
      customerCount,
      storedValueResult,
      lastActiveLog,
    ] = await Promise.all([
      this.prisma.workOrder.count({
        where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.settlement.aggregate({
        where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
        _sum: { paidAmount: true },
      }),
      this.prisma.user.count({
        where: { tenantId, lastLoginAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.customer.count({
        where: { tenantId },
      }),
      this.prisma.storedValueCard.aggregate({
        where: { tenantId, status: 'active' },
        _sum: { balance: true },
      }),
      this.prisma.auditLog.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      workOrderCount30d,
      settlementAmount30d: (settlementResult._sum.paidAmount || 0).toFixed(2),
      activeUserCount7d,
      customerCount,
      storedValueBalance: (storedValueResult._sum.balance || 0).toFixed(2),
      lastActiveAt: lastActiveLog?.createdAt?.toISOString() || null,
    };
  }

  async getAllTenantsOverview() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [tenants, workOrderCounts, settlementAmounts, userCounts, customerCounts, storedValueBalances] = await Promise.all([
      this.prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          subscriptionStatus: true,
          subscriptionEndAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workOrder.groupBy({
        by: ['tenantId'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
      }),
      this.prisma.settlement.groupBy({
        by: ['tenantId'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { paidAmount: true },
      }),
      this.prisma.user.groupBy({
        by: ['tenantId'],
        where: { lastLoginAt: { gte: sevenDaysAgo } },
        _count: { id: true },
      }),
      this.prisma.customer.groupBy({
        by: ['tenantId'],
        _count: { id: true },
      }),
      this.prisma.storedValueCard.groupBy({
        by: ['tenantId'],
        where: { status: 'active' },
        _sum: { balance: true },
      }),
    ]);

    const tenantRows = tenants as TenantOverviewRecord[];
    const workOrderRows = workOrderCounts as CountGroupRecord[];
    const settlementRows = settlementAmounts as SumGroupRecord[];
    const userRows = userCounts as CountGroupRecord[];
    const customerRows = customerCounts as CountGroupRecord[];
    const storedValueRows = storedValueBalances as SumGroupRecord[];

    const woMap = new Map(workOrderRows.map((w) => [w.tenantId, w._count.id]));
    const stMap = new Map(settlementRows.map((s) => [s.tenantId, Number(s._sum.paidAmount || 0).toFixed(2)]));
    const usMap = new Map(userRows.map((u) => [u.tenantId, u._count.id]));
    const cuMap = new Map(customerRows.map((c) => [c.tenantId, c._count.id]));
    const svMap = new Map(storedValueRows.map((s) => [s.tenantId, Number(s._sum.balance || 0).toFixed(2)]));

    return tenantRows.map((t) => ({
      tenantId: t.id,
      name: t.name,
      status: t.status,
      subscriptionStatus: t.subscriptionStatus,
      subscriptionEndAt: t.subscriptionEndAt?.toISOString() || null,
      createdAt: t.createdAt.toISOString(),
      workOrderCount30d: woMap.get(t.id) || 0,
      settlementAmount30d: stMap.get(t.id) || '0.00',
      activeUserCount7d: usMap.get(t.id) || 0,
      customerCount: cuMap.get(t.id) || 0,
      storedValueBalance: svMap.get(t.id) || '0.00',
    }));
  }
}
