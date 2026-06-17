import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentProvider } from './providers/payment-provider.interface';

const mockPrisma = {
  payment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  settlement: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  workOrder: {
    update: jest.fn(),
  },
  paymentRefund: {
    create: jest.fn(),
    update: jest.fn(),
  },
  sequence: {
    upsert: jest.fn(),
  },
};

const mockAuditService = { log: jest.fn() };
const mockConfig = { get: jest.fn() };

function createMockProvider(overrides?: Partial<PaymentProvider>): PaymentProvider {
  return {
    method: 'wechat' as const,
    createOrder: jest.fn().mockResolvedValue({ codeUrl: 'https://mock-pay.example.com/qr/test' }),
    queryOrder: jest.fn().mockResolvedValue({ status: 'pending' }),
    refund: jest.fn().mockResolvedValue({ outRefundNo: 'RF001', status: 'success' }),
    verifyCallback: jest.fn().mockResolvedValue({ verified: true, outTradeNo: 'pay-1', transactionId: 'tx-1', amount: 100 }),
    ...overrides,
  } as PaymentProvider;
}

function createService(providers: PaymentProvider[] = []) {
  return new PaymentGatewayService(
    mockPrisma as any,
    mockConfig as any,
    mockAuditService as any,
    providers.length > 0 ? providers : [createMockProvider()],
    { get: jest.fn() } as any,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MockPayProvider', () => {
  it('createOrder returns codeUrl', async () => {
    const provider = createMockProvider();
    const result = await provider.createOrder({
      outTradeNo: 'test-1',
      amount: 1000,
      description: 'test',
      notifyUrl: '',
    });
    expect(result.codeUrl).toContain('mock-pay.example.com');
  });

  it('refund returns success', async () => {
    const provider = createMockProvider();
    const result = await provider.refund({
      transactionId: 'tx-1',
      outRefundNo: 'RF001',
      totalAmount: 1000,
      refundAmount: 500,
    });
    expect(result.status).toBe('success');
  });

  it('verifyCallback returns verified=true', async () => {
    const provider = createMockProvider();
    const result = await provider.verifyCallback({}, JSON.stringify({ outTradeNo: 'test-1' }));
    expect(result.verified).toBe(true);
  });
});

describe('PaymentGatewayService', () => {
  describe('createPaymentOrder', () => {
    it('creates order and updates payment status to pending', async () => {
      const mockProvider = createMockProvider();
      const service = createService([mockProvider]);

      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        amount: 10.00,
        status: 'pending',
        payMethod: 'mock',
        tenantId: 't1',
      });
      mockPrisma.payment.update.mockResolvedValue({});

      const result = await service.createPaymentOrder('pay-1', 'wechat', 't1');

      expect(result.codeUrl).toBeDefined();
      expect(mockPrisma.payment.findFirst).toHaveBeenCalledWith({ where: { id: 'pay-1', tenantId: 't1' } });
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'pending' }),
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('throws NotFoundException for missing payment', async () => {
      const service = createService();
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.createPaymentOrder('nonexistent', 'wechat', 't1'))
        .rejects.toThrow('支付记录不存在');
    });

    it('throws NotFoundException for cross-tenant payment', async () => {
      const service = createService();
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.createPaymentOrder('pay-1', 'wechat', 'wrong-tenant'))
        .rejects.toThrow('支付记录不存在');
    });
  });

  describe('handleCallback', () => {
    it('updates payment status to paid on successful callback', async () => {
      const mockProvider = createMockProvider({ method: 'mock' as const });
      const service = createService([mockProvider]);

      mockPrisma.payment.findFirst
        .mockResolvedValueOnce({ id: 'pay-1', status: 'pending', tenantId: 't1', settlementId: 's1' })
        .mockResolvedValueOnce(null);
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.settlement.findUnique.mockResolvedValue({
        id: 's1',
        status: 'pending_payment',
        workOrderId: 'wo-1',
        payments: [{ id: 'pay-1', status: 'paid' }],
      });
      mockPrisma.settlement.update.mockResolvedValue({});
      mockPrisma.workOrder.update.mockResolvedValue({});

      await service.handleCallback('mock', {}, '{}');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'paid' }),
      });
      expect(mockPrisma.settlement.update).toHaveBeenCalled();
    });

    it('is idempotent: skips already-paid payment', async () => {
      const mockProvider = createMockProvider({ method: 'mock' as const });
      const service = createService([mockProvider]);

      mockPrisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', status: 'paid' });

      await service.handleCallback('mock', {}, '{}');

      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException on verify failure', async () => {
      const mockProvider = createMockProvider({ method: 'mock' as const, verifyCallback: jest.fn().mockResolvedValue({ verified: false }) });
      const service = createService([mockProvider]);

      await expect(service.handleCallback('mock', {}, '{}'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('queryPaymentStatus', () => {
    it('returns expired for expired pending payment', async () => {
      const service = createService();
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        status: 'pending',
        expiredAt: new Date(Date.now() - 1000),
        payMethod: 'mock',
      });

      const result = await service.queryPaymentStatus('pay-1', 't1');
      expect(result.status).toBe('expired');
      expect(mockPrisma.payment.findFirst).toHaveBeenCalledWith({ where: { id: 'pay-1', tenantId: 't1' } });
    });

    it('returns current status for paid payment', async () => {
      const service = createService();
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        status: 'paid',
        transactionId: 'tx-1',
        expiredAt: null,
        payMethod: 'mock',
      });

      const result = await service.queryPaymentStatus('pay-1', 't1');
      expect(result.status).toBe('paid');
    });

    it('throws NotFoundException for cross-tenant payment', async () => {
      const service = createService();
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.queryPaymentStatus('pay-1', 'wrong-tenant'))
        .rejects.toThrow('支付记录不存在');
    });
  });

  describe('refund', () => {
    it('creates refund record and updates payment', async () => {
      const mockProvider = createMockProvider();
      const service = createService([mockProvider]);

      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        amount: 100.00,
        refundAmount: 0,
        status: 'paid',
        transactionId: 'tx-1',
        payMethod: 'wechat',
        tenantId: 't1',
      });
      mockPrisma.paymentRefund.create.mockResolvedValue({ id: 'refund-1' });
      mockPrisma.paymentRefund.update.mockResolvedValue({});
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.sequence.upsert.mockResolvedValue({ value: 1 });

      const result = await service.refund('pay-1', 50, '测试退款', 'user-1', 't1');

      expect(result.id).toBe('refund-1');
      expect(mockPrisma.payment.findFirst).toHaveBeenCalledWith({ where: { id: 'pay-1', tenantId: 't1' } });
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ refundAmount: 50 }),
      });
    });

    it('throws BadRequestException when refund exceeds max', async () => {
      const service = createService();

      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        amount: 100.00,
        refundAmount: 80,
        status: 'paid',
        transactionId: 'tx-1',
        payMethod: 'wechat',
        tenantId: 't1',
      });

      await expect(service.refund('pay-1', 30, '超额退款', 'user-1', 't1'))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for non-paid payment', async () => {
      const service = createService();

      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        amount: 100.00,
        refundAmount: 0,
        status: 'pending',
        transactionId: null,
        payMethod: 'wechat',
        tenantId: 't1',
      });

      await expect(service.refund('pay-1', 50, '退款', 'user-1', 't1'))
        .rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for cross-tenant payment', async () => {
      const service = createService();
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.refund('pay-1', 50, '退款', 'user-1', 'wrong-tenant'))
        .rejects.toThrow('支付记录不存在');
    });
  });
});
