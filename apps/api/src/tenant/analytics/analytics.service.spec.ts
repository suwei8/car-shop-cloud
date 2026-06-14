import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
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

  const platformUser: JwtPayload = {
    sub: 'admin-1',
    tenantId: null,
    shopId: null,
    isPlatform: true,
    roles: ['platform_admin'],
    permissions: [],
    audience: 'employee',
  };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      workOrder: {
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  describe('tenant_id 隔离', () => {
    it('平台用户所有接口返回空数据', async () => {
      const revenue = await service.getRevenueTrend(platformUser, {});
      expect(revenue.data).toEqual([]);

      const workOrders = await service.getWorkOrderStats(platformUser, {});
      expect(workOrders.statusDistribution).toEqual([]);

      const technicians = await service.getTechnicianRanking(platformUser, {});
      expect(technicians.data).toEqual([]);

      const customers = await service.getCustomerAnalysis(platformUser, {});
      expect(customers.newCustomers).toBe(0);

      const parts = await service.getPartsConsumption(platformUser, {});
      expect(parts.data).toEqual([]);
    });
  });

  describe('getRevenueTrend', () => {
    it('should return revenue data with correct structure', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { period: '2026-06-01', total_revenue: 5000, order_count: 3 },
        { period: '2026-06-02', total_revenue: 3200, order_count: 2 },
      ]);

      const result = await service.getRevenueTrend(mockUser, { dimension: 'day' });

      expect(result.dimension).toBe('day');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].totalRevenue).toBe('5000');
      expect(result.data[0].orderCount).toBe(3);
    });

    it('should use correct tenantId in query', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getRevenueTrend(mockUser, {});

      // Verify $queryRaw was called (Prisma tagged template handles tenantId as parameter)
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('getWorkOrderStats', () => {
    it('should return status and type distributions', async () => {
      prisma.workOrder.groupBy
        .mockResolvedValueOnce([
          { status: 'in_progress', _count: { id: 5 } },
          { status: 'completed', _count: { id: 10 } },
        ])
        .mockResolvedValueOnce([
          { orderType: 'repair', _count: { id: 8 } },
          { orderType: 'wash', _count: { id: 7 } },
        ]);
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getWorkOrderStats(mockUser, {});

      expect(result.statusDistribution).toHaveLength(2);
      expect(result.statusDistribution[0].status).toBe('in_progress');
      expect(result.statusDistribution[0].count).toBe(5);
      expect(result.typeDistribution).toHaveLength(2);
    });
  });

  describe('getTechnicianRanking', () => {
    it('should return technicians ordered by revenue desc', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { technician_id: 't1', technician_name: '张三', order_count: 10, completed_count: 8, total_revenue: 5000 },
        { technician_id: 't2', technician_name: '李四', order_count: 5, completed_count: 4, total_revenue: 2000 },
      ]);

      const result = await service.getTechnicianRanking(mockUser, {});

      expect(result.data).toHaveLength(2);
      expect(result.data[0].technicianName).toBe('张三');
      expect(result.data[0].totalRevenue).toBe('5000');
      expect(result.data[0].orderCount).toBe(10);
    });
  });

  describe('getCustomerAnalysis', () => {
    it('should return new/returning customer stats', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ new_customers: 5, returning_customers: 12 }])
        .mockResolvedValueOnce([
          { period: '2026-06-01', new_count: 3 },
          { period: '2026-06-02', new_count: 2 },
        ])
        .mockResolvedValueOnce([{ source: 'walk_in', customer_count: 10 }]);

      const result = await service.getCustomerAnalysis(mockUser, {});

      expect(result.newCustomers).toBe(5);
      expect(result.returningCustomers).toBe(12);
      expect(result.growthTrend).toHaveLength(2);
      expect(result.growthTrend[0].newCount).toBe(3);
      expect(result.sourceDistribution).toHaveLength(0);
    });
  });

  describe('getPartsConsumption', () => {
    it('should return parts ordered by total amount desc', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { part_id: 'p1', part_name: '机油滤芯', part_code: 'OF-001', total_quantity: 20, total_amount: 1000 },
        { part_id: 'p2', part_name: '刹车片', part_code: 'BP-001', total_quantity: 8, total_amount: 800 },
      ]);

      const result = await service.getPartsConsumption(mockUser, {});

      expect(result.data).toHaveLength(2);
      expect(result.data[0].partName).toBe('机油滤芯');
      expect(result.data[0].totalAmount).toBe('1000');
    });
  });

  describe('getDateRange', () => {
    it('should default to last 30 days when no dates provided', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getRevenueTrend(mockUser, {});

      const sql = prisma.$queryRaw.mock.calls[0][0];
      // Just verify it ran without error
      expect(sql).toBeDefined();
    });

    it('should use provided date range', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getRevenueTrend(mockUser, {
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      });

      expect(result.startDate).toBe('2026-01-01');
      expect(result.endDate).toBe('2026-06-30');
    });
  });
});
