import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';
import { applyDataScope } from '../../common/utils/scope-where';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(user: JwtPayload) {
    // 平台管理员返回平台级统计
    if (user.isPlatform) {
      return this.getPlatformOverview();
    }

    const tenantId = user.tenantId!;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const todayWorkOrderWhere = applyDataScope(
      user,
      { tenantId, createdAt: { gte: startOfDay, lt: endOfDay } },
      'shopId',
      'advisorId',
    );
    const inProgressWorkOrderWhere = applyDataScope(
      user,
      { tenantId, status: 'in_progress' },
      'shopId',
      'advisorId',
    );
    const appointmentWhere = applyDataScope(
      user,
      { tenantId, appointTime: { gte: startOfDay, lt: endOfDay }, status: { notIn: ['cancelled'] } },
      'shopId',
    );
    const settlementWhere = applyDataScope(user, { tenantId, debtAmount: { gt: 0 } }, 'shopId', 'operatorId');
    const reminderWhere = applyDataScope(
      user,
      { tenantId, status: 'pending', dueDate: { gte: startOfDay, lt: endOfDay } },
      'shopId',
      'handledBy',
    );
    const dispatchTaskWhere: Record<string, any> = { tenantId, status: 'pending' };
    if (!user.isPlatform && (user.dataScope || 'shop') === 'shop' && user.shopId) {
      dispatchTaskWhere.workOrder = { shopId: user.shopId };
    } else if (!user.isPlatform && user.dataScope === 'self') {
      dispatchTaskWhere.technicianId = user.sub;
    }
    const stockBalanceWhere: Record<string, any> = {
      tenantId,
      part: { status: 'active', minStock: { gt: 0 } },
    };
    if (!user.isPlatform && (user.dataScope || 'shop') === 'shop' && user.shopId) {
      stockBalanceWhere.warehouse = { shopId: user.shopId };
    }
    const todayPaymentWhere: Record<string, any> = { tenantId, createdAt: { gte: startOfDay, lt: endOfDay } };
    if (!user.isPlatform && (user.dataScope || 'shop') !== 'all') {
      todayPaymentWhere.settlement = { is: applyDataScope(user, { tenantId }, 'shopId', 'operatorId') };
    }

    const [
      todayOrders,
      todayRevenue,
      inProgressOrders,
      todayAppointments,
      pendingDispatch,
      lowStockItems,
      pendingReminders,
      debtAgg,
    ] = await Promise.all([
      this.prisma.workOrder.count({ where: todayWorkOrderWhere }),
      this.prisma.payment.aggregate({
        where: todayPaymentWhere,
        _sum: { amount: true },
      }),
      this.prisma.workOrder.count({ where: inProgressWorkOrderWhere }),
      this.prisma.appointment.count({ where: appointmentWhere }),
      this.prisma.dispatchTask.count({ where: dispatchTaskWhere }),
      this.prisma.stockBalance.findMany({
        where: stockBalanceWhere,
        include: { part: { select: { minStock: true } } },
      }),
      this.prisma.reminder.count({ where: reminderWhere }),
      this.prisma.settlement.aggregate({
        where: settlementWhere,
        _sum: { debtAmount: true },
        _count: { id: true },
      }),
    ]);

    const lowStockAlerts = (lowStockItems as any[]).filter(b => Number(b.quantity) <= (b.part.minStock || 0));

    return {
      todayOrders,
      todayRevenue: Number(todayRevenue._sum.amount || 0),
      inProgressOrders,
      todayAppointments,
      pendingDispatch,
      lowStockCount: lowStockAlerts.length,
      pendingReminders,
      totalDebt: Number(debtAgg._sum.debtAmount || 0),
      debtCount: debtAgg._count.id,
    };
  }

  async getRecentOrders(user: JwtPayload, limit = 10) {
    if (user.isPlatform) {
      return [];
    }
    return this.prisma.workOrder.findMany({
      where: applyDataScope(user, { tenantId: user.tenantId! }, 'shopId', 'advisorId'),
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        customer: { select: { name: true, phone: true } },
        vehicle: { select: { plateNo: true } },
      },
    });
  }

  async getTodayAppointments(user: JwtPayload) {
    if (user.isPlatform) {
      return [];
    }
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return this.prisma.appointment.findMany({
      where: applyDataScope(
        user,
        {
          tenantId: user.tenantId!,
          appointTime: { gte: startOfDay, lt: endOfDay },
          status: { notIn: ['cancelled'] },
        },
        'shopId',
      ),
      orderBy: { appointTime: 'asc' },
      include: {
        customer: { select: { name: true, phone: true } },
        vehicle: { select: { plateNo: true } },
      },
    });
  }

  private async getPlatformOverview() {
    const [totalTenants, activeTenants, totalOrders, totalCustomers] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'active' } }),
      this.prisma.workOrder.count(),
      this.prisma.customer.count(),
    ]);

    return {
      todayOrders: totalOrders,
      todayRevenue: 0,
      inProgressOrders: 0,
      todayAppointments: 0,
      pendingDispatch: 0,
      lowStockCount: 0,
      pendingReminders: 0,
      totalTenants,
      activeTenants,
      totalCustomers,
    };
  }
}
