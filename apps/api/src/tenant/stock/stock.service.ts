import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { JwtPayload } from '@car/shared';
import { tenantWhere, tenantCreate } from '../../common/utils/tenant-where';

interface StockBalanceWithPart {
  quantity: unknown;
  part: { minStock?: number | null };
}

interface WorkOrderPartItemRecord {
  itemType: string;
  partId?: string | null;
  quantity: unknown;
  unitPrice: unknown;
  amount: unknown;
}

interface StockBillItemRecord {
  id: string;
  partId: string;
  quantity: unknown;
  unitPrice: unknown;
  amount: unknown;
}

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  // 库存余额查询
  async getBalances(user: JwtPayload, query: { warehouseId?: string; partId?: string; lowStock?: boolean }) {
    const { warehouseId, partId, lowStock } = query;
    const baseWhere: any = {};

    if (warehouseId) baseWhere.warehouseId = warehouseId;
    if (partId) baseWhere.partId = partId;

    const where = tenantWhere(user, baseWhere);

    const scope = user.dataScope || 'shop';
    if (!user.isPlatform) {
      if (scope === 'shop' && user.shopId) {
        where.warehouse = { shopId: user.shopId };
      } else if (scope === 'self') {
        where.operatorId = user.sub;
      }
    }

    const balances = await this.prisma.stockBalance.findMany({
      where,
      include: {
        part: { select: { id: true, code: true, name: true, category: true, unit: true, minStock: true, salePrice: true } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (lowStock) {
      return (balances as StockBalanceWithPart[]).filter((b: StockBalanceWithPart) => Number(b.quantity) <= (b.part.minStock || 0));
    }

    return balances;
  }

  // 入库
  async stockIn(data: {
    shopId: string; supplierId?: string; remark?: string;
    items: { partId: string; quantity: number; unitPrice: number }[];
  }, user: JwtPayload) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { tenantId: user.tenantId!, shopId: data.shopId, isDefault: true },
    });
    if (!warehouse) throw new NotFoundException('未找到默认仓库，请先创建仓库');

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const billNo = await this.generateBillNo(user.tenantId!, 'IN', tx);
      const bill = await tx.stockBill.create({
        data: tenantCreate(user, {
          shopId: data.shopId,
          billNo,
          billType: 'in',
          supplierId: data.supplierId,
          operatorId: user.sub,
          remark: data.remark,
          status: 'confirmed',
          items: {
            create: data.items.map(item => ({
              tenantId: user.tenantId!,
              partId: item.partId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.quantity * item.unitPrice,
            })),
          },
        }),
        include: { items: true },
      });

      // 更新库存余额和写入流水
      for (const item of bill.items) {
        const balance = await tx.stockBalance.upsert({
          where: { tenantId_warehouseId_partId: { tenantId: user.tenantId!, warehouseId: warehouse.id, partId: item.partId } },
          update: { quantity: { increment: item.quantity } },
          create: { tenantId: user.tenantId!, warehouseId: warehouse.id, partId: item.partId, quantity: item.quantity },
        });

        await tx.stockMovement.create({
          data: {
            tenantId: user.tenantId!,
            partId: item.partId,
            warehouseId: warehouse.id,
            movementType: 'in',
            quantity: item.quantity,
            balanceAfter: balance.quantity,
            billId: bill.id,
            billItemId: item.id,
            operatorId: user.sub,
          },
        });
      }

      return bill;
    });
  }

  // 工单出库（施工确认时扣库存）
  async stockOutForWorkOrder(workOrderId: string, user: JwtPayload) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId: user.tenantId! },
      include: { items: true },
    });
    if (!workOrder) throw new NotFoundException('工单不存在');

    // 筛选出配件类型的项目
    const partItems = (workOrder.items as WorkOrderPartItemRecord[]).filter((item: WorkOrderPartItemRecord) => item.itemType === 'part');
    if (partItems.length === 0) return { message: '无配件需要出库' };

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { tenantId: user.tenantId!, shopId: workOrder.shopId, isDefault: true },
    });
    if (!warehouse) throw new NotFoundException('未找到默认仓库');

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const billNo = await this.generateBillNo(user.tenantId!, 'OUT', tx);
      const bill = await tx.stockBill.create({
        data: {
          tenantId: user.tenantId!,
          shopId: workOrder.shopId,
          billNo,
          billType: 'out',
          relatedType: 'work_order',
          relatedId: workOrderId,
          operatorId: user.sub,
          status: 'confirmed',
          items: {
            create: partItems.map((item: WorkOrderPartItemRecord) => ({
              tenantId: user.tenantId!,
              partId: item.partId || '',
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              amount: Number(item.amount),
            })),
          },
        },
        include: { items: true },
      });

      for (const item of bill.items) {
        const balance = await tx.stockBalance.findFirst({
          where: { tenantId: user.tenantId!, warehouseId: warehouse.id, partId: item.partId },
        });

        if (!balance || Number(balance.quantity) < Number(item.quantity)) {
          throw new ForbiddenException(`配件库存不足`);
        }

        const updated = await tx.stockBalance.update({
          where: { id: balance.id },
          data: { quantity: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            tenantId: user.tenantId!,
            partId: item.partId,
            warehouseId: warehouse.id,
            movementType: 'out',
            quantity: -Number(item.quantity),
            balanceAfter: updated.quantity,
            billId: bill.id,
            billItemId: item.id,
            relatedType: 'work_order',
            relatedId: workOrderId,
            operatorId: user.sub,
          },
        });
      }

      return bill;
    });
  }

  /**
   * 工单施工扣减库存（事务内调用）
   * 在 work-order service 的 $transaction 中使用
   */
  async deductForWorkOrder(
    tx: Prisma.TransactionClient,
    tenantId: string,
    shopId: string,
    workOrderId: string,
    operatorId: string,
  ): Promise<void> {
    // 防重复扣减
    const existingBill = await tx.stockBill.findFirst({
      where: { tenantId, relatedType: 'work_order', relatedId: workOrderId, billType: 'out' },
    });
    if (existingBill) return;

    const workOrder = await tx.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: { items: true },
    });
    if (!workOrder) return;

    const partItems = (workOrder.items as WorkOrderPartItemRecord[]).filter((item: WorkOrderPartItemRecord) => item.itemType === 'part' && item.partId);
    if (partItems.length === 0) return;

    const warehouse = await tx.warehouse.findFirst({
      where: { tenantId, shopId, isDefault: true },
    });
    if (!warehouse) return;

    const billNo = await this.generateBillNo(tenantId, 'OUT', tx);
    const bill = await tx.stockBill.create({
      data: {
        tenantId,
        shopId,
        billNo,
        billType: 'out',
        relatedType: 'work_order',
        relatedId: workOrderId,
        operatorId,
        status: 'confirmed',
        items: {
          create: partItems.map((item: WorkOrderPartItemRecord) => ({
            tenantId,
            partId: item.partId!,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            amount: Number(item.amount),
          })),
        },
      },
      include: { items: true },
    });

    for (const item of bill.items) {
      const balance = await tx.stockBalance.findFirst({
        where: { tenantId, warehouseId: warehouse.id, partId: item.partId },
      });

      const currentQty = balance ? Number(balance.quantity) : 0;
      const deductQty = Number(item.quantity);
      const isNegative = currentQty < deductQty;

      let updated;
      if (balance) {
        updated = await tx.stockBalance.update({
          where: { id: balance.id },
          data: { quantity: { decrement: item.quantity } },
        });
      } else {
        updated = await tx.stockBalance.create({
          data: { tenantId, warehouseId: warehouse.id, partId: item.partId, quantity: -deductQty },
        });
      }

      await tx.stockMovement.create({
        data: {
          tenantId,
          partId: item.partId,
          warehouseId: warehouse.id,
          movementType: 'out',
          quantity: -deductQty,
          balanceAfter: updated.quantity,
          billId: bill.id,
          billItemId: item.id,
          relatedType: 'work_order',
          relatedId: workOrderId,
          operatorId,
          remark: isNegative ? '库存不足' : undefined,
        },
      });
    }
  }

  /**
   * 工单作废回滚库存（事务内调用）
   * 查找该工单已生成的出库流水，生成反向入库流水回滚库存；幂等。
   */
  async reverseDeductForWorkOrder(
    tx: Prisma.TransactionClient,
    tenantId: string,
    shopId: string,
    workOrderId: string,
    operatorId: string,
  ): Promise<void> {
    // 幂等：检查是否已有回滚入库单
    const existingReverseBill = await tx.stockBill.findFirst({
      where: { tenantId, relatedType: 'work_order', relatedId: workOrderId, billType: 'in' },
    });
    if (existingReverseBill) return;

    // 查找该工单的出库单
    const outBill = await tx.stockBill.findFirst({
      where: { tenantId, relatedType: 'work_order', relatedId: workOrderId, billType: 'out' },
      include: { items: true },
    });
    if (!outBill || outBill.items.length === 0) return;

    const warehouse = await tx.warehouse.findFirst({
      where: { tenantId, shopId, isDefault: true },
    });
    if (!warehouse) return;

    const billNo = await this.generateBillNo(tenantId, 'IN', tx);
    const inBill = await tx.stockBill.create({
      data: {
        tenantId,
        shopId,
        billNo,
        billType: 'in',
        relatedType: 'work_order',
        relatedId: workOrderId,
        operatorId,
        remark: `工单作废回滚（原出库单 ${outBill.billNo}）`,
        status: 'confirmed',
        items: {
          create: (outBill.items as StockBillItemRecord[]).map((item: StockBillItemRecord) => ({
            tenantId,
            partId: item.partId,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            amount: Number(item.amount),
          })),
        },
      },
      include: { items: true },
    });

    for (const item of inBill.items) {
      const balance = await tx.stockBalance.findFirst({
        where: { tenantId, warehouseId: warehouse.id, partId: item.partId },
      });

      let updated;
      if (balance) {
        updated = await tx.stockBalance.update({
          where: { id: balance.id },
          data: { quantity: { increment: item.quantity } },
        });
      } else {
        updated = await tx.stockBalance.create({
          data: { tenantId, warehouseId: warehouse.id, partId: item.partId, quantity: item.quantity },
        });
      }

      await tx.stockMovement.create({
        data: {
          tenantId,
          partId: item.partId,
          warehouseId: warehouse.id,
          movementType: 'in',
          quantity: Number(item.quantity),
          balanceAfter: updated.quantity,
          billId: inBill.id,
          billItemId: item.id,
          relatedType: 'work_order',
          relatedId: workOrderId,
          operatorId,
          remark: `工单作废回滚`,
        },
      });
    }
  }

  // 库存流水查询
  async getMovements(user: JwtPayload, query: { page?: number; pageSize?: number; partId?: string; movementType?: string }) {
    const { page = 1, pageSize = 20, partId, movementType } = query;
    const baseWhere: any = {};

    if (partId) baseWhere.partId = partId;
    if (movementType) baseWhere.movementType = movementType;

    const where = tenantWhere(user, baseWhere);

    const scope = user.dataScope || 'shop';
    if (!user.isPlatform) {
      if (scope === 'shop' && user.shopId) {
        where.warehouse = { shopId: user.shopId };
      } else if (scope === 'self') {
        where.operatorId = user.sub;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          part: { select: { code: true, name: true } },
          warehouse: { select: { name: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  // 单据查询
  async getBills(user: JwtPayload, query: { page?: number; pageSize?: number; billType?: string; shopId?: string }) {
    const { page = 1, pageSize = 20, billType, shopId } = query;
    const baseWhere: any = {};

    if (billType) baseWhere.billType = billType;
    if (shopId) baseWhere.shopId = shopId;

    const where = tenantWhere(user, baseWhere);

    const scope = user.dataScope || 'shop';
    if (!user.isPlatform) {
      if (scope === 'shop' && user.shopId && !where.shopId) {
        where.shopId = user.shopId;
      } else if (scope === 'self') {
        where.operatorId = user.sub;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.stockBill.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { part: { select: { code: true, name: true } } } } },
      }),
      this.prisma.stockBill.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  private async generateBillNo(tenantId: string, prefix: string, tx: any): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = await tx.sequence.upsert({
      where: { tenantId_key_date: { tenantId, key: `stock_bill_${prefix}`, date: dateStr } },
      update: { value: { increment: 1 } },
      create: { tenantId, key: `stock_bill_${prefix}`, date: dateStr, value: 1 },
    });
    return `${prefix}${dateStr}${String(seq.value).padStart(4, '0')}`;
  }
}
