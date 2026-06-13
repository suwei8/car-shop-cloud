import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  // 营业日报
  async getDailyReport(user: JwtPayload, query: { startDate: string; endDate: string; shopId?: string }) {
    const { startDate, endDate, shopId } = query;
    const tenantId = user.tenantId!;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);

    const where: any = {
      tenantId,
      createdAt: { gte: start, lt: end },
    };
    if (shopId) where.shopId = shopId;

    const [orders, payments, settlements] = await Promise.all([
      // 工单统计
      this.prisma.workOrder.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      // 收款统计
      this.prisma.payment.groupBy({
        by: ['payMethod'],
        where: { tenantId, createdAt: { gte: start, lt: end } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // 结算统计
      this.prisma.settlement.aggregate({
        where,
        _sum: { totalAmount: true, discountAmount: true, paidAmount: true, debtAmount: true },
        _count: { id: true },
      }),
    ]);

    return {
      period: { startDate, endDate },
      orders: orders.map(o => ({
        status: o.status,
        count: o._count.id,
        amount: Number(o._sum.totalAmount || 0),
      })),
      payments: payments.map(p => ({
        method: p.payMethod,
        count: p._count.id,
        amount: Number(p._sum.amount || 0),
      })),
      summary: {
        totalOrders: orders.reduce((sum, o) => sum + o._count.id, 0),
        totalRevenue: Number(settlements._sum.totalAmount || 0),
        totalDiscount: Number(settlements._sum.discountAmount || 0),
        totalPaid: Number(settlements._sum.paidAmount || 0),
        totalDebt: Number(settlements._sum.debtAmount || 0),
        settlementCount: settlements._count.id,
      },
    };
  }

  // 技师产值
  async getTechnicianReport(user: JwtPayload, query: { startDate: string; endDate: string }) {
    const { startDate, endDate } = query;
    const tenantId = user.tenantId!;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);

    const technicians = await this.prisma.user.findMany({
      where: {
        tenantId,
        status: 'active',
        userRoles: { some: { role: { code: 'technician' } } },
      },
      select: { id: true, name: true },
    });

    const results = [];
    for (const tech of technicians) {
      const [tasks, orderItems] = await Promise.all([
        this.prisma.dispatchTask.findMany({
          where: {
            tenantId,
            technicianId: tech.id,
            createdAt: { gte: start, lt: end },
          },
        }),
        this.prisma.workOrderItem.findMany({
          where: {
            tenantId,
            technicianId: tech.id,
            createdAt: { gte: start, lt: end },
          },
        }),
      ]);

      const completedTasks = tasks.filter(t => t.status === 'completed');
      const totalAmount = orderItems.reduce((sum, item) => sum + Number(item.amount), 0);

      results.push({
        technicianId: tech.id,
        technicianName: tech.name,
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        totalAmount,
      });
    }

    return results.sort((a, b) => b.totalAmount - a.totalAmount);
  }

  // 库存预警
  async getLowStockAlert(user: JwtPayload) {
    const tenantId = user.tenantId!;

    const parts = await this.prisma.part.findMany({
      where: {
        tenantId,
        status: 'active',
        minStock: { gt: 0 },
      },
      include: {
        stockBalances: {
          where: { tenantId },
          select: { quantity: true },
        },
      },
    });

    const lowStockItems = parts
      .map(p => {
        const currentStock = p.stockBalances.reduce((sum, b) => sum + Number(b.quantity), 0);
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          category: p.category,
          unit: p.unit,
          minStock: p.minStock,
          currentStock,
        };
      })
      .filter(p => p.currentStock <= p.minStock)
      .sort((a, b) => (a.minStock > 0 ? a.currentStock / a.minStock : 0) - (b.minStock > 0 ? b.currentStock / b.minStock : 0));

    return lowStockItems;
  }

  // 客户统计
  async getCustomerStats(user: JwtPayload) {
    const tenantId = user.tenantId!;

    const [totalCustomers, newCustomersThisMonth, topCustomers] = await Promise.all([
      this.prisma.customer.count({ where: { tenantId, status: 'active' } }),
      this.prisma.customer.count({
        where: {
          tenantId,
          status: 'active',
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      this.prisma.workOrder.groupBy({
        by: ['customerId'],
        where: { tenantId },
        _count: { id: true },
        _sum: { totalAmount: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      }),
    ]);

    const topCustomerIds = topCustomers.map(c => c.customerId);
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: topCustomerIds } },
      select: { id: true, name: true, phone: true },
    });

    const topCustomerList = topCustomers.map(tc => {
      const customer = customers.find(c => c.id === tc.customerId);
      return {
        ...customer,
        orderCount: tc._count.id,
        totalAmount: Number(tc._sum.totalAmount || 0),
      };
    });

    return {
      totalCustomers,
      newCustomersThisMonth,
      topCustomers: topCustomerList,
    };
  }

  // 储值余额报表
  async getStoredValueReport(user: JwtPayload) {
    const tenantId = user.tenantId!;

    const cards = await this.prisma.storedValueCard.findMany({
      where: { tenantId, status: 'active' },
      orderBy: { balance: 'desc' },
    });

    const totalBalance = cards.reduce((sum, c) => sum + Number(c.balance), 0);
    const totalPrincipal = cards.reduce((sum, c) => sum + Number(c.principalBalance), 0);
    const totalGift = cards.reduce((sum, c) => sum + Number(c.giftBalance), 0);

    return {
      summary: {
        totalCards: cards.length,
        totalBalance,
        totalPrincipal,
        totalGift,
      },
      cards: cards.map(c => ({
        cardNo: c.cardNo,
        customerId: c.customerId,
        balance: Number(c.balance),
        principalBalance: Number(c.principalBalance),
        giftBalance: Number(c.giftBalance),
      })),
    };
  }

  // 套餐核销流水报表
  async getPackageCardReport(user: JwtPayload, query: { startDate: string; endDate: string }) {
    const { startDate, endDate } = query;
    const tenantId = user.tenantId!;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);

    const transactions = await this.prisma.packageCardTransaction.findMany({
      where: {
        tenantId,
        type: 'consume',
        createdAt: { gte: start, lt: end },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalConsumed = transactions.reduce((sum, t) => sum + Number(t.quantity), 0);

    return {
      period: { startDate, endDate },
      summary: {
        totalTransactions: transactions.length,
        totalConsumed,
      },
      transactions: transactions.map(t => ({
        cardId: t.cardId,
        itemId: t.itemId,
        quantity: Number(t.quantity),
        relatedType: t.relatedType,
        relatedId: t.relatedId,
        createdAt: t.createdAt,
      })),
    };
  }

  async exportDailyReport(user: JwtPayload, query: { startDate: string; endDate: string; shopId?: string }): Promise<Buffer> {
    const data = await this.getDailyReport(user, query);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('营业日报');

    sheet.columns = [
      { header: '指标', key: 'label', width: 20 },
      { header: '数值', key: 'value', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };

    const s = data.summary;
    sheet.addRows([
      { label: '工单总数', value: s.totalOrders },
      { label: '营收总额', value: s.totalRevenue.toFixed(2) },
      { label: '优惠金额', value: s.totalDiscount.toFixed(2) },
      { label: '实收金额', value: s.totalPaid.toFixed(2) },
      { label: '欠款金额', value: s.totalDebt.toFixed(2) },
      { label: '结算单数', value: s.settlementCount },
    ]);

    sheet.addRow([]);
    sheet.addRow({ label: '按状态统计', value: '' });
    const statusSheet = workbook.addWorksheet('按状态');
    statusSheet.columns = [
      { header: '状态', key: 'status', width: 15 },
      { header: '数量', key: 'count', width: 10 },
      { header: '金额', key: 'amount', width: 15 },
    ];
    statusSheet.getRow(1).font = { bold: true };
    const statusMap: Record<string, string> = {
      draft: '草稿', confirmed: '已确认', in_progress: '施工中', completed: '已完成', settled: '已结算', cancelled: '已取消',
    };
    for (const o of data.orders) {
      statusSheet.addRow({ status: statusMap[o.status] || o.status, count: o.count, amount: o.amount.toFixed(2) });
    }

    const paySheet = workbook.addWorksheet('按支付方式');
    paySheet.columns = [
      { header: '支付方式', key: 'method', width: 15 },
      { header: '笔数', key: 'count', width: 10 },
      { header: '金额', key: 'amount', width: 15 },
    ];
    paySheet.getRow(1).font = { bold: true };
    const payMap: Record<string, string> = {
      cash: '现金', wechat: '微信', alipay: '支付宝', card: '银行卡', stored_value: '储值卡', package_card: '套餐卡',
    };
    for (const p of data.payments) {
      paySheet.addRow({ method: payMap[p.method] || p.method, count: p.count, amount: p.amount.toFixed(2) });
    }

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  async exportTechnicianReport(user: JwtPayload, query: { startDate: string; endDate: string }): Promise<Buffer> {
    const data = await this.getTechnicianReport(user, query);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('技师产值');

    sheet.columns = [
      { header: '排名', key: 'rank', width: 8 },
      { header: '技师', key: 'name', width: 15 },
      { header: '总任务数', key: 'totalTasks', width: 12 },
      { header: '已完成', key: 'completedTasks', width: 12 },
      { header: '完成率', key: 'rate', width: 12 },
      { header: '产值金额', key: 'amount', width: 15 },
    ];
    sheet.getRow(1).font = { bold: true };

    data.forEach((t, i) => {
      sheet.addRow({
        rank: i + 1,
        name: t.technicianName,
        totalTasks: t.totalTasks,
        completedTasks: t.completedTasks,
        rate: t.totalTasks > 0 ? `${((t.completedTasks / t.totalTasks) * 100).toFixed(0)}%` : '0%',
        amount: t.totalAmount.toFixed(2),
      });
    });

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }
}
