import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';
import { validateTransition } from './work-order.state-machine';
import { StockService } from '../stock/stock.service';
import { applyDataScope } from '../../common/utils/scope-where';

@Injectable()
export class WorkOrderService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
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
    validateTransition(order.status, status);

    return this.prisma.$transaction(async (tx) => {
      if (status === 'in_progress' && order.status !== 'in_progress') {
        await this.stockService.deductForWorkOrder(
          tx, user.tenantId!, order.shopId, id, user.sub,
        );
      }

      return tx.workOrder.update({
        where: { id, tenantId: user.tenantId! },
        data: { status },
      });
    });
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
