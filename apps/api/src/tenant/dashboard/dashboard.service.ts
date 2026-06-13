import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

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

    const [
      todayOrders,
      todayRevenue,
      inProgressOrders,
      todayAppointments,
      pendingDispatch,
      lowStockItems,
      pendingReminders,
    ] = await Promise.all([
      this.prisma.workOrder.count({
        where: { tenantId, createdAt: { gte: startOfDay, lt: endOfDay } },
      }),
      this.prisma.payment.aggregate({
        where: { tenantId, createdAt: { gte: startOfDay, lt: endOfDay } },
        _sum: { amount: true },
      }),
      this.prisma.workOrder.count({
        where: { tenantId, status: 'in_progress' },
      }),
      this.prisma.appointment.count({
        where: { tenantId, appointTime: { gte: startOfDay, lt: endOfDay }, status: { notIn: ['cancelled'] } },
      }),
      this.prisma.dispatchTask.count({
        where: { tenantId, status: 'pending' },
      }),
      this.prisma.stockBalance.findMany({
        where: { tenantId, part: { status: 'active', minStock: { gt: 0 } } },
        include: { part: { select: { minStock: true } } },
      }),
      this.prisma.reminder.count({
        where: { tenantId, status: 'pending', dueDate: { gte: startOfDay, lt: endOfDay } },
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
    };
  }

  async getRecentOrders(user: JwtPayload, limit = 10) {
    if (user.isPlatform) {
      return [];
    }
    return this.prisma.workOrder.findMany({
      where: { tenantId: user.tenantId! },
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
      where: {
        tenantId: user.tenantId!,
        appointTime: { gte: startOfDay, lt: endOfDay },
        status: { notIn: ['cancelled'] },
      },
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
