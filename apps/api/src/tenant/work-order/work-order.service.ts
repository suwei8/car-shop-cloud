import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';
import { validateTransition } from './work-order.state-machine';
import { StockService } from '../stock/stock.service';
import { applyDataScope } from '../../common/utils/scope-where';
import { NotificationService } from '../../notification/notification.service';
import { FeatureFlagService } from '../../platform/feature-flag/feature-flag.service';

@Injectable()
export class WorkOrderService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    private notificationService: NotificationService,
    private featureFlagService: FeatureFlagService,
  ) {}

  async findAll(user: JwtPayload, query: { page?: number; pageSize?: number; status?: string; shopId?: string; orderType?: string; customerId?: string; vehicleId?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, status, shopId, orderType, customerId, vehicleId } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where: any = { tenantId: user.tenantId! };

    if (status) where.status = status;
    if (shopId) where.shopId = shopId;
    if (orderType) where.orderType = orderType;
    if (customerId) where.customerId = customerId;
    if (vehicleId) where.vehicleId = vehicleId;

    const scopedWhere = applyDataScope(user, where, 'shopId', 'advisorId');

    const [items, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where: scopedWhere,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          vehicle: { select: { id: true, plateNo: true, brand: true, model: true } },
          items: { take: 3 },
        },
      }),
      this.prisma.workOrder.count({ where: scopedWhere }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string, user: JwtPayload) {
    const order = await this.prisma.workOrder.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: {
        customer: true,
        vehicle: true,
        items: true,
        inspections: true,
        dispatchTasks: true,
      },
    });
    if (!order) throw new NotFoundException('工单不存在');
    return order;
  }

  async create(data: {
    shopId: string; orderType: string; customerId: string; vehicleId: string;
    advisorId?: string; description?: string; remark?: string;
    expectDate?: string | Date;
    items?: { serviceItemId?: string; itemType: string; name: string; quantity: number; unit?: string; unitPrice: number; technicianId?: string }[];
  }, user: JwtPayload) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: data.vehicleId, tenantId: user.tenantId! },
    });
    if (!vehicle) throw new NotFoundException('车辆不存在');

    const items = (data.items || []).map(item => {
      const isPart = item.itemType === 'part';
      const { serviceItemId: _, ...rest } = item;
      return {
        ...rest,
        part: isPart && item.serviceItemId ? { connect: { id: item.serviceItemId } } : undefined,
        serviceItem: !isPart && item.serviceItemId ? { connect: { id: item.serviceItemId } } : undefined,
        tenant: { connect: { id: user.tenantId! } },
        amount: item.quantity * item.unitPrice,
      };
    });

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    return this.prisma.$transaction(async (tx) => {
      const orderNo = await this.generateOrderNo(user.tenantId!, tx);

      return tx.workOrder.create({
        data: {
          tenantId: user.tenantId!,
          shopId: data.shopId,
          orderNo,
          orderType: data.orderType,
          customerId: data.customerId,
          vehicleId: data.vehicleId,
          vehiclePlateNo: vehicle.plateNo,
          advisorId: data.advisorId,
          description: data.description,
          remark: data.remark,
          expectDate: data.expectDate ? new Date(data.expectDate) : null,
          totalAmount,
          payableAmount: totalAmount,
          items: { create: items },
        },
        include: {
          customer: true,
          vehicle: true,
          items: true,
        },
      });
    });
  }

  async updateStatus(id: string, status: string, user: JwtPayload) {
    const order = await this.findOne(id, user);

    // 查询当前租户是否开启简易模式
    const simpleMode = await this.featureFlagService.isFlagEnabled(user.tenantId!, 'simple_mode');

    validateTransition(order.status, status, simpleMode);

    const result = await this.prisma.$transaction(async (tx) => {
      // 普通模式：in_progress 时扣减库存
      // 简易模式：completed 时扣减库存（跳过 in_progress）
      const shouldDeductInInProgress = status === 'in_progress' && order.status !== 'in_progress' && !simpleMode;
      const shouldDeductInCompleted = status === 'completed' && simpleMode;
      const shouldSnapshotWarranty = shouldDeductInInProgress || shouldDeductInCompleted;

      if (shouldDeductInInProgress || shouldDeductInCompleted) {
        await this.stockService.deductForWorkOrder(
          tx, user.tenantId!, order.shopId, id, user.sub,
        );
      }

      // 作废工单：回滚已扣减的库存
      if (status === 'cancelled') {
        await this.stockService.reverseDeductForWorkOrder(
          tx, user.tenantId!, order.shopId, id, user.sub,
        );
      }

      // 质保快照：扣库存时从 Part 写入供应商/质保月数/质保截止
      if (shouldSnapshotWarranty) {
        const partItems = order.items.filter((item: any) => item.itemType === 'part' && item.partId);
        if (partItems.length > 0) {
          const partIds = partItems.map((item: any) => item.partId);
          const parts = await tx.part.findMany({
            where: { id: { in: partIds }, tenantId: user.tenantId! },
            select: { id: true, supplierId: true, warrantyMonths: true },
          });
          const partMap = new Map(parts.map(p => [p.id, p]));

          // 完工日期：当前时间
          const completedAt = new Date();

          for (const item of partItems) {
            const partInfo = partMap.get(item.partId!);
            if (!partInfo) continue;

            const warrantyMonths = partInfo.warrantyMonths || 0;
            let warrantyUntil: Date | null = null;
            if (warrantyMonths > 0) {
              warrantyUntil = new Date(completedAt);
              warrantyUntil.setMonth(warrantyUntil.getMonth() + warrantyMonths);
            }

            await tx.workOrderItem.update({
              where: { id: item.id },
              data: {
                supplierId: partInfo.supplierId || null,
                warrantyMonths,
                warrantyUntil,
              },
            });
          }
        }
      }

      return tx.workOrder.update({
        where: { id, tenantId: user.tenantId! },
        data: { status },
      });
    });

    if (status === 'completed') {
      try {
        const isDuplicate = await this.notificationService.checkDuplicate(
          user.tenantId!, 'work_order', id, 'work_order_completed',
        );

        if (!isDuplicate) {
          const notifyParam = await this.prisma.systemParameter.findFirst({
            where: { tenantId: user.tenantId!, group: 'notify', key: 'notify_customer_on_completed' },
          });
          const notifyEnabled = !notifyParam || notifyParam.value !== 'false';

          if (!notifyEnabled) {
            await this.notificationService.skip({
              tenantId: user.tenantId!,
              shopId: order.shopId,
              channel: 'sms',
              scene: 'work_order_completed',
              recipient: '',
              content: '',
              relatedType: 'work_order',
              relatedId: id,
              failReason: '商户已关闭完工通知',
            });
          } else {
            const shop = await this.prisma.shop.findUnique({
              where: { id: order.shopId },
              select: { name: true },
            });

            const customerPhone = order.customer?.phone;
            if (!customerPhone) {
              await this.notificationService.skip({
                tenantId: user.tenantId!,
                shopId: order.shopId,
                channel: 'sms',
                scene: 'work_order_completed',
                recipient: '',
                content: '',
                relatedType: 'work_order',
                relatedId: id,
                failReason: '客户无手机号',
              });
            } else {
              const content = `您的爱车 ${order.vehiclePlateNo} 已在 ${shop?.name || '本店'} 完成施工，可随时到店取车。`;
              await this.notificationService.send({
                tenantId: user.tenantId!,
                shopId: order.shopId,
                channel: 'sms',
                scene: 'work_order_completed',
                recipient: customerPhone,
                content,
                relatedType: 'work_order',
                relatedId: id,
              });
            }
          }
        }
      } catch (err) {
        console.error(`[Notification] Failed for work order ${id}:`, err.message);
      }
    }

    return result;
  }

  async addItems(orderId: string, items: {
    serviceItemId?: string; itemType: string; name: string;
    quantity: number; unit?: string; unitPrice: number; technicianId?: string;
  }[], user: JwtPayload) {
    const order = await this.findOne(orderId, user);

    const newItems = items.map(item => {
      const isPart = item.itemType === 'part';
      return {
        ...item,
        partId: isPart ? item.serviceItemId : null,
        serviceItemId: isPart ? null : (item.serviceItemId || null),
        tenantId: user.tenantId!,
        workOrderId: orderId,
        amount: item.quantity * item.unitPrice,
      };
    });

    const addedAmount = newItems.reduce((sum, item) => sum + item.amount, 0);

    return this.prisma.$transaction(async (tx) => {
      await tx.workOrderItem.createMany({ data: newItems });

      await tx.workOrder.update({
        where: { id: orderId, tenantId: user.tenantId! },
        data: {
          totalAmount: { increment: addedAmount },
          payableAmount: { increment: addedAmount },
        },
      });

      return this.findOne(orderId, user);
    });
  }

  private async generateOrderNo(tenantId: string, tx: any): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = await tx.sequence.upsert({
      where: { tenantId_key_date: { tenantId, key: 'work_order', date: dateStr } },
      update: { value: { increment: 1 } },
      create: { tenantId, key: 'work_order', date: dateStr, value: 1 },
    });
    return `WO${dateStr}${String(seq.value).padStart(4, '0')}`;
  }
}
