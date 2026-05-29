import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class PackageCardService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: { page?: number; pageSize?: number; customerId?: string; status?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, customerId, status } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where: any = { tenantId: user.tenantId! };

    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

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
      data: {
        tenantId: user.tenantId!,
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
      },
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

    // 校验适用车辆
    if (card.vehicleId && card.vehicleId !== data.relatedId) {
      // 这里需要根据 relatedType 判断，简化处理
    }

    // 校验适用门店
    if (card.shopIds) {
      const shopIds = JSON.parse(card.shopIds);
      // 需要获取当前门店 ID 进行校验
    }

    // 查找套餐项
    const item = card.items.find(i => i.serviceItemId === data.serviceItemId);
    if (!item) throw new NotFoundException('套餐中不包含此服务项目');
    if (Number(item.remainQty) < data.quantity) throw new ForbiddenException('剩余次数不足');

    return this.prisma.$transaction(async (tx) => {
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

  // 流水查询
  async getTransactions(user: JwtPayload, query: { page?: number; pageSize?: number; cardId?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, cardId } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where: any = { tenantId: user.tenantId! };
    if (cardId) where.cardId = cardId;

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
