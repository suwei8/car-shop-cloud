import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
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
      workOrder: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      payment: {
        aggregate: jest.fn(),
      },
      appointment: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      dispatchTask: {
        count: jest.fn(),
      },
      stockBalance: {
        findMany: jest.fn(),
      },
      reminder: {
        count: jest.fn(),
      },
      settlement: {
        aggregate: jest.fn(),
      },
      tenant: {
        count: jest.fn(),
      },
      customer: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  describe('getOverview', () => {
    it('返回租户级概览数据（含欠款统计）', async () => {
      prisma.workOrder.count
        .mockResolvedValueOnce(5) // todayOrders
        .mockResolvedValueOnce(2); // inProgressOrders
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
      prisma.appointment.count.mockResolvedValue(3);
      prisma.dispatchTask.count.mockResolvedValue(1);
      prisma.stockBalance.findMany.mockResolvedValue([]);
      prisma.reminder.count.mockResolvedValue(2);
      prisma.settlement.aggregate.mockResolvedValue({
        _sum: { debtAmount: 500 },
        _count: { id: 3 },
      });

      const result = await service.getOverview(mockUser) as any;

      expect(result.todayOrders).toBe(5);
      expect(result.todayRevenue).toBe(1000);
      expect(result.inProgressOrders).toBe(2);
      expect(result.totalDebt).toBe(500);
      expect(result.debtCount).toBe(3);
      expect(prisma.workOrder.count).toHaveBeenNthCalledWith(1, {
        where: expect.objectContaining({ tenantId: 'tenant-1', shopId: 'shop-1' }),
      });
      expect(prisma.workOrder.count).toHaveBeenNthCalledWith(2, {
        where: expect.objectContaining({ tenantId: 'tenant-1', shopId: 'shop-1', status: 'in_progress' }),
      });
      expect(prisma.payment.aggregate).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          settlement: { is: expect.objectContaining({ tenantId: 'tenant-1', shopId: 'shop-1' }) },
        }),
      }));
      expect(prisma.stockBalance.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          warehouse: { shopId: 'shop-1' },
        }),
      }));
    });

    it('最近工单和今日预约按门店数据范围过滤', async () => {
      prisma.workOrder.findMany.mockResolvedValue([]);
      prisma.appointment.findMany.mockResolvedValue([]);

      await service.getRecentOrders(mockUser, 5);
      await service.getTodayAppointments(mockUser);

      expect(prisma.workOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { tenantId: 'tenant-1', shopId: 'shop-1' },
        take: 5,
      }));
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', shopId: 'shop-1' }),
      }));
    });

    it('欠款为 0 时返回正确默认值', async () => {
      prisma.workOrder.count.mockResolvedValue(0);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prisma.appointment.count.mockResolvedValue(0);
      prisma.dispatchTask.count.mockResolvedValue(0);
      prisma.stockBalance.findMany.mockResolvedValue([]);
      prisma.reminder.count.mockResolvedValue(0);
      prisma.settlement.aggregate.mockResolvedValue({
        _sum: { debtAmount: null },
        _count: { id: 0 },
      });

      const result = await service.getOverview(mockUser) as any;

      expect(result.totalDebt).toBe(0);
      expect(result.debtCount).toBe(0);
    });
  });
});
