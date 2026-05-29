import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class SettlementService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: { page?: number; pageSize?: number; shopId?: string; status?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, shopId, status } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where: any = { tenantId: user.tenantId! };

    if (shopId) where.shopId = shopId;
    if (status) where.status = status;

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

    const settleNo = await this.generateSettleNo(user.tenantId!);

    return this.prisma.$transaction(async (tx) => {
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

  private async generateSettleNo(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.settlement.count({
      where: { tenantId, settleNo: { startsWith: `ST${dateStr}` } },
    });
    return `ST${dateStr}${String(count + 1).padStart(4, '0')}`;
  }
}
