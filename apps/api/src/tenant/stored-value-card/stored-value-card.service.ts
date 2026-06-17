import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';
import { tenantWhere, tenantCreate } from '../../common/utils/tenant-where';

@Injectable()
export class StoredValueCardService {
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
      this.prisma.storedValueCard.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.storedValueCard.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string, user: JwtPayload) {
    const card = await this.prisma.storedValueCard.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!card) throw new NotFoundException('储值卡不存在');
    return card;
  }

  // 售卡
  async create(data: { cardNo: string; customerId: string; amount: number; gift?: number; remark?: string }, user: JwtPayload) {
    const existing = await this.prisma.storedValueCard.findFirst({
      where: { tenantId: user.tenantId!, cardNo: data.cardNo },
    });
    if (existing) throw new ConflictException('卡号已存在');

    const gift = data.gift || 0;
    const totalBalance = data.amount + gift;

    return this.prisma.$transaction(async (tx) => {
      const card = await tx.storedValueCard.create({
        data: tenantCreate(user, {
          cardNo: data.cardNo,
          customerId: data.customerId,
          balance: totalBalance,
          principalBalance: data.amount,
          giftBalance: gift,
          remark: data.remark,
        }),
      });

      await tx.storedValueTransaction.create({
        data: {
          tenantId: user.tenantId!,
          cardId: card.id,
          type: 'recharge',
          amount: totalBalance,
          principal: data.amount,
          gift,
          balanceAfter: totalBalance,
          operatorId: user.sub,
          remark: '售卡充值',
        },
      });

      return card;
    });
  }

  // 充值
  async recharge(cardId: string, data: { amount: number; gift?: number; remark?: string }, user: JwtPayload) {
    const card = await this.findOne(cardId, user);
    if (card.status !== 'active') throw new ForbiddenException('卡片状态异常');

    const gift = data.gift || 0;
    const total = data.amount + gift;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.storedValueCard.update({
        where: { id: cardId },
        data: {
          balance: { increment: total },
          principalBalance: { increment: data.amount },
          giftBalance: { increment: gift },
        },
      });

      await tx.storedValueTransaction.create({
        data: {
          tenantId: user.tenantId!,
          cardId,
          type: 'recharge',
          amount: total,
          principal: data.amount,
          gift,
          balanceAfter: updated.balance,
          operatorId: user.sub,
          remark: data.remark || '充值',
        },
      });

      return updated;
    });
  }

  // 消费
  async consume(cardId: string, amount: number, relatedType: string, relatedId: string, user: JwtPayload) {
    const card = await this.findOne(cardId, user);
    if (card.status !== 'active') throw new ForbiddenException('卡片状态异常');
    if (Number(card.balance) < amount) throw new ForbiddenException('余额不足');

    return this.prisma.$transaction(async (tx) => {
      // 先扣赠送余额，再扣本金
      let remaining = amount;
      let deductGift = 0;
      let deductPrincipal = 0;

      if (Number(card.giftBalance) > 0) {
        deductGift = Math.min(remaining, Number(card.giftBalance));
        remaining -= deductGift;
      }
      deductPrincipal = remaining;

      const updated = await tx.storedValueCard.update({
        where: { id: cardId },
        data: {
          balance: { decrement: amount },
          principalBalance: { decrement: deductPrincipal },
          giftBalance: { decrement: deductGift },
        },
      });

      await tx.storedValueTransaction.create({
        data: {
          tenantId: user.tenantId!,
          cardId,
          type: 'consume',
          amount: -amount,
          principal: -deductPrincipal,
          gift: -deductGift,
          balanceAfter: updated.balance,
          relatedType,
          relatedId,
          operatorId: user.sub,
        },
      });

      return updated;
    });
  }

  // 退款
  async refund(cardId: string, data: { amount: number; remark: string }, user: JwtPayload) {
    const card = await this.findOne(cardId, user);
    if (card.status !== 'active') throw new ForbiddenException('卡片状态异常');
    if (data.amount <= 0) throw new ForbiddenException('退款金额必须大于 0');
    if (Number(card.principalBalance) < data.amount) {
      throw new ForbiddenException(`退款金额不能超过本金余额(${Number(card.principalBalance)})`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.storedValueCard.update({
        where: { id: cardId, tenantId: user.tenantId! },
        data: {
          balance: { decrement: data.amount },
          principalBalance: { decrement: data.amount },
        },
      });

      await tx.storedValueTransaction.create({
        data: {
          tenantId: user.tenantId!,
          cardId,
          type: 'refund',
          amount: -data.amount,
          principal: -data.amount,
          balanceAfter: updated.balance,
          operatorId: user.sub,
          remark: data.remark,
        },
      });

      return updated;
    });
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
      this.prisma.storedValueTransaction.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.storedValueTransaction.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
