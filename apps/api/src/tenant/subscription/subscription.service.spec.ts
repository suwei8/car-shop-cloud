import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

const mockPrisma: Record<string, any> = {
  subscriptionPlan: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  subscriptionOrder: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  tenantSubscription: {
    create: jest.fn(),
  },
  payment: {
    create: jest.fn(),
  },
  sequence: {
    upsert: jest.fn(),
  },
  $transaction: jest.fn(async (fn: any) => fn(mockPrisma)),
};

const mockAuditService = { log: jest.fn() };
const mockPaymentGatewayService = {
  createPaymentOrder: jest.fn().mockResolvedValue({ codeUrl: 'https://mock.example.com/qr/test' }),
};

function createService() {
  return new SubscriptionService(
    mockPrisma as any,
    mockAuditService as any,
    mockPaymentGatewayService as any,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SubscriptionService', () => {
  describe('getPlans', () => {
    it('should return active plans with discount info', async () => {
      const service = createService();
      mockPrisma.subscriptionPlan.findMany.mockResolvedValue([
        {
          id: 'plan-1',
          name: '专业版',
          priceYearly: 3600,
          priceMonthly: 300,
          discount3m: 0.95,
          discount6m: 0.90,
          discount12m: 0.80,
          maxShops: 3,
          maxEmployees: 20,
          features: null,
          status: 'active',
        },
      ]);

      const result = await service.getPlans();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('专业版');
      expect(result[0].discounts['6'].price).toBe('1620.00');
      expect(result[0].discounts['12'].price).toBe('2880.00');
    });
  });

  describe('createOrder', () => {
    it('should create order with correct amount calculation', async () => {
      const service = createService();
      const user = { tenantId: 't1', sub: 'u1' } as any;

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-1',
        name: '专业版',
        priceYearly: 3600,
        priceMonthly: 300,
        discount3m: 0.95,
        discount6m: 0.90,
        discount12m: 0.80,
        status: 'active',
      });
      mockPrisma.subscriptionOrder.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.sequence.upsert.mockResolvedValue({ value: 1 });
      mockPrisma.subscriptionOrder.create.mockResolvedValue({
        id: 'order-1',
        orderNo: 'SUB202606130001',
        amount: 1620,
        status: 'pending',
      });

      const result = await service.createOrder(user, {
        planId: 'plan-1',
        months: 6,
        paymentMethod: 'wechat',
      });

      expect(result.orderNo).toBe('SUB202606130001');
      expect(result.amount).toBe('1620');
      expect(mockPrisma.subscriptionOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            months: 6,
            discountRate: 0.9,
            amount: 1620,
          }),
        }),
      );
    });

    it('should throw NotFoundException for invalid plan', async () => {
      const service = createService();
      const user = { tenantId: 't1', sub: 'u1' } as any;

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder(user, {
          planId: 'invalid',
          months: 6,
          paymentMethod: 'wechat',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should cancel existing pending orders before creating new one', async () => {
      const service = createService();
      const user = { tenantId: 't1', sub: 'u1' } as any;

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-1',
        name: '专业版',
        priceYearly: 3600,
        priceMonthly: 300,
        discount3m: 0.95,
        discount6m: 0.90,
        discount12m: 0.80,
        status: 'active',
      });
      mockPrisma.subscriptionOrder.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.sequence.upsert.mockResolvedValue({ value: 2 });
      mockPrisma.subscriptionOrder.create.mockResolvedValue({
        id: 'order-2',
        orderNo: 'SUB202606130002',
        amount: 855,
        status: 'pending',
      });

      const result = await service.createOrder(user, {
        planId: 'plan-1',
        months: 3,
        paymentMethod: 'alipay',
      });

      expect(mockPrisma.subscriptionOrder.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 't1', status: 'pending' },
        data: { status: 'cancelled', cancelledAt: expect.any(Date) },
      });
      expect(result.amount).toBe('855');
    });

    it('should handle 12-month order with correct discount', async () => {
      const service = createService();
      const user = { tenantId: 't1', sub: 'u1' } as any;

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-1',
        name: '专业版',
        priceYearly: 3600,
        priceMonthly: 300,
        discount3m: 0.95,
        discount6m: 0.90,
        discount12m: 0.80,
        status: 'active',
      });
      mockPrisma.subscriptionOrder.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.sequence.upsert.mockResolvedValue({ value: 1 });
      mockPrisma.subscriptionOrder.create.mockResolvedValue({
        id: 'order-3',
        orderNo: 'SUB202606130003',
        amount: 2880,
        status: 'pending',
      });

      const result = await service.createOrder(user, {
        planId: 'plan-1',
        months: 12,
        paymentMethod: 'wechat',
      });

      expect(result.amount).toBe('2880');
    });
  });

  describe('payOrder', () => {
    it('should create payment and return codeUrl', async () => {
      const service = createService();
      const user = { tenantId: 't1', sub: 'u1' } as any;

      mockPrisma.subscriptionOrder.findFirst.mockResolvedValue({
        id: 'order-1',
        tenantId: 't1',
        orderNo: 'SUB202606130001',
        amount: 1620,
        status: 'pending',
        plan: { name: '专业版' },
      });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      mockPrisma.subscriptionOrder.update.mockResolvedValue({});

      const result = await service.payOrder(user, 'order-1', {
        paymentMethod: 'wechat',
      });

      expect(result.codeUrl).toBe('https://mock.example.com/qr/test');
      expect(mockPaymentGatewayService.createPaymentOrder).toHaveBeenCalledWith(
        'pay-1',
        'wechat',
        { openid: undefined },
      );
    });

    it('should throw NotFoundException for missing order', async () => {
      const service = createService();
      const user = { tenantId: 't1', sub: 'u1' } as any;

      mockPrisma.subscriptionOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.payOrder(user, 'nonexistent', { paymentMethod: 'wechat' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-pending order', async () => {
      const service = createService();
      const user = { tenantId: 't1', sub: 'u1' } as any;

      mockPrisma.subscriptionOrder.findFirst.mockResolvedValue({
        id: 'order-1',
        tenantId: 't1',
        status: 'paid',
        plan: { name: '专业版' },
      });

      await expect(
        service.payOrder(user, 'order-1', { paymentMethod: 'wechat' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleSubscriptionPaymentCallback', () => {
    it('should activate subscription on payment success', async () => {
      const service = createService();

      mockPrisma.subscriptionOrder.findFirst.mockResolvedValue({
        id: 'order-1',
        tenantId: 't1',
        orderNo: 'SUB202606130001',
        planId: 'plan-1',
        months: 6,
        amount: 1620,
        status: 'pending',
      });
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 't1',
        subscriptionEndAt: null,
      });
      mockPrisma.tenantSubscription.create.mockResolvedValue({});
      mockPrisma.tenant.update.mockResolvedValue({});
      mockPrisma.subscriptionOrder.update.mockResolvedValue({});

      await service.handleSubscriptionPaymentCallback(
        'SUB20260613001',
        'tx-123',
      );

      expect(mockPrisma.subscriptionOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: {
          status: 'paid',
          transactionId: 'tx-123',
          paidAt: expect.any(Date),
        },
      });
      expect(mockPrisma.tenantSubscription.create).toHaveBeenCalled();
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: expect.objectContaining({
          subscriptionStatus: 'active',
        }),
      });
    });

    it('should be idempotent for already paid orders', async () => {
      const service = createService();

      mockPrisma.subscriptionOrder.findFirst.mockResolvedValue({
        id: 'order-1',
        status: 'paid',
      });

      await service.handleSubscriptionPaymentCallback(
        'SUB20260613001',
        'tx-123',
      );

      expect(mockPrisma.subscriptionOrder.update).not.toHaveBeenCalled();
    });

    it('should handle missing order gracefully', async () => {
      const service = createService();

      mockPrisma.subscriptionOrder.findFirst.mockResolvedValue(null);

      // Should not throw
      await service.handleSubscriptionPaymentCallback(
        'SUB_NONEXISTENT',
        'tx-123',
      );

      expect(mockPrisma.subscriptionOrder.update).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentSubscription', () => {
    it('should return subscription info with daysRemaining', async () => {
      const service = createService();
      const user = { tenantId: 't1' } as any;

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 200);

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 't1',
        subscriptionStatus: 'active',
        subscriptions: [
          {
            startAt: new Date(),
            endAt: futureDate,
            plan: {
              name: '专业版',
              maxShops: 3,
              maxEmployees: 20,
            },
          },
        ],
      });

      const result = await service.getCurrentSubscription(user);

      expect(result).not.toBeNull();
      expect(result!.planName).toBe('专业版');
      expect(result!.daysRemaining).toBeGreaterThan(190);
      expect(result!.daysRemaining).toBeLessThanOrEqual(201);
    });

    it('should return null when no active subscription', async () => {
      const service = createService();
      const user = { tenantId: 't1' } as any;

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 't1',
        subscriptionStatus: 'trial',
        subscriptions: [],
      });

      const result = await service.getCurrentSubscription(user);

      expect(result).toBeNull();
    });
  });
});
