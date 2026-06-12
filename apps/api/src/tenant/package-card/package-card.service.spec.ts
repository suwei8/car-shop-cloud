import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PackageCardService } from './package-card.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

describe('PackageCardService', () => {
  let service: PackageCardService;
  let prisma: Record<string, any>;

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
      packageCard: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      packageCardItem: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      packageCardTransaction: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      workOrder: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn({
        packageCard: prisma.packageCard,
        packageCardItem: prisma.packageCardItem,
        packageCardTransaction: prisma.packageCardTransaction,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackageCardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PackageCardService);
  });

  describe('create（售卡）', () => {
    it('创建套餐卡 + 项目', async () => {
      prisma.packageCard.findFirst.mockResolvedValue(null);
      prisma.packageCard.create.mockResolvedValue({
        id: 'pc-1', cardNo: 'PKG001', name: '保养套餐', items: [
          { id: 'pci-1', totalQty: 4, remainQty: 4 },
        ],
      });

      const result = await service.create(
        {
          cardNo: 'PKG001', customerId: 'cust-1', name: '保养套餐',
          startAt: '2026-01-01', endAt: '2026-12-31',
          items: [{ serviceItemId: 'svc-1', totalQty: 4 }],
        },
        mockUser,
      );

      expect(result.cardNo).toBe('PKG001');
      expect(result.items).toHaveLength(1);
    });

    it('卡号重复：抛出 ConflictException', async () => {
      prisma.packageCard.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create(
          { cardNo: 'PKG001', customerId: 'cust-1', name: '套餐', startAt: '2026-01-01', endAt: '2026-12-31', items: [] },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('consume（核销）', () => {
    it('正常核销：剩余次数扣减', async () => {
      const now = new Date();
      prisma.packageCard.findFirst.mockResolvedValue({
        id: 'pc-1', status: 'active', startAt: new Date('2026-01-01'), endAt: new Date('2027-01-01'),
        vehicleId: null, shopIds: null,
        items: [{ id: 'pci-1', serviceItemId: 'svc-1', remainQty: 4 }],
      });
      prisma.workOrder.findFirst.mockResolvedValue({ id: 'wo-1', vehicleId: 'v-1', shopId: 'shop-1' });
      prisma.packageCardItem.update.mockResolvedValue({ remainQty: 3 });

      const result = await service.consume(
        'pc-1',
        { serviceItemId: 'svc-1', quantity: 1, relatedType: 'work-order', relatedId: 'wo-1' },
        mockUser,
      );

      expect(result.remainQty).toBe(3);
      expect(prisma.packageCardTransaction.create).toHaveBeenCalled();
    });

    it('套餐卡过期：抛出 ForbiddenException', async () => {
      prisma.packageCard.findFirst.mockResolvedValue({
        id: 'pc-1', status: 'active', startAt: new Date('2025-01-01'), endAt: new Date('2025-12-31'),
        vehicleId: null, shopIds: null,
        items: [{ id: 'pci-1', serviceItemId: 'svc-1', remainQty: 4 }],
      });

      await expect(
        service.consume(
          'pc-1',
          { serviceItemId: 'svc-1', quantity: 1, relatedType: 'work-order', relatedId: 'wo-1' },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('剩余次数不足：抛出 ForbiddenException', async () => {
      const now = new Date();
      prisma.packageCard.findFirst.mockResolvedValue({
        id: 'pc-1', status: 'active', startAt: new Date('2026-01-01'), endAt: new Date('2027-01-01'),
        vehicleId: null, shopIds: null,
        items: [{ id: 'pci-1', serviceItemId: 'svc-1', remainQty: 1 }],
      });
      prisma.workOrder.findFirst.mockResolvedValue({ id: 'wo-1', vehicleId: 'v-1', shopId: 'shop-1' });

      await expect(
        service.consume(
          'pc-1',
          { serviceItemId: 'svc-1', quantity: 3, relatedType: 'work-order', relatedId: 'wo-1' },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('套餐中不包含此服务项目：抛出 NotFoundException', async () => {
      const now = new Date();
      prisma.packageCard.findFirst.mockResolvedValue({
        id: 'pc-1', status: 'active', startAt: new Date('2026-01-01'), endAt: new Date('2027-01-01'),
        vehicleId: null, shopIds: null,
        items: [{ id: 'pci-1', serviceItemId: 'svc-1', remainQty: 4 }],
      });
      prisma.workOrder.findFirst.mockResolvedValue({ id: 'wo-1', vehicleId: 'v-1', shopId: 'shop-1' });

      await expect(
        service.consume(
          'pc-1',
          { serviceItemId: 'svc-999', quantity: 1, relatedType: 'work-order', relatedId: 'wo-1' },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('非适用车辆：抛出 ForbiddenException', async () => {
      const now = new Date();
      prisma.packageCard.findFirst.mockResolvedValue({
        id: 'pc-1', status: 'active', startAt: new Date('2026-01-01'), endAt: new Date('2027-01-01'),
        vehicleId: 'v-1', shopIds: null,
        items: [{ id: 'pci-1', serviceItemId: 'svc-1', remainQty: 4 }],
      });
      prisma.workOrder.findFirst.mockResolvedValue({ id: 'wo-1', vehicleId: 'v-2', shopId: 'shop-1' });

      await expect(
        service.consume(
          'pc-1',
          { serviceItemId: 'svc-1', quantity: 1, relatedType: 'work-order', relatedId: 'wo-1' },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('非适用门店：抛出 ForbiddenException', async () => {
      const now = new Date();
      prisma.packageCard.findFirst.mockResolvedValue({
        id: 'pc-1', status: 'active', startAt: new Date('2026-01-01'), endAt: new Date('2027-01-01'),
        vehicleId: null, shopIds: JSON.stringify(['shop-2']),
        items: [{ id: 'pci-1', serviceItemId: 'svc-1', remainQty: 4 }],
      });
      prisma.workOrder.findFirst.mockResolvedValue({ id: 'wo-1', vehicleId: 'v-1', shopId: 'shop-1' });

      await expect(
        service.consume(
          'pc-1',
          { serviceItemId: 'svc-1', quantity: 1, relatedType: 'work-order', relatedId: 'wo-1' },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('卡状态异常（非 active）：抛出 ForbiddenException', async () => {
      prisma.packageCard.findFirst.mockResolvedValue({
        id: 'pc-1', status: 'cancelled', startAt: new Date('2026-01-01'), endAt: new Date('2027-01-01'),
        vehicleId: null, shopIds: null,
        items: [{ id: 'pci-1', serviceItemId: 'svc-1', remainQty: 4 }],
      });

      await expect(
        service.consume(
          'pc-1',
          { serviceItemId: 'svc-1', quantity: 1, relatedType: 'work-order', relatedId: 'wo-1' },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('套餐卡不存在：抛出 NotFoundException', async () => {
      prisma.packageCard.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTransactions', () => {
    it('流水查询：分页正确', async () => {
      prisma.packageCardTransaction.findMany.mockResolvedValue([]);
      prisma.packageCardTransaction.count.mockResolvedValue(0);

      const result = await service.getTransactions(mockUser, { page: 1, pageSize: 10 });

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });
  });
});
