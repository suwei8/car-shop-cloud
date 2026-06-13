import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CustomerPortalService } from './customer-portal.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CustomerPortalService（数据隔离与字段白名单）', () => {
  let service: CustomerPortalService;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      workOrder: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      storedValueCard: {
        findMany: jest.fn(),
      },
      packageCard: {
        findMany: jest.fn(),
      },
      customer: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerPortalService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CustomerPortalService);
  });

  describe('数据隔离', () => {
    it('工单列表严格按 customerId + tenantId 过滤', async () => {
      prisma.workOrder.findMany.mockResolvedValue([]);
      prisma.workOrder.count.mockResolvedValue(0);

      await service.getWorkOrders('customer-a', 'tenant-1', {});

      expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: 'customer-a', tenantId: 'tenant-1' },
        }),
      );
    });

    it('A 车主无法查看 B 车主的工单详情', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.getWorkOrderDetail('wo-1', 'customer-a', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.workOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wo-1', customerId: 'customer-a', tenantId: 'tenant-1' },
        }),
      );
    });

    it('储值卡查询严格按 customerId + tenantId 过滤', async () => {
      prisma.storedValueCard.findMany.mockResolvedValue([]);
      prisma.packageCard.findMany.mockResolvedValue([]);

      await service.getCards('customer-a', 'tenant-1');

      expect(prisma.storedValueCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: 'customer-a', tenantId: 'tenant-1', status: 'active' },
        }),
      );
    });
  });

  describe('字段白名单（敏感数据过滤）', () => {
    it('工单详情不包含 remark（内部备注）', async () => {
      const mockOrder = {
        id: 'wo-1',
        orderNo: 'WO20260101001',
        orderType: 'repair',
        vehiclePlateNo: '京A12345',
        vehicleMileage: 50000,
        status: 'completed',
        totalAmount: 500,
        discountAmount: 0,
        payableAmount: 500,
        description: '换机油',
        createdAt: new Date(),
        updatedAt: new Date(),
        expectDate: null,
        vehicle: { plateNo: '京A12345', brand: '丰田', model: '卡罗拉' },
        items: [
          { id: 'item-1', name: '机油', itemType: 'part', quantity: 1, unit: '桶', unitPrice: 300, amount: 300 },
        ],
      };
      prisma.workOrder.findFirst.mockResolvedValue(mockOrder);

      const result = await service.getWorkOrderDetail('wo-1', 'customer-a', 'tenant-1');

      expect(result).not.toHaveProperty('remark');
      expect(result).not.toHaveProperty('advisorId');
    });

    it('工单详情 select 不包含 costPrice、technicianId', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(null);

      await service.getWorkOrderDetail('wo-1', 'customer-a', 'tenant-1').catch(() => {});

      const callArgs = prisma.workOrder.findFirst.mock.calls[0][0];
      const itemSelect = callArgs.select.items.select;

      expect(itemSelect).not.toHaveProperty('costPrice');
      expect(itemSelect).not.toHaveProperty('technicianId');
      expect(itemSelect).not.toHaveProperty('remark');
      expect(itemSelect).not.toHaveProperty('partId');
    });

    it('工单列表 select 不包含 advisorId、remark', async () => {
      prisma.workOrder.findMany.mockResolvedValue([]);
      prisma.workOrder.count.mockResolvedValue(0);

      await service.getWorkOrders('customer-a', 'tenant-1', {});

      const callArgs = prisma.workOrder.findMany.mock.calls[0][0];
      const selectKeys = Object.keys(callArgs.select);

      expect(selectKeys).not.toContain('advisorId');
      expect(selectKeys).not.toContain('remark');
    });

    it('工单详情不暴露技师手机号', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', orderNo: 'WO001', orderType: 'repair',
        vehiclePlateNo: '京A12345', vehicleMileage: null,
        status: 'completed', totalAmount: 100, discountAmount: 0,
        payableAmount: 100, description: '', createdAt: new Date(),
        updatedAt: new Date(), expectDate: null,
        vehicle: { plateNo: '京A12345', brand: '', model: '' },
        items: [],
      });

      const result = await service.getWorkOrderDetail('wo-1', 'customer-a', 'tenant-1');

      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain('technicianId');
      expect(resultStr).not.toContain('phone');
    });
  });
});
