import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class WorkOrderService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: { page?: number; pageSize?: number; status?: string; shopId?: string; orderType?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, status, shopId, orderType } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where: any = { tenantId: user.tenantId! };

    if (status) where.status = status;
    if (shopId) where.shopId = shopId;
    if (orderType) where.orderType = orderType;

    const [items, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          vehicle: { select: { id: true, plateNo: true, brand: true, model: true } },
          items: { take: 3 },
        },
      }),
      this.prisma.workOrder.count({ where }),
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
    items?: { serviceItemId?: string; itemType: string; name: string; quantity: number; unit?: string; unitPrice: number; technicianId?: string }[];
  }, user: JwtPayload) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: data.vehicleId, tenantId: user.tenantId! },
    });
    if (!vehicle) throw new NotFoundException('车辆不存在');

    const orderNo = await this.generateOrderNo(user.tenantId!);

    const items = (data.items || []).map(item => ({
      ...item,
      tenantId: user.tenantId!,
      amount: item.quantity * item.unitPrice,
    }));

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    return this.prisma.workOrder.create({
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
  }

  async updateStatus(id: string, status: string, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.workOrder.update({
      where: { id },
      data: { status },
    });
  }

  async addItems(orderId: string, items: {
    serviceItemId?: string; itemType: string; name: string;
    quantity: number; unit?: string; unitPrice: number; technicianId?: string;
  }[], user: JwtPayload) {
    const order = await this.findOne(orderId, user);

    const newItems = items.map(item => ({
      ...item,
      tenantId: user.tenantId!,
      workOrderId: orderId,
      amount: item.quantity * item.unitPrice,
    }));

    await this.prisma.workOrderItem.createMany({ data: newItems });

    const addedAmount = newItems.reduce((sum, item) => sum + item.amount, 0);

    await this.prisma.workOrder.update({
      where: { id: orderId },
      data: {
        totalAmount: { increment: addedAmount },
        payableAmount: { increment: addedAmount },
      },
    });

    return this.findOne(orderId, user);
  }

  private async generateOrderNo(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.workOrder.count({
      where: {
        tenantId,
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        },
      },
    });
    return `WO${dateStr}${String(count + 1).padStart(4, '0')}`;
  }
}
