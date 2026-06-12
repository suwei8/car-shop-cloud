import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { StoredValueCardService } from './stored-value-card.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

describe('StoredValueCardService', () => {
  let service: StoredValueCardService;
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
      storedValueCard: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      storedValueTransaction: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn({
        storedValueCard: prisma.storedValueCard,
        storedValueTransaction: prisma.storedValueTransaction,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoredValueCardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(StoredValueCardService);
  });

  describe('create（售卡）', () => {
    it('创建卡片 + 首笔充值流水', async () => {
      prisma.storedValueCard.findFirst.mockResolvedValue(null);
      prisma.storedValueCard.create.mockResolvedValue({
        id: 'card-1', cardNo: 'C001', balance: 1200, principalBalance: 1000, giftBalance: 200,
      });

      const result = await service.create(
        { cardNo: 'C001', customerId: 'cust-1', amount: 1000, gift: 200 },
        mockUser,
      );

      expect(result.balance).toBe(1200);
      expect(result.principalBalance).toBe(1000);
      expect(result.giftBalance).toBe(200);
      expect(prisma.storedValueTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'recharge', amount: 1200 }),
        }),
      );
    });

    it('卡号重复：抛出 ConflictException', async () => {
      prisma.storedValueCard.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create({ cardNo: 'C001', customerId: 'cust-1', amount: 1000 }, mockUser),
      ).rejects.toThrow(ConflictException);
    });

    it('无赠送金额：gift 默认为 0', async () => {
      prisma.storedValueCard.findFirst.mockResolvedValue(null);
      prisma.storedValueCard.create.mockResolvedValue({
        id: 'card-2', balance: 500, principalBalance: 500, giftBalance: 0,
      });

      const result = await service.create(
        { cardNo: 'C002', customerId: 'cust-1', amount: 500 },
        mockUser,
      );
      expect(result.balance).toBe(500);
      expect(result.giftBalance).toBe(0);
    });
  });

  describe('recharge（充值）', () => {
    it('充值：余额增加 + 流水记录', async () => {
      prisma.storedValueCard.findFirst
        .mockResolvedValueOnce({ id: 'card-1', status: 'active', balance: 1000, principalBalance: 800, giftBalance: 200, transactions: [] })
        .mockResolvedValueOnce({ id: 'card-1', status: 'active' });
      prisma.storedValueCard.update.mockResolvedValue({ balance: 1500, principalBalance: 1200, giftBalance: 300 });

      const result = await service.recharge(
        'card-1',
        { amount: 400, gift: 100 },
        mockUser,
      );

      expect(result.balance).toBe(1500);
      expect(prisma.storedValueTransaction.create).toHaveBeenCalled();
    });

    it('卡片冻结状态：抛出 ForbiddenException', async () => {
      prisma.storedValueCard.findFirst.mockResolvedValue({
        id: 'card-1', status: 'frozen', balance: 1000, transactions: [],
      });

      await expect(
        service.recharge('card-1', { amount: 100 }, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('consume（消费）', () => {
    it('先扣赠送再扣本金', async () => {
      prisma.storedValueCard.findFirst.mockResolvedValue({
        id: 'card-1', status: 'active', balance: 1000, principalBalance: 600, giftBalance: 400, transactions: [],
      });
      prisma.storedValueCard.update.mockResolvedValue({ balance: 700, principalBalance: 600, giftBalance: 100 });

      const result = await service.consume('card-1', 300, 'settlement', 's-1', mockUser);

      expect(result.balance).toBe(700);
      expect(prisma.storedValueTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'consume', amount: -300, gift: -300 }),
        }),
      );
      expect(prisma.storedValueTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ principal: expect.closeTo(0, 5) }),
        }),
      );
    });

    it('余额不足：抛出 ForbiddenException', async () => {
      prisma.storedValueCard.findFirst.mockResolvedValue({
        id: 'card-1', status: 'active', balance: 100, transactions: [],
      });

      await expect(
        service.consume('card-1', 200, 'settlement', 's-1', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('赠送余额不够扣，差额从本金扣', async () => {
      prisma.storedValueCard.findFirst.mockResolvedValue({
        id: 'card-1', status: 'active', balance: 1000, principalBalance: 600, giftBalance: 200, transactions: [],
      });
      prisma.storedValueCard.update.mockResolvedValue({ balance: 700, principalBalance: 500, giftBalance: 0 });

      const result = await service.consume('card-1', 300, 'settlement', 's-1', mockUser);

      expect(result.balance).toBe(700);
      expect(prisma.storedValueTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gift: -200, principal: -100 }),
        }),
      );
    });
  });

  describe('refund（退款）', () => {
    it('退款：只退本金，金额正确', async () => {
      prisma.storedValueCard.findFirst.mockResolvedValue({
        id: 'card-1', status: 'active', balance: 1000, principalBalance: 800, transactions: [],
      });
      prisma.storedValueCard.update.mockResolvedValue({ balance: 700, principalBalance: 500 });

      const result = await service.refund('card-1', { amount: 300, remark: '退款' }, mockUser);

      expect(result.balance).toBe(700);
      expect(result.principalBalance).toBe(500);
    });

    it('退款超过本金：抛出 ForbiddenException', async () => {
      prisma.storedValueCard.findFirst.mockResolvedValue({
        id: 'card-1', status: 'active', balance: 1000, principalBalance: 200, transactions: [],
      });

      await expect(
        service.refund('card-1', { amount: 300, remark: '退款' }, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('退款金额为 0：抛出 ForbiddenException', async () => {
      prisma.storedValueCard.findFirst.mockResolvedValue({
        id: 'card-1', status: 'active', balance: 1000, principalBalance: 800, transactions: [],
      });

      await expect(
        service.refund('card-1', { amount: 0, remark: '退款' }, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('卡片不存在：抛出 NotFoundException', async () => {
      prisma.storedValueCard.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });
});
