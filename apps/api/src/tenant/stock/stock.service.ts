import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  // 库存余额查询
  async getBalances(user: JwtPayload, query: { warehouseId?: string; partId?: string; lowStock?: boolean }) {
    const { warehouseId, partId, lowStock } = query;
    const where: any = { tenantId: user.tenantId! };

    if (warehouseId) where.warehouseId = warehouseId;
    if (partId) where.partId = partId;

    const balances = await this.prisma.stockBalance.findMany({
      where,
      include: {
        part: { select: { id: true, code: true, name: true, category: true, unit: true, minStock: true, salePrice: true } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (lowStock) {
      return balances.filter(b => Number(b.quantity) <= (b.part.minStock || 0));
    }

    return balances;
  }

  // 入库
  async stockIn(data: {
    shopId: string; supplierId?: string; remark?: string;
    items: { partId: string; quantity: number; unitPrice: number }[];
  }, user: JwtPayload) {
    const billNo = await this.generateBillNo(user.tenantId!, 'IN');

    // 获取默认仓库
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { tenantId: user.tenantId!, shopId: data.shopId, isDefault: true },
    });
    if (!warehouse) throw new NotFoundException('未找到默认仓库，请先创建仓库');

    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.stockBill.create({
        data: {
          tenantId: user.tenantId!,
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
        },
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
    const partItems = workOrder.items.filter(item => item.itemType === 'part');
    if (partItems.length === 0) return { message: '无配件需要出库' };

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { tenantId: user.tenantId!, shopId: workOrder.shopId, isDefault: true },
    });
    if (!warehouse) throw new NotFoundException('未找到默认仓库');

    const billNo = await this.generateBillNo(user.tenantId!, 'OUT');

    return this.prisma.$transaction(async (tx) => {
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
            create: partItems.map(item => ({
              tenantId: user.tenantId!,
              partId: item.serviceItemId || '',
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

  // 库存流水查询
  async getMovements(user: JwtPayload, query: { page?: number; pageSize?: number; partId?: string; movementType?: string }) {
    const { page = 1, pageSize = 20, partId, movementType } = query;
    const where: any = { tenantId: user.tenantId! };

    if (partId) where.partId = partId;
    if (movementType) where.movementType = movementType;

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
    const where: any = { tenantId: user.tenantId! };

    if (billType) where.billType = billType;
    if (shopId) where.shopId = shopId;

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

  private async generateBillNo(tenantId: string, prefix: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.stockBill.count({
      where: {
        tenantId,
        billNo: { startsWith: `${prefix}${dateStr}` },
      },
    });
    return `${prefix}${dateStr}${String(count + 1).padStart(4, '0')}`;
  }
}
