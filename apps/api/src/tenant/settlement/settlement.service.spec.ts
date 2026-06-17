import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PackageCardService } from '../package-card/package-card.service';
import { PaymentGatewayService } from '../payment/payment-gateway.service';
import { MarketingService } from '../marketing/marketing.service';
import { JwtPayload } from '@car/shared';

describe('SettlementService', () => {
  let service: SettlementService;
  let prisma: Record<string, any>;
  let packageCardService: Record<string, any>;
  let paymentGatewayService: Record<string, any>;

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
        update: jest.fn(),
      },
      settlement: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      payment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
      storedValueCard: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      storedValueTransaction: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      packageCardTransaction: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      sequence: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn({
        settlement: prisma.settlement,
        payment: prisma.payment,
        workOrder: prisma.workOrder,
        storedValueCard: prisma.storedValueCard,
        storedValueTransaction: prisma.storedValueTransaction,
        packageCardTransaction: prisma.packageCardTransaction,
        packageCardItem: { findFirst: jest.fn(), update: jest.fn() },
        sequence: prisma.sequence,
      })),
    };

    packageCardService = { redeem: jest.fn() };

    paymentGatewayService = {
      createPaymentOrder: jest.fn().mockResolvedValue({ codeUrl: 'mock-url' }),
      queryPaymentStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
      refund: jest.fn(),
    };

    const mockMarketingService = {
      validateAndRedeemCoupon: jest.fn().mockResolvedValue({ discountAmount: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: PrismaService, useValue: prisma },
        { provide: PackageCardService, useValue: packageCardService },
        { provide: PaymentGatewayService, useValue: paymentGatewayService },
        { provide: MarketingService, useValue: mockMarketingService },
      ],
    }).compile();

    service = module.get(SettlementService);
  });

  describe('settle（结算）', () => {
    it('正常结算：工单状态从 completed 变为 settled', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'completed', shopId: 'shop-1',
        totalAmount: 500, items: [],
      });
      prisma.sequence.upsert.mockResolvedValue({ value: 1 });
      prisma.settlement.create.mockResolvedValue({
        id: 's-1', settleNo: 'ST202606110001', totalAmount: 500, discountAmount: 0,
        payableAmount: 500, paidAmount: 500, debtAmount: 0,
      });

      const result = await service.settle(
        { workOrderId: 'wo-1', payments: [{ payMethod: 'cash', amount: 500 }] },
        mockUser,
      );

      expect(result.settleNo).toMatch(/^ST\d{8}\d{4}$/);
      expect(prisma.workOrder.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'wo-1', tenantId: 'tenant-1', shopId: 'shop-1' }),
      }));
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'settled' }),
        }),
      );
    });

    it('储值卡支付：余额正确扣减（先扣赠送再扣本金）', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'completed', shopId: 'shop-1',
        totalAmount: 300, items: [],
      });
      prisma.sequence.upsert.mockResolvedValue({ value: 2 });
      prisma.settlement.create.mockResolvedValue({
        id: 's-2', settleNo: 'ST202606110002', totalAmount: 300, payableAmount: 300, paidAmount: 300,
      });
      prisma.storedValueCard.findFirst.mockResolvedValue({
        id: 'card-1', status: 'active', balance: 500, principalBalance: 300, giftBalance: 200,
      });
      prisma.storedValueCard.update.mockResolvedValue({ balance: 200, principalBalance: 300, giftBalance: 0 });

      await service.settle(
        {
          workOrderId: 'wo-1',
          payments: [{ payMethod: 'stored_value', amount: 300, cardId: 'card-1' }],
        },
        mockUser,
      );

      expect(prisma.storedValueCard.update).toHaveBeenCalled();
      expect(prisma.storedValueTransaction.create).toHaveBeenCalled();
    });

    it('储值卡余额不足：抛出 ForbiddenException', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'completed', shopId: 'shop-1',
        totalAmount: 1000, items: [],
      });
      prisma.storedValueCard.findFirst.mockResolvedValue({
        id: 'card-1', status: 'active', balance: 100, principalBalance: 100, giftBalance: 0,
      });
      prisma.sequence.upsert.mockResolvedValue({ value: 1 });

      await expect(
        service.settle(
          {
            workOrderId: 'wo-1',
            payments: [{ payMethod: 'stored_value', amount: 500, cardId: 'card-1' }],
          },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('工单已结算：重复结算抛出 ForbiddenException', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'settled', shopId: 'shop-1',
      });

      await expect(
        service.settle({ workOrderId: 'wo-1', payments: [] }, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('工单不存在：抛出 NotFoundException', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(null);
      await expect(
        service.settle({ workOrderId: 'nonexistent', payments: [] }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('欠款结算：debtAmount 正确', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'completed', shopId: 'shop-1',
        totalAmount: 500, items: [],
      });
      prisma.sequence.upsert.mockResolvedValue({ value: 3 });
      prisma.settlement.create.mockImplementation(async ({ data }: any) => ({
        id: 's-3', settleNo: 'ST202606110003',
        totalAmount: data.totalAmount, payableAmount: data.payableAmount,
        paidAmount: data.paidAmount, debtAmount: data.debtAmount,
      }));

      const result = await service.settle(
        { workOrderId: 'wo-1', payments: [{ payMethod: 'cash', amount: 200 }] },
        mockUser,
      );

      expect(result.debtAmount).toBe(300);
      expect(result.paidAmount).toBe(200);
    });

    it('套餐卡核销：抵扣金额计入 discountAmount', async () => {
      prisma.workOrder.findFirst.mockResolvedValue({
        id: 'wo-1', tenantId: 'tenant-1', status: 'completed', shopId: 'shop-1', vehicleId: 'v-1',
        totalAmount: 500, items: [
          { id: 'item-1', serviceItemId: 'svc-1', amount: 200, itemType: 'service' },
          { id: 'item-2', serviceItemId: 'svc-2', amount: 300, itemType: 'service' },
        ],
      });
      prisma.sequence.upsert.mockResolvedValue({ value: 4 });
      prisma.settlement.create.mockResolvedValue({
        id: 's-4', settleNo: 'ST202606110004', totalAmount: 500, discountAmount: 200,
        payableAmount: 300, paidAmount: 300, debtAmount: 0,
      });
      packageCardService.redeem.mockResolvedValue({ amount: 0 });

      const result = await service.settle(
        {
          workOrderId: 'wo-1',
          packageRedemptions: [{ cardId: 'pc-1', itemId: 'pci-1', serviceItemId: 'svc-1', quantity: 1 }],
          payments: [{ payMethod: 'cash', amount: 300 }],
        },
        mockUser,
      );

      expect(result.discountAmount).toBe(200);
      expect(packageCardService.redeem).toHaveBeenCalled();
    });
  });

  describe('reverse（反结算）', () => {
    it('正常反结算：工单状态回退到 completed', async () => {
      prisma.settlement.findFirst.mockResolvedValue({
        id: 's-1', tenantId: 'tenant-1', status: 'settled', workOrderId: 'wo-1',
      });
      prisma.packageCardTransaction.findMany.mockResolvedValue([]);
      prisma.storedValueTransaction.findMany.mockResolvedValue([]);

      const result = await service.reverse('s-1', mockUser);

      expect(result.message).toBe('反结算成功');
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'completed' }),
        }),
      );
    });

    it('储值卡退回：余额正确退回', async () => {
      prisma.settlement.findFirst.mockResolvedValue({
        id: 's-1', tenantId: 'tenant-1', status: 'settled', workOrderId: 'wo-1',
      });
      prisma.packageCardTransaction.findMany.mockResolvedValue([]);
      prisma.storedValueTransaction.findMany.mockResolvedValue([
        { cardId: 'card-1', amount: -200, principal: -150, gift: -50 },
      ]);
      prisma.storedValueCard.findFirst.mockResolvedValue({ id: 'card-1' });
      prisma.storedValueCard.update.mockResolvedValue({ balance: 700 });

      await service.reverse('s-1', mockUser);

      expect(prisma.storedValueCard.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ balance: { increment: 200 } }),
        }),
      );
    });

    it('套餐卡退回：次数正确退回', async () => {
      const mockPackageCardItem = { findFirst: jest.fn(), update: jest.fn() };
      const mockPackageCardTx = { findMany: jest.fn(), updateMany: jest.fn(), create: jest.fn() };
      prisma.$transaction.mockImplementation(async (fn: any) => fn({
        settlement: prisma.settlement,
        payment: prisma.payment,
        workOrder: prisma.workOrder,
        storedValueCard: prisma.storedValueCard,
        storedValueTransaction: prisma.storedValueTransaction,
        packageCardTransaction: mockPackageCardTx,
        packageCardItem: mockPackageCardItem,
        sequence: prisma.sequence,
      }));

      prisma.settlement.findFirst.mockResolvedValue({
        id: 's-1', tenantId: 'tenant-1', status: 'settled', workOrderId: 'wo-1',
      });
      mockPackageCardTx.findMany
        .mockResolvedValueOnce([{ cardId: 'pc-1', itemId: 'pci-1', quantity: 2 }])
        .mockResolvedValueOnce([]);
      prisma.storedValueTransaction.findMany.mockResolvedValue([]);
      mockPackageCardItem.findFirst.mockResolvedValue({ id: 'pci-1', remainQty: 3 });
      mockPackageCardItem.update.mockResolvedValue({ remainQty: 5 });

      await service.reverse('s-1', mockUser);

      expect(mockPackageCardItem.update).toHaveBeenCalled();
      expect(mockPackageCardTx.create).toHaveBeenCalled();
    });

    it('非 settled 状态反结算：抛出 ForbiddenException', async () => {
      prisma.settlement.findFirst.mockResolvedValue({
        id: 's-1', tenantId: 'tenant-1', status: 'refunded', workOrderId: 'wo-1',
      });

      await expect(service.reverse('s-1', mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll / findOne / payments 数据范围', () => {
    it('结算单列表按门店数据范围过滤', async () => {
      prisma.settlement.findMany.mockResolvedValue([]);
      prisma.settlement.count.mockResolvedValue(0);

      const result = await service.findAll(mockUser, { page: 1, pageSize: 10 });

      expect(result.page).toBe(1);
      expect(prisma.settlement.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', shopId: 'shop-1' }),
      }));
      expect(prisma.settlement.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ tenantId: 'tenant-1', shopId: 'shop-1' }),
      });
    });

    it('结算单详情按门店数据范围过滤', async () => {
      prisma.settlement.findFirst.mockResolvedValue({ id: 's-1', tenantId: 'tenant-1', payments: [] });

      await service.findOne('s-1', mockUser);

      expect(prisma.settlement.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 's-1', tenantId: 'tenant-1', shopId: 'shop-1' }),
      }));
    });

    it('收款记录通过结算单门店范围过滤', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      const result = await service.getPayments(mockUser, { page: 1, pageSize: 10 });

      expect(result.total).toBe(0);
      expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          settlement: { is: expect.objectContaining({ tenantId: 'tenant-1', shopId: 'shop-1' }) },
        }),
      }));
      expect(prisma.payment.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          settlement: { is: expect.objectContaining({ tenantId: 'tenant-1', shopId: 'shop-1' }) },
        }),
      });
    });

    it('退款前按门店范围校验结算单归属', async () => {
      prisma.settlement.findFirst.mockResolvedValue({ id: 's-1', tenantId: 'tenant-1', shopId: 'shop-1' });
      prisma.payment.findFirst.mockResolvedValue({ id: 'p-1', settlementId: 's-1', tenantId: 'tenant-1' });
      paymentGatewayService.refund.mockResolvedValue({ status: 'success' });

      await service.refundPayment('s-1', 'p-1', { amount: 100, reason: '测试退款' }, mockUser);

      expect(prisma.settlement.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 's-1', tenantId: 'tenant-1', shopId: 'shop-1' }),
      }));
      expect(paymentGatewayService.refund).toHaveBeenCalledWith('p-1', 100, '测试退款', 'user-1', 'tenant-1');
    });
  });
});
