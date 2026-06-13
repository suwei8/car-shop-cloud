import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomerPortalService {
  constructor(private prisma: PrismaService) {}

  async getWorkOrders(customerId: string, tenantId: string, query: { page?: number; pageSize?: number }) {
    const { page: _p = 1, pageSize: _ps = 20 } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;

    const where = { customerId, tenantId };

    const [items, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { status: 'asc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          orderNo: true,
          orderType: true,
          vehiclePlateNo: true,
          status: true,
          totalAmount: true,
          payableAmount: true,
          createdAt: true,
          updatedAt: true,
          vehicle: { select: { plateNo: true, brand: true, model: true } },
          items: {
            select: {
              name: true,
              itemType: true,
              quantity: true,
              unitPrice: true,
              amount: true,
            },
          },
        },
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getWorkOrderDetail(id: string, customerId: string, tenantId: string) {
    const order = await this.prisma.workOrder.findFirst({
      where: { id, customerId, tenantId },
      select: {
        id: true,
        orderNo: true,
        orderType: true,
        vehiclePlateNo: true,
        vehicleMileage: true,
        status: true,
        totalAmount: true,
        discountAmount: true,
        payableAmount: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        expectDate: true,
        vehicle: { select: { plateNo: true, brand: true, model: true } },
        items: {
          select: {
            id: true,
            name: true,
            itemType: true,
            quantity: true,
            unit: true,
            unitPrice: true,
            amount: true,
          },
        },
      },
    });

    if (!order) throw new NotFoundException('工单不存在');
    return order;
  }

  async getCards(customerId: string, tenantId: string) {
    const storedValueCards = await this.prisma.storedValueCard.findMany({
      where: { customerId, tenantId, status: 'active' },
      select: {
        id: true,
        cardNo: true,
        balance: true,
        principalBalance: true,
        giftBalance: true,
        status: true,
        createdAt: true,
      },
    });

    const packageCards = await this.prisma.packageCard.findMany({
      where: { customerId, tenantId, status: { in: ['active', 'expired'] } },
      select: {
        id: true,
        cardNo: true,
        name: true,
        startAt: true,
        endAt: true,
        status: true,
        items: {
          select: {
            totalQty: true,
            remainQty: true,
          },
        },
      },
    });

    return { storedValueCards, packageCards };
  }

  async getMe(customerId: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: {
        id: true,
        name: true,
        phone: true,
        tenant: { select: { id: true, name: true } },
      },
    });

    if (!customer) throw new NotFoundException('客户不存在');

    return customer;
  }
}
