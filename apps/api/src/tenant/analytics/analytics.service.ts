import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { empty, sqltag as sql } from '@prisma/client/runtime/library';

interface WorkOrderStatusGroup {
  status: string;
  _count: { id: number };
}

interface WorkOrderTypeGroup {
  orderType: string;
  _count: { id: number };
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private getDateRange(startDate?: string, endDate?: string, defaultDays = 30): { start: Date; end: Date } {
    const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();
    const start = startDate
      ? new Date(startDate + 'T00:00:00.000Z')
      : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  async getRevenueTrend(user: JwtPayload, query: AnalyticsQueryDto) {
    if (user.isPlatform) {
      return { dimension: query.dimension || 'day', startDate: '', endDate: '', data: [] };
    }

    const tenantId = user.tenantId!;
    const { startDate, endDate, dimension = 'day', shopId } = query;
    const { start, end } = this.getDateRange(startDate, endDate, 30);

    const result = await this.prisma.$queryRaw`
      SELECT
        ${dimension === 'day'
          ? sql`DATE(p.created_at)`
          : sql`DATE_TRUNC(${dimension}, p.created_at)`
        } AS period,
        COALESCE(SUM(p.amount), 0) AS total_revenue,
        COUNT(DISTINCT s.id) AS order_count
      FROM payments p
      JOIN settlements s ON p.settlement_id = s.id
      WHERE p.tenant_id = ${tenantId}
        AND p.created_at >= ${start}
        AND p.created_at < ${end}
        ${shopId ? sql`AND s.shop_id = ${shopId}` : empty}
      GROUP BY period
      ORDER BY period ASC
    `;

    return {
      dimension,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      data: (result as any[]).map(row => ({
        period: String(row.period),
        totalRevenue: String(row.total_revenue),
        orderCount: Number(row.order_count),
      })),
    };
  }

  async getWorkOrderStats(user: JwtPayload, query: AnalyticsQueryDto) {
    if (user.isPlatform) {
      return { statusDistribution: [], typeDistribution: [], completionRateTrend: [] };
    }

    const tenantId = user.tenantId!;
    const { start, end } = this.getDateRange(query.startDate, query.endDate, 30);

    const where: any = {
      tenantId,
      createdAt: { gte: start, lt: end },
    };
    if (query.shopId) where.shopId = query.shopId;

    const [statusDistribution, typeDistribution] = await Promise.all([
      this.prisma.workOrder.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.workOrder.groupBy({
        by: ['orderType'],
        where,
        _count: { id: true },
      }),
    ]);

    const totalByDay = await this.prisma.$queryRaw`
      SELECT
        DATE(created_at) AS period,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status IN ('completed', 'settled')) AS completed
      FROM work_orders
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${start}
        AND created_at < ${end}
        ${query.shopId ? sql`AND shop_id = ${query.shopId}` : empty}
      GROUP BY period
      ORDER BY period ASC
    `;

    return {
      statusDistribution: (statusDistribution as WorkOrderStatusGroup[]).map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      typeDistribution: (typeDistribution as WorkOrderTypeGroup[]).map((t) => ({
        type: t.orderType,
        count: t._count.id,
      })),
      completionRateTrend: (totalByDay as any[]).map(row => ({
        period: String(row.period),
        total: Number(row.total),
        completed: Number(row.completed),
        rate: row.total > 0 ? Number(row.completed) / Number(row.total) : 0,
      })),
    };
  }

  async getTechnicianRanking(user: JwtPayload, query: AnalyticsQueryDto) {
    if (user.isPlatform) {
      return { data: [] };
    }

    const tenantId = user.tenantId!;
    const { start, end } = this.getDateRange(query.startDate, query.endDate, 30);

    const result = await this.prisma.$queryRaw`
      SELECT
        dt.technician_id,
        u.name AS technician_name,
        COUNT(DISTINCT dt.work_order_id) AS order_count,
        COUNT(DISTINCT dt.work_order_id) FILTER (WHERE dt.status = 'completed') AS completed_count,
        COALESCE(SUM(woi.amount), 0) AS total_revenue
      FROM dispatch_tasks dt
      JOIN users u ON dt.technician_id = u.id
      LEFT JOIN work_order_items woi ON woi.technician_id = dt.technician_id
        AND woi.work_order_id = dt.work_order_id
        AND woi.tenant_id = ${tenantId}
      WHERE dt.tenant_id = ${tenantId}
        AND dt.created_at >= ${start}
        AND dt.created_at < ${end}
      GROUP BY dt.technician_id, u.name
      ORDER BY total_revenue DESC
      LIMIT 20
    `;

    return {
      data: (result as any[]).map(row => ({
        technicianId: row.technician_id,
        technicianName: row.technician_name,
        orderCount: Number(row.order_count),
        completedCount: Number(row.completed_count),
        totalRevenue: String(row.total_revenue),
      })),
    };
  }

  async getCustomerAnalysis(user: JwtPayload, query: AnalyticsQueryDto) {
    if (user.isPlatform) {
      return { newCustomers: 0, returningCustomers: 0, growthTrend: [], sourceDistribution: [] };
    }

    const tenantId = user.tenantId!;
    const { start, end } = this.getDateRange(query.startDate, query.endDate, 30);

    const customerStats = await this.prisma.$queryRaw`
      WITH period_customers AS (
        SELECT DISTINCT customer_id
        FROM work_orders
        WHERE tenant_id = ${tenantId}
          AND created_at >= ${start}
          AND created_at < ${end}
      ),
      first_orders AS (
        SELECT customer_id, MIN(created_at) AS first_order_at
        FROM work_orders
        WHERE tenant_id = ${tenantId}
        GROUP BY customer_id
      )
      SELECT
        COUNT(*) FILTER (WHERE fo.first_order_at >= ${start}) AS new_customers,
        COUNT(*) FILTER (WHERE fo.first_order_at < ${start}) AS returning_customers
      FROM period_customers pc
      JOIN first_orders fo ON pc.customer_id = fo.customer_id
    `;

    const growthTrend = await this.prisma.$queryRaw`
      SELECT
        DATE(MIN(created_at)) AS period,
        COUNT(*) AS new_count
      FROM (
        SELECT customer_id, MIN(created_at) AS created_at
        FROM work_orders
        WHERE tenant_id = ${tenantId}
          AND created_at >= ${start}
          AND created_at < ${end}
        GROUP BY customer_id
        HAVING MIN(created_at) >= ${start}
      ) first_visits
      GROUP BY DATE(created_at)
      ORDER BY period ASC
    `;

    const stats = (customerStats as any[])[0] || { new_customers: 0, returning_customers: 0 };

    return {
      newCustomers: Number(stats.new_customers),
      returningCustomers: Number(stats.returning_customers),
      growthTrend: (growthTrend as any[]).map(row => ({
        period: String(row.period),
        newCount: Number(row.new_count),
      })),
      sourceDistribution: [],
    };
  }

  async getPartsConsumption(user: JwtPayload, query: AnalyticsQueryDto) {
    if (user.isPlatform) {
      return { data: [] };
    }

    const tenantId = user.tenantId!;
    const { start, end } = this.getDateRange(query.startDate, query.endDate, 30);

    const result = await this.prisma.$queryRaw`
      SELECT
        woi.part_id,
        p.name AS part_name,
        p.code AS part_code,
        SUM(woi.quantity) AS total_quantity,
        SUM(woi.amount) AS total_amount
      FROM work_order_items woi
      JOIN parts p ON woi.part_id = p.id
      JOIN work_orders wo ON woi.work_order_id = wo.id
      WHERE woi.tenant_id = ${tenantId}
        AND woi.item_type = 'part'
        AND woi.part_id IS NOT NULL
        AND wo.created_at >= ${start}
        AND wo.created_at < ${end}
        ${query.shopId ? sql`AND wo.shop_id = ${query.shopId}` : empty}
      GROUP BY woi.part_id, p.name, p.code
      ORDER BY total_amount DESC
      LIMIT 10
    `;

    return {
      data: (result as any[]).map(row => ({
        partId: row.part_id,
        partName: row.part_name,
        partCode: row.part_code,
        totalQuantity: String(row.total_quantity),
        totalAmount: String(row.total_amount),
      })),
    };
  }
}
