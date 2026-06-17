import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { JwtPayload } from '@car/shared';
import { tenantWhere, tenantCreate } from '../../common/utils/tenant-where';

@Injectable()
export class PackageCardService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: { page?: number; pageSize?: number; customerId?: string; status?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, customerId, status } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const baseWhere: any = {};

    if (customerId) baseWhere.customerId = customerId;
    if (status) baseWhere.status = status;

    const where = tenantWhere(user, baseWhere);

    const [items, total] = await Promise.all([
      this.prisma.packageCard.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      this.prisma.packageCard.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string, user: JwtPayload) {
    const card = await this.prisma.packageCard.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: {
        items: true,
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!card) throw new NotFoundException('套餐卡不存在');
    return card;
  }

  // 售卡
  async create(data: {
    cardNo: string; customerId: string; vehicleId?: string; shopIds?: string[];
    name: string; startAt: string; endAt: string; remark?: string;
    items: { serviceItemId: string; totalQty: number }[];
  }, user: JwtPayload) {
    const existing = await this.prisma.packageCard.findFirst({
      where: { tenantId: user.tenantId!, cardNo: data.cardNo },
    });
    if (existing) throw new ConflictException('卡号已存在');

    return this.prisma.packageCard.create({
      data: tenantCreate(user, {
        cardNo: data.cardNo,
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        shopIds: data.shopIds ? JSON.stringify(data.shopIds) : null,
        name: data.name,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        remark: data.remark,
        items: {
          create: data.items.map(item => ({
            tenantId: user.tenantId!,
            serviceItemId: item.serviceItemId,
            totalQty: item.totalQty,
            remainQty: item.totalQty,
          })),
        },
      }),
      include: { items: true },
    });
  }

  // 核销
  async consume(cardId: string, data: {
    serviceItemId: string; quantity: number;
    relatedType: string; relatedId: string;
  }, user: JwtPayload) {
    const card = await this.findOne(cardId, user);

    // 校验卡状态
    if (card.status !== 'active') throw new ForbiddenException('套餐卡状态异常');
    if (new Date() > card.endAt) throw new ForbiddenException('套餐卡已过期');

    // 校验适用车辆和适用门店
    if (data.relatedType === 'work-order') {
      const workOrder = await this.prisma.workOrder.findFirst({
        where: { id: data.relatedId, tenantId: user.tenantId! },
      });
      if (!workOrder) throw new NotFoundException('工单不存在');

      // 校验车辆
      if (card.vehicleId && card.vehicleId !== workOrder.vehicleId) {
        throw new ForbiddenException('此套餐卡不适用于当前工单对应的车辆');
      }

      // 校验门店
      if (card.shopIds) {
        const shopIds: string[] = JSON.parse(card.shopIds);
        if (!shopIds.includes(workOrder.shopId)) {
          throw new ForbiddenException('此套餐卡不适用于当前工单所在的门店');
        }
      }
    } else {
      // 校验适用车辆 (直接针对车辆)
      if (data.relatedType === 'vehicle') {
        if (card.vehicleId && card.vehicleId !== data.relatedId) {
          throw new ForbiddenException('此套餐卡不适用于当前车辆');
        }
      }

      // 校验适用门店 (直接针对门店)
      if (data.relatedType === 'shop') {
        if (card.shopIds) {
          const shopIds: string[] = JSON.parse(card.shopIds);
          if (!shopIds.includes(data.relatedId)) {
            throw new ForbiddenException('此套餐卡不适用于当前门店');
          }
        }
      }
    }

    // 查找套餐项
    const item = card.items.find((i: any) => i.serviceItemId === data.serviceItemId);
    if (!item) throw new NotFoundException('套餐中不包含此服务项目');
    if (Number(item.remainQty) < data.quantity) throw new ForbiddenException('剩余次数不足');

    return this.prisma.$transaction(async (tx: any) => {
      const updatedItem = await tx.packageCardItem.update({
        where: { id: item.id },
        data: { remainQty: { decrement: data.quantity } },
      });

      await tx.packageCardTransaction.create({
        data: {
          tenantId: user.tenantId!,
          cardId,
          itemId: item.id,
          type: 'consume',
          quantity: data.quantity,
          remainAfter: updatedItem.remainQty,
          relatedType: data.relatedType,
          relatedId: data.relatedId,
          operatorId: user.sub,
        },
      });

      return updatedItem;
    });
  }

  /**
   * 事务内核销套餐卡次数（供结算服务调用）
   */
  async redeem(
    tx: Prisma.TransactionClient,
    tenantId: string,
    cardId: string,
    itemId: string,
    quantity: number,
    relatedType: string,
    relatedId: string,
    operatorId: string,
    shopId?: string,
    vehicleId?: string,
  ): Promise<{ amount: number }> {
    const card = await tx.packageCard.findFirst({
      where: { id: cardId, tenantId },
      include: { items: true },
    });
    if (!card) throw new NotFoundException('套餐卡不存在');
    if (card.status !== 'active') throw new ForbiddenException('套餐卡状态异常');
    const now = new Date();
    if (now < card.startAt || now > card.endAt) throw new ForbiddenException('套餐卡已过期');

    if (vehicleId && card.vehicleId && card.vehicleId !== vehicleId) {
      throw new ForbiddenException('此套餐卡不适用于当前车辆');
    }
    if (shopId && card.shopIds) {
      const shopIds: string[] = JSON.parse(card.shopIds);
      if (!shopIds.includes(shopId)) {
        throw new ForbiddenException('此套餐卡不适用于当前门店');
      }
    }

    const item = card.items.find((i: any) => i.id === itemId);
    if (!item) throw new NotFoundException('套餐卡项目不存在');
    if (Number(item.remainQty) < quantity) throw new ForbiddenException('套餐卡剩余次数不足');

    const updatedItem = await tx.packageCardItem.update({
      where: { id: item.id },
      data: { remainQty: { decrement: quantity } },
    });

    await tx.packageCardTransaction.create({
      data: {
        tenantId,
        cardId,
        itemId: item.id,
        type: 'consume',
        quantity,
        remainAfter: updatedItem.remainQty,
        relatedType,
        relatedId,
        operatorId,
      },
    });

    return { amount: 0 };
  }

  // 流水查询
  async getTransactions(user: JwtPayload, query: { page?: number; pageSize?: number; cardId?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, cardId } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const baseWhere: any = {};
    if (cardId) baseWhere.cardId = cardId;

    const where = tenantWhere(user, baseWhere);

    const [items, total] = await Promise.all([
      this.prisma.packageCardTransaction.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.packageCardTransaction.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
