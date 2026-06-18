import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

interface CustomerNameRecord {
  id: string;
  name: string;
}

interface PackageCardReminderRecord {
  id: string;
  name: string;
  customerId: string;
  endAt: Date;
  items: Array<{ remainQty: unknown }>;
}

interface StoredValueCardReminderRecord {
  id: string;
  cardNo: string;
  customerId: string;
  balance: unknown;
}

const DEFAULT_THRESHOLDS = {
  maintenance_days: 150,
  card_expiring_days: 14,
  card_low_balance: 100,
  customer_churn_days: 90,
};

@Injectable()
export class ReminderTaskService {
  private readonly logger = new Logger(ReminderTaskService.name);

  constructor(private prisma: PrismaService) {}

  @Cron('0 6 * * *')
  async handleCron() {
    this.logger.log('开始生成每日经营提醒...');
    await this.generateAll();
    this.logger.log('每日经营提醒生成完毕');
  }

  async generateAll() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        await this.generateForTenant(tenant.id);
      } catch (err) {
        this.logger.error(`租户 ${tenant.id} 生成提醒失败: ${err}`);
      }
    }
  }

  async generateForTenant(tenantId: string) {
    const thresholds = await this.loadThresholds(tenantId);
    const today = new Date();
    const dueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    await Promise.all([
      this.generateMaintenanceDue(tenantId, dueDate, thresholds),
      this.generateCardExpiring(tenantId, dueDate, thresholds),
      this.generateCardLowBalance(tenantId, dueDate, thresholds),
      this.generateCustomerChurn(tenantId, dueDate, thresholds),
    ]);
  }

  private async loadThresholds(tenantId: string) {
    const params = await this.prisma.systemParameter.findMany({
      where: { tenantId, group: 'reminder' },
    });
    const map: Record<string, number> = { ...DEFAULT_THRESHOLDS };
    for (const p of params) {
      const v = Number(p.value);
      if (!isNaN(v) && p.key in DEFAULT_THRESHOLDS) {
        map[p.key] = v;
      }
    }
    return map;
  }

  private async generateMaintenanceDue(tenantId: string, dueDate: Date, thresholds: Record<string, number>) {
    const daysBack = thresholds.maintenance_days;
    const cutoff = new Date(dueDate);
    cutoff.setDate(cutoff.getDate() - daysBack);

    const vehicles = await this.prisma.vehicle.findMany({
      where: { tenantId, status: 'active' },
      select: {
        id: true,
        customerId: true,
        plateNo: true,
        workOrders: {
          where: {
            status: 'settled',
            items: { some: { serviceItem: { category: 'maintenance' } } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { updatedAt: true, vehicleMileage: true },
        },
        customer: { select: { name: true } },
      },
    });

    for (const vehicle of vehicles) {
      const lastMaintenance = vehicle.workOrders[0];
      if (!lastMaintenance) continue;

      const lastDate = lastMaintenance.updatedAt;
      if (lastDate > cutoff) continue;

      const daysSince = Math.floor((dueDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      const content = `${vehicle.customer.name} 的 ${vehicle.plateNo} 已 ${daysSince} 天未保养，建议回访`;

      await this.upsertReminder({
        tenantId,
        type: 'maintenance_due',
        customerId: vehicle.customerId,
        vehicleId: vehicle.id,
        relatedId: null,
        content,
        dueDate,
      });
    }
  }

  private async generateCardExpiring(tenantId: string, dueDate: Date, thresholds: Record<string, number>) {
    const daysAhead = thresholds.card_expiring_days;
    const expiringBefore = new Date(dueDate);
    expiringBefore.setDate(expiringBefore.getDate() + daysAhead);

    const cards = (await this.prisma.packageCard.findMany({
      where: {
        tenantId,
        status: 'active',
        endAt: { gte: dueDate, lte: expiringBefore },
        items: { some: { remainQty: { gt: 0 } } },
      },
      include: {
        items: { select: { remainQty: true } },
      },
    })) as PackageCardReminderRecord[];

    const customerIds = [...new Set(cards.map((c: PackageCardReminderRecord) => c.customerId))];
    const customers = customerIds.length
      ? ((await this.prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })) as CustomerNameRecord[])
      : [];
    const customerMap = new Map(customers.map((c: CustomerNameRecord) => [c.id, c.name]));

    for (const card of cards) {
      const totalRemain = card.items.reduce((sum: number, item: { remainQty: unknown }) => sum + Number(item.remainQty), 0);
      if (totalRemain <= 0) continue;

      const customerName = customerMap.get(card.customerId) || '客户';
      const daysLeft = Math.floor((card.endAt.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const content = `${customerName} 的「${card.name}」还剩 ${totalRemain} 次，${daysLeft} 天后到期`;

      await this.upsertReminder({
        tenantId,
        type: 'card_expiring',
        customerId: card.customerId,
        vehicleId: null,
        relatedId: card.id,
        content,
        dueDate,
      });
    }
  }

  private async generateCardLowBalance(tenantId: string, dueDate: Date, thresholds: Record<string, number>) {
    const minBalance = thresholds.card_low_balance;

    const cards = (await this.prisma.storedValueCard.findMany({
      where: {
        tenantId,
        status: 'active',
        balance: { lt: minBalance },
      },
      select: {
        id: true,
        cardNo: true,
        customerId: true,
        balance: true,
      },
    })) as StoredValueCardReminderRecord[];

    const customerIds = [...new Set(cards.map((c: StoredValueCardReminderRecord) => c.customerId))];
    const customers = customerIds.length
      ? ((await this.prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })) as CustomerNameRecord[])
      : [];
    const customerMap = new Map(customers.map((c: CustomerNameRecord) => [c.id, c.name]));

    for (const card of cards) {
      const customerName = customerMap.get(card.customerId) || '客户';
      const content = `${customerName} 的储值卡(${card.cardNo})余额仅 ¥${Number(card.balance).toFixed(2)}，建议提醒充值`;

      await this.upsertReminder({
        tenantId,
        type: 'card_low_balance',
        customerId: card.customerId,
        vehicleId: null,
        relatedId: card.id,
        content,
        dueDate,
      });
    }
  }

  private async generateCustomerChurn(tenantId: string, dueDate: Date, thresholds: Record<string, number>) {
    const daysBack = thresholds.customer_churn_days;
    const cutoff = new Date(dueDate);
    cutoff.setDate(cutoff.getDate() - daysBack);

    const customers = await this.prisma.customer.findMany({
      where: { tenantId, status: 'active' },
      select: {
        id: true,
        name: true,
        workOrders: {
          where: { status: 'settled' },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { updatedAt: true },
        },
      },
    });

    for (const customer of customers) {
      if (!customer.workOrders || customer.workOrders.length === 0) continue;
      const lastOrder = customer.workOrders[0];

      if (lastOrder.updatedAt > cutoff) continue;

      const daysSince = Math.floor((dueDate.getTime() - lastOrder.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      const content = `${customer.name} 已 ${daysSince} 天未到店消费，建议回访`;

      await this.upsertReminder({
        tenantId,
        type: 'customer_churn',
        customerId: customer.id,
        vehicleId: null,
        relatedId: null,
        content,
        dueDate,
      });
    }
  }

  private async upsertReminder(data: {
    tenantId: string;
    type: string;
    customerId: string;
    vehicleId: string | null;
    relatedId: string | null;
    content: string;
    dueDate: Date;
  }) {
    const existing = await this.prisma.reminder.findFirst({
      where: {
        tenantId: data.tenantId,
        type: data.type,
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        relatedId: data.relatedId,
        dueDate: data.dueDate,
      },
    });
    if (existing) {
      await this.prisma.reminder.update({
        where: { id: existing.id },
        data: { content: data.content },
      });
      return;
    }
    await this.prisma.reminder.create({
      data: {
        tenantId: data.tenantId,
        type: data.type,
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        relatedId: data.relatedId,
        content: data.content,
        dueDate: data.dueDate,
        status: 'pending',
      },
    });
  }
}
