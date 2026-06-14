import { Test, TestingModule } from '@nestjs/testing';
import { MarketingService } from './marketing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '@car/shared';

describe('MarketingService', () => {
  let service: MarketingService;
  let prisma: Record<string, any>;

  const mockUser: JwtPayload = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    shopId: null,
    isPlatform: false,
    roles: ['tenant_admin'],
    permissions: [],
    audience: 'employee',
  };

  beforeEach(async () => {
    prisma = {
      payment: {
        groupBy: jest.fn(),
      },
      workOrder: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      customer: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      appointment: {
        findMany: jest.fn(),
      },
      notification: {
        count: jest.fn(),
        createMany: jest.fn(),
        updateMany: jest.fn(),
      },
      coupon: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      couponClaim: {
        findMany: jest.fn(),
        createMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(MarketingService);
  });

  describe('previewSegment', () => {
    it('should return total customer count when no filters', async () => {
      prisma.customer.count.mockResolvedValue(100);

      const result = await service.previewSegment(mockUser, {});
      expect(result.count).toBe(100);
    });

    it('should filter by inactive days', async () => {
      prisma.workOrder.findMany.mockResolvedValue([
        { customerId: 'c1' },
        { customerId: 'c2' },
      ]);
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' },
      ]);

      const result = await service.previewSegment(mockUser, { inactiveDays: 30 });
      expect(result.count).toBe(2); // c3, c4 were inactive
    });

    it('should filter by min order count', async () => {
      prisma.workOrder.groupBy.mockResolvedValue([
        { customerId: 'c1', _count: { id: 5 } },
        { customerId: 'c2', _count: { id: 3 } },
      ]);

      const result = await service.previewSegment(mockUser, { minOrderCount: 3 });
      expect(result.count).toBe(2);
    });
  });

  describe('createCampaign', () => {
    it('should throw if no target customers', async () => {
      await expect(
        service.createCampaign(mockUser, { name: '测试活动' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if daily limit exceeded', async () => {
      prisma.notification.count.mockResolvedValue(500);

      await expect(
        service.createCampaign(mockUser, {
          name: '测试活动',
          content: '促销内容',
          customerIds: ['c1'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create campaign and send notifications', async () => {
      prisma.notification.count.mockResolvedValue(0);
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', phone: '13800138000', name: '张三' },
      ]);
      prisma.notification.createMany.mockResolvedValue({ count: 1 });

      const result = await service.createCampaign(mockUser, {
        name: '促销活动',
        content: '尊敬的{name}客户，优惠大放送！',
        customerIds: ['c1'],
      });

      expect(result.name).toBe('促销活动');
      expect(result.targetCount).toBe(1);
    });
  });

  describe('createCoupon', () => {
    it('should create coupon with correct fields', async () => {
      prisma.coupon.create.mockResolvedValue({
        id: 'coupon-1',
        name: '满100减20',
        type: 'full_reduction',
        discountValue: 20,
        conditionAmount: 100,
      });

      const result = await service.createCoupon(mockUser, {
        name: '满100减20',
        type: 'full_reduction',
        discountValue: 20,
        conditionAmount: 100,
        validDays: 30,
      });

      expect(result.name).toBe('满100减20');
      expect(prisma.coupon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            name: '满100减20',
          }),
        }),
      );
    });
  });

  describe('distributeCoupon', () => {
    it('should throw if coupon not found', async () => {
      prisma.coupon.findFirst.mockResolvedValue(null);

      await expect(
        service.distributeCoupon(mockUser, 'nonexistent', { customerIds: ['c1'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if coupon inactive', async () => {
      prisma.coupon.findFirst.mockResolvedValue({ id: 'c1', status: 'inactive' });

      await expect(
        service.distributeCoupon(mockUser, 'c1', { customerIds: ['c1'] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if all customers already claimed', async () => {
      prisma.coupon.findFirst.mockResolvedValue({ id: 'c1', status: 'active', totalQuantity: 0, issuedQuantity: 0, validDays: 30 });
      prisma.couponClaim.findMany.mockResolvedValue([{ customerId: 'cust1' }]);

      await expect(
        service.distributeCoupon(mockUser, 'c1', { customerIds: ['cust1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should distribute coupons successfully', async () => {
      prisma.coupon.findFirst.mockResolvedValue({ id: 'c1', status: 'active', totalQuantity: 100, issuedQuantity: 5, validDays: 30 });
      prisma.couponClaim.findMany.mockResolvedValue([]);
      prisma.couponClaim.createMany.mockResolvedValue({ count: 2 });
      prisma.coupon.update.mockResolvedValue({});

      const result = await service.distributeCoupon(mockUser, 'c1', { customerIds: ['cust1', 'cust2'] });

      expect(result.distributed).toBe(2);
      expect(result.skipped).toBe(0);
    });
  });

  describe('validateAndRedeemCoupon', () => {
    it('should throw if coupon claim not found', async () => {
      const mockTx = {
        couponClaim: { findFirst: jest.fn().mockResolvedValue(null) },
        coupon: { update: jest.fn() },
      };

      await expect(
        service.validateAndRedeemCoupon(mockTx, 'tenant-1', 'nonexistent', 100),
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate discount for full_reduction', async () => {
      const mockTx = {
        couponClaim: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'claim-1',
            coupon: { id: 'c1', type: 'full_reduction', discountValue: 20, conditionAmount: 100 },
            expiredAt: new Date(Date.now() + 86400000), // tomorrow
          }),
          update: jest.fn(),
        },
        coupon: { update: jest.fn() },
      };

      const result = await service.validateAndRedeemCoupon(mockTx, 'tenant-1', 'claim-1', 150);

      expect(result.discountAmount).toBe(20);
    });

    it('should calculate discount for discount type', async () => {
      const mockTx = {
        couponClaim: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'claim-1',
            coupon: { id: 'c1', type: 'discount', discountValue: 0.85, conditionAmount: 0 },
            expiredAt: new Date(Date.now() + 86400000),
          }),
          update: jest.fn(),
        },
        coupon: { update: jest.fn() },
      };

      const result = await service.validateAndRedeemCoupon(mockTx, 'tenant-1', 'claim-1', 100);

      expect(result.discountAmount).toBe(15); // 100 * 0.15 = 15
    });

    it('should throw if condition not met for full_reduction', async () => {
      const mockTx = {
        couponClaim: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'claim-1',
            coupon: { id: 'c1', type: 'full_reduction', discountValue: 20, conditionAmount: 200 },
            expiredAt: new Date(Date.now() + 86400000),
          }),
          update: jest.fn(),
        },
        coupon: { update: jest.fn() },
      };

      await expect(
        service.validateAndRedeemCoupon(mockTx, 'tenant-1', 'claim-1', 100),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
