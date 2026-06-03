import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class SettlementService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: { page?: number; pageSize?: number; shopId?: string; status?: string; workOrderId?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, shopId, status, workOrderId } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where: any = { tenantId: user.tenantId! };

    if (shopId) where.shopId = shopId;
    if (status) where.status = status;
    if (workOrderId) where.workOrderId = workOrderId;

    const [items, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { payments: true },
      }),
      this.prisma.settlement.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string, user: JwtPayload) {
    const settlement = await this.prisma.settlement.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: { payments: true },
    });
    if (!settlement) throw new NotFoundException('结算单不存在');
    return settlement;
  }

  // 工单结算
  async settle(data: {
    workOrderId: string; discountAmount?: number;
    payments: { payMethod: string; amount: number; referenceNo?: string; cardId?: string; remark?: string }[];
  }, user: JwtPayload) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: data.workOrderId, tenantId: user.tenantId! },
    });
    if (!workOrder) throw new NotFoundException('工单不存在');
    if (workOrder.status === 'settled') throw new ForbiddenException('工单已结算');
    if (workOrder.status !== 'completed') throw new ForbiddenException('只能结算已完成的工单');

    const totalAmount = Number(workOrder.totalAmount);
    const discountAmount = data.discountAmount || 0;
    const payableAmount = totalAmount - discountAmount;
    const paidAmount = data.payments.reduce((sum, p) => sum + p.amount, 0);
    const debtAmount = Math.max(0, payableAmount - paidAmount);

    return this.prisma.$transaction(async (tx) => {
      const settleNo = await this.generateSettleNo(user.tenantId!, tx);
      const settlement = await tx.settlement.create({
        data: {
          tenantId: user.tenantId!,
          shopId: workOrder.shopId,
          settleNo,
          workOrderId: data.workOrderId,
          totalAmount,
          discountAmount,
          payableAmount,
          paidAmount,
          debtAmount,
          operatorId: user.sub,
          payments: {
            create: data.payments.map(p => ({
              tenantId: user.tenantId!,
              payMethod: p.payMethod,
              amount: p.amount,
              referenceNo: p.referenceNo,
              cardId: p.cardId,
              remark: p.remark,
            })),
          },
        },
        include: { payments: true },
      });

      // 处理储值卡支付余额扣减
      for (const p of data.payments) {
        if ((p.payMethod === 'card' || p.payMethod === 'stored_value') && p.cardId) {
          const card = await tx.storedValueCard.findFirst({
            where: { id: p.cardId, tenantId: user.tenantId! },
          });
          if (!card) throw new NotFoundException('储值卡不存在');
          if (card.status !== 'active') throw new ForbiddenException('储值卡状态异常');
          if (Number(card.balance) < p.amount) throw new ForbiddenException('储值卡余额不足');

          // 先扣赠送余额，再扣本金
          let remaining = p.amount;
          let deductGift = 0;
          let deductPrincipal = 0;

          if (Number(card.giftBalance) > 0) {
            deductGift = Math.min(remaining, Number(card.giftBalance));
            remaining -= deductGift;
          }
          deductPrincipal = remaining;

          const updatedCard = await tx.storedValueCard.update({
            where: { id: p.cardId },
            data: {
              balance: { decrement: p.amount },
              principalBalance: { decrement: deductPrincipal },
              giftBalance: { decrement: deductGift },
            },
          });

          await tx.storedValueTransaction.create({
            data: {
              tenantId: user.tenantId!,
              cardId: p.cardId,
              type: 'consume',
              amount: -p.amount,
              principal: -deductPrincipal,
              gift: -deductGift,
              balanceAfter: updatedCard.balance,
              relatedType: 'settlement',
              relatedId: settlement.id,
              operatorId: user.sub,
              remark: p.remark || '工单结算扣减',
            },
          });
        }
      }

      // 更新工单状态
      await tx.workOrder.update({
        where: { id: data.workOrderId },
        data: {
          status: 'settled',
          discountAmount,
          payableAmount,
        },
      });

      return settlement;
    });
  }

  // 反结算
  async reverse(settlementId: string, user: JwtPayload) {
    const settlement = await this.findOne(settlementId, user);
    if (settlement.status !== 'settled') throw new ForbiddenException('只能反结算已结算的单据');

    return this.prisma.$transaction(async (tx) => {
      // 退还储值卡金额
      const cardTransactions = await tx.storedValueTransaction.findMany({
        where: {
          tenantId: user.tenantId!,
          relatedType: 'settlement',
          relatedId: settlementId,
          type: 'consume',
        },
      });

      for (const txRecord of cardTransactions) {
        const card = await tx.storedValueCard.findFirst({
          where: { id: txRecord.cardId, tenantId: user.tenantId! },
        });
        if (card) {
          // 由于 txRecord.amount, txRecord.principal, txRecord.gift 当时记录的是负数
          // 退还时我们取反增量加回去
          const addTotal = -Number(txRecord.amount);
          const addPrincipal = -Number(txRecord.principal);
          const addGift = -Number(txRecord.gift);

          const updatedCard = await tx.storedValueCard.update({
            where: { id: txRecord.cardId },
            data: {
              balance: { increment: addTotal },
              principalBalance: { increment: addPrincipal },
              giftBalance: { increment: addGift },
            },
          });

          await tx.storedValueTransaction.create({
            data: {
              tenantId: user.tenantId!,
              cardId: txRecord.cardId,
              type: 'refund',
              amount: addTotal,
              principal: addPrincipal,
              gift: addGift,
              balanceAfter: updatedCard.balance,
              relatedType: 'settlement',
              relatedId: settlementId,
              operatorId: user.sub,
              remark: '工单反结算退回',
            },
          });
        }
      }

      await tx.payment.deleteMany({ where: { settlementId } });
      await tx.settlement.update({
        where: { id: settlementId },
        data: { status: 'refunded' },
      });
      await tx.workOrder.update({
        where: { id: settlement.workOrderId },
        data: { status: 'completed' },
      });

      return { message: '反结算成功' };
    });
  }

  // 收款记录查询
  async getPayments(user: JwtPayload, query: { page?: number; pageSize?: number; payMethod?: string; startDate?: string; endDate?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, payMethod, startDate, endDate } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where: any = { tenantId: user.tenantId! };

    if (payMethod) where.payMethod = payMethod;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59');
    }

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { settlement: { select: { settleNo: true, workOrderId: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  private async generateSettleNo(tenantId: string, tx: any): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = await tx.sequence.upsert({
      where: { tenantId_key_date: { tenantId, key: 'settlement', date: dateStr } },
      update: { value: { increment: 1 } },
      create: { tenantId, key: 'settlement', date: dateStr, value: 1 },
    });
    return `ST${dateStr}${String(seq.value).padStart(4, '0')}`;
  }
}
