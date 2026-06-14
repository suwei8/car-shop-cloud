import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkOrderService } from './work-order.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { NotificationService } from '../../notification/notification.service';
import { FeatureFlagService } from '../../platform/feature-flag/feature-flag.service';
import { JwtPayload } from '@car/shared';

describe('WorkOrderService', () => {
  let service: WorkOrderService;
  let prisma: Record<string, any>;
  let stockService: Record<string, any>;
  let featureFlagService: Record<string, any>;

  const mockUser: JwtPayload = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    shopId: 'shop-1',
    isPlatform: false,
    roles: ['tenant_admin'],
    permissions: [],
  };

  beforeEach(async () => {
    prisma = {
      workOrder: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      workOrderItem: {
        createMany: jest.fn(),
        update: jest.fn(),
      },
      vehicle: {
        findFirst: jest.fn(),
      },
      sequence: {
        upsert: jest.fn(),
      },
      part: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn({
        workOrder: prisma.workOrder,
        workOrderItem: prisma.workOrderItem,
        sequence: prisma.sequence,
        part: prisma.part,
      })),
    };

    stockService = {
      deductForWorkOrder: jest.fn(),
      reverseDeductForWorkOrder: jest.fn(),
    };

    const notificationService = { send: jest.fn(), skip: jest.fn(), checkDuplicate: jest.fn().mockResolvedValue(false) };

    featureFlagService = { isFlagEnabled: jest.fn().mockResolvedValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrderService,
        { provide: PrismaService, useValue: prisma },
        { provide: StockService, useValue: stockService },
        { provide: NotificationService, useValue: notificationService },
        { provide: FeatureFlagService, useValue: featureFlagService },
      ],
    }).compile();

    service = module.get(WorkOrderService);
  });

  describe('create（创建工单）', () => {
    it('orderNo 正确生成，金额正确计算', async () => {
      prisma.vehicle.findFirst.mockResolvedValue({ id: 'v-1', plateNo: '京A12345' });
      prisma.sequence.upsert.mockResolvedValue({ value: 1 });
      prisma.workOrder.create.mockResolvedValue({
        id: 'wo-1', orderNo: 'WO202606110001', totalAmount: 300, payableAmount: 300,
      });

      const result = await service.create(
        {
          shopId: 'shop-1',
          orderType: 'repair',
          customerId: 'cust-1',
          vehicleId: 'v-1',
          items: [
            { itemType: 'service', name: '机油更换', quantity: 1, unitPrice: 200 },
            { itemType: 'part', name: '机油滤芯', serviceItemId: 'p-1', quantity: 2, unitPrice: 50 },
          ],
        },
        mockUser,
      );

      expect(result.totalAmount).toBe(300);
      expect(result.orderNo).toMatch(/^WO\d{8}\d{4}$/);
    });

    it('车辆不存在：抛出 NotFoundException', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(null);
      await expect(
        service.create(
          { shopId: 'shop-1', orderType: 'repair', customerId: 'cust-1', vehicleId: 'nonexistent' },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('无项目时金额为 0', async () => {
      prisma.vehicle.findFirst.mockResolvedValue({ id: 'v-1', plateNo: '京A12345' });
      prisma.sequence.upsert.mockResolvedValue({ value: 2 });
      prisma.workOrder.create.mockResolvedValue({
        id: 'wo-2', totalAmount: 0, payableAmount: 0,
      });

      const result = await service.create(
        { shopId: 'shop-1', orderType: 'quick', customerId: 'cust-1', vehicleId: 'v-1' },
        mockUser,
      );

      expect(result.totalAmount).toBe(0);
    });
  });

  describe('addItems（添加项目）', () => {
    it('总金额正确增加', async () => {
      prisma.workOrder.findFirst
        .mockResolvedValueOnce({ id: 'wo-1', tenantId: 'tenant-1', totalAmount: 200, payableAmount: 200 })
        .mockResolvedValueOnce({ id: 'wo-1', totalAmount: 500, payableAmount: 500 });

      const result = await service.addItems(
        'wo-1',
        [{ itemType: 'service', name: '补漆', quantity: 1, unitPrice: 300 }],
        mockUser,
      );

      expect(prisma.workOrderItem.createMany).toHaveBeenCalled();
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totalAmount: { increment: 300 } }),
        }),
      );
    });
  });

  describe('updateStatus（状态更新）', () => {
    it('通过状态机校验', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'draft', shopId: 'shop-1', items: [],
      });
      prisma.workOrder.update.mockResolvedValue({ id: 'wo-1', status: 'confirmed' });

      const result = await service.updateStatus('wo-1', 'confirmed', mockUser);
      expect(result.status).toBe('confirmed');
    });

    it('非法状态跳转：抛出异常', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'draft', shopId: 'shop-1', items: [],
      });

      await expect(service.updateStatus('wo-1', 'settled', mockUser)).rejects.toThrow();
    });

    it('变为 in_progress 时触发库存扣减', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'dispatching', shopId: 'shop-1', items: [],
      });
      prisma.workOrder.update.mockResolvedValue({ id: 'wo-1', status: 'in_progress' });

      await service.updateStatus('wo-1', 'in_progress', mockUser);

      expect(stockService.deductForWorkOrder).toHaveBeenCalledWith(
        expect.anything(), 'tenant-1', 'shop-1', 'wo-1', 'user-1',
      );
    });
  });

  describe('updateStatus - 简易模式', () => {
    it('confirmed → completed：合法，且触发库存扣减', async () => {
      featureFlagService.isFlagEnabled.mockResolvedValue(true);
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'confirmed', shopId: 'shop-1', items: [],
      });
      prisma.workOrder.update.mockResolvedValue({ id: 'wo-1', status: 'completed' });

      await service.updateStatus('wo-1', 'completed', mockUser);

      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'completed' } }),
      );
      expect(stockService.deductForWorkOrder).toHaveBeenCalledWith(
        expect.anything(), 'tenant-1', 'shop-1', 'wo-1', 'user-1',
      );
    });

    it('confirmed → completed：普通模式下非法', async () => {
      featureFlagService.isFlagEnabled.mockResolvedValue(false);
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'confirmed', shopId: 'shop-1', items: [],
      });

      await expect(service.updateStatus('wo-1', 'completed', mockUser)).rejects.toThrow();
    });

    it('in_progress → completed：普通模式下不重复扣库存', async () => {
      featureFlagService.isFlagEnabled.mockResolvedValue(false);
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'in_progress', shopId: 'shop-1', items: [],
      });
      prisma.workOrder.update.mockResolvedValue({ id: 'wo-1', status: 'completed' });

      await service.updateStatus('wo-1', 'completed', mockUser);

      // in_progress → completed 不应再次扣库存（已在 in_progress 时扣过）
      expect(stockService.deductForWorkOrder).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus - 作废回滚库存', () => {
    it('in_progress → cancelled：触发库存回滚', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'in_progress', shopId: 'shop-1', items: [],
      });
      prisma.workOrder.update.mockResolvedValue({ id: 'wo-1', status: 'cancelled' });

      await service.updateStatus('wo-1', 'cancelled', mockUser);

      expect(stockService.reverseDeductForWorkOrder).toHaveBeenCalledWith(
        expect.anything(), 'tenant-1', 'shop-1', 'wo-1', 'user-1',
      );
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'cancelled' } }),
      );
    });

    it('draft → cancelled：也触发库存回滚（幂等，无出库单则跳过）', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'draft', shopId: 'shop-1', items: [],
      });
      prisma.workOrder.update.mockResolvedValue({ id: 'wo-1', status: 'cancelled' });

      await service.updateStatus('wo-1', 'cancelled', mockUser);

      expect(stockService.reverseDeductForWorkOrder).toHaveBeenCalled();
    });

    it('completed → cancelled：触发库存回滚', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'completed', shopId: 'shop-1', items: [],
      });
      prisma.workOrder.update.mockResolvedValue({ id: 'wo-1', status: 'cancelled' });

      await service.updateStatus('wo-1', 'cancelled', mockUser);

      expect(stockService.reverseDeductForWorkOrder).toHaveBeenCalled();
    });
  });

  describe('updateStatus - 质保快照', () => {
    it('in_progress 时写入配件质保快照', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'dispatching', shopId: 'shop-1',
        items: [
          { id: 'item-1', itemType: 'part', partId: 'p-1' },
          { id: 'item-2', itemType: 'service', partId: null },
        ],
      });
      prisma.part.findMany.mockResolvedValue([
        { id: 'p-1', supplierId: 's-1', warrantyMonths: 12 },
      ]);
      prisma.workOrderItem.update.mockResolvedValue({});
      prisma.workOrder.update.mockResolvedValue({ id: 'wo-1', status: 'in_progress' });

      await service.updateStatus('wo-1', 'in_progress', mockUser);

      expect(prisma.workOrderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({
            supplierId: 's-1',
            warrantyMonths: 12,
            warrantyUntil: expect.any(Date),
          }),
        }),
      );
      // 服务项不写快照
      expect(prisma.workOrderItem.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('工单不存在：抛出 NotFoundException', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll（列表查询）', () => {
    it('分页和租户隔离', async () => {
      prisma.workOrder.findMany.mockResolvedValue([]);
      prisma.workOrder.count.mockResolvedValue(0);

      const result = await service.findAll(mockUser, { page: 1, pageSize: 10 });

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1' }),
          skip: 0,
          take: 10,
        }),
      );
    });
  });
});
