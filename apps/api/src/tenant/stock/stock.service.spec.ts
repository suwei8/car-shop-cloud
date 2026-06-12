import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StockService } from './stock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StockService', () => {
  let service: StockService;
  let prisma: Record<string, any>;

  const mockUser = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    shopId: 'shop-1',
    isPlatform: false,
    roles: ['tenant_admin'],
    permissions: [],
  };

  beforeEach(async () => {
    prisma = {
      warehouse: {
        findFirst: jest.fn(),
      },
      stockBalance: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      stockBill: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      stockBillItem: {},
      stockMovement: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      workOrder: {
        findFirst: jest.fn(),
      },
      sequence: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn({
        warehouse: prisma.warehouse,
        stockBalance: prisma.stockBalance,
        stockBill: prisma.stockBill,
        stockBillItem: prisma.stockBillItem,
        stockMovement: prisma.stockMovement,
        workOrder: prisma.workOrder,
        sequence: prisma.sequence,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(StockService);
  });

  describe('stockIn（入库）', () => {
    it('入库：库存余额增加 + 流水记录', async () => {
      prisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', name: '默认仓库' });
      prisma.sequence.upsert.mockResolvedValue({ value: 1 });
      prisma.stockBill.create.mockResolvedValue({
        id: 'bill-1', billNo: 'IN202606110001',
        items: [{ id: 'bi-1', partId: 'p-1', quantity: 10, unitPrice: 50, amount: 500 }],
      });
      prisma.stockBalance.upsert.mockResolvedValue({ quantity: 10 });

      const result = await service.stockIn(
        {
          shopId: 'shop-1',
          items: [{ partId: 'p-1', quantity: 10, unitPrice: 50 }],
        },
        mockUser,
      );

      expect(result.billNo).toMatch(/^IN\d{8}\d{4}$/);
      expect(prisma.stockMovement.create).toHaveBeenCalled();
    });

    it('未找到默认仓库：抛出 NotFoundException', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);
      await expect(
        service.stockIn({ shopId: 'shop-1', items: [{ partId: 'p-1', quantity: 10, unitPrice: 50 }] }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deductForWorkOrder（工单施工扣库存）', () => {
    it('正常扣减：库存减少 + 流水记录', async () => {
      prisma.stockBill.findFirst.mockResolvedValue(null);
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', shopId: 'shop-1',
        items: [{ id: 'item-1', itemType: 'part', partId: 'p-1', quantity: 2, unitPrice: 50, amount: 100 }],
      });
      prisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      prisma.sequence.upsert.mockResolvedValue({ value: 1 });
      prisma.stockBill.create.mockResolvedValue({
        id: 'bill-1', items: [{ id: 'bi-1', partId: 'p-1', quantity: 2, unitPrice: 50, amount: 100 }],
      });
      prisma.stockBalance.findFirst.mockResolvedValue({ id: 'sb-1', quantity: 10 });
      prisma.stockBalance.update.mockResolvedValue({ quantity: 8 });

      const mockTx = {
        workOrder: prisma.workOrder,
        warehouse: prisma.warehouse,
        stockBill: prisma.stockBill,
        stockBalance: prisma.stockBalance,
        stockMovement: prisma.stockMovement,
        sequence: prisma.sequence,
      };

      await service.deductForWorkOrder(mockTx as any, 'tenant-1', 'shop-1', 'wo-1', 'user-1');

      expect(prisma.stockBalance.update).toHaveBeenCalled();
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ movementType: 'out', quantity: -2 }),
        }),
      );
    });

    it('防重复扣减：已存在出库单则跳过', async () => {
      prisma.stockBill.findFirst.mockResolvedValue({ id: 'existing-bill' });

      const mockTx = { stockBill: prisma.stockBill, workOrder: prisma.workOrder };
      await service.deductForWorkOrder(mockTx as any, 'tenant-1', 'shop-1', 'wo-1', 'user-1');

      expect(prisma.workOrder.findFirst).not.toHaveBeenCalled();
    });

    it('工单无配件项目：不触发库存操作', async () => {
      prisma.stockBill.findFirst.mockResolvedValue(null);
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', shopId: 'shop-1',
        items: [{ id: 'item-1', itemType: 'service', partId: null }],
      });

      const mockTx = { stockBill: prisma.stockBill, workOrder: prisma.workOrder };
      await service.deductForWorkOrder(mockTx as any, 'tenant-1', 'shop-1', 'wo-1', 'user-1');

      expect(prisma.stockBill.create).not.toHaveBeenCalled();
    });

    it('库存不足时仍然扣减（负库存），remark 标注', async () => {
      prisma.stockBill.findFirst.mockResolvedValue(null);
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', shopId: 'shop-1',
        items: [{ id: 'item-1', itemType: 'part', partId: 'p-1', quantity: 10, unitPrice: 50, amount: 500 }],
      });
      prisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      prisma.sequence.upsert.mockResolvedValue({ value: 2 });
      prisma.stockBill.create.mockResolvedValue({
        id: 'bill-2', items: [{ id: 'bi-2', partId: 'p-1', quantity: 10, unitPrice: 50, amount: 500 }],
      });
      prisma.stockBalance.findFirst.mockResolvedValue(null);
      prisma.stockBalance.create.mockResolvedValue({ quantity: -10 });

      const mockTx = {
        workOrder: prisma.workOrder,
        warehouse: prisma.warehouse,
        stockBill: prisma.stockBill,
        stockBalance: prisma.stockBalance,
        stockMovement: prisma.stockMovement,
        sequence: prisma.sequence,
      };

      await service.deductForWorkOrder(mockTx as any, 'tenant-1', 'shop-1', 'wo-1', 'user-1');

      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ remark: '库存不足' }),
        }),
      );
    });
  });

  describe('getBalances（库存余额查询）', () => {
    it('返回库存余额列表', async () => {
      prisma.stockBalance.findMany.mockResolvedValue([]);
      const result = await service.getBalances(mockUser, {});
      expect(result).toEqual([]);
    });
  });

  describe('getMovements（流水查询）', () => {
    it('分页返回流水', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);
      const result = await service.getMovements(mockUser, { page: 1, pageSize: 20 });
      expect(result.page).toBe(1);
    });
  });

  describe('getBills（单据查询）', () => {
    it('分页返回单据', async () => {
      prisma.stockBill.findMany.mockResolvedValue([]);
      prisma.stockBill.count.mockResolvedValue(0);
      const result = await service.getBills(mockUser, { page: 1, pageSize: 20 });
      expect(result.page).toBe(1);
    });
  });
});
