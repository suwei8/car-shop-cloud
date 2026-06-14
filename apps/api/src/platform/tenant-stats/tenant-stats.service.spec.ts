import { TenantStatsService } from './tenant-stats.service';

const mockPrisma = {
  workOrder: { count: jest.fn(), groupBy: jest.fn() },
  settlement: { aggregate: jest.fn(), groupBy: jest.fn() },
  user: { count: jest.fn(), groupBy: jest.fn() },
  customer: { count: jest.fn(), groupBy: jest.fn() },
  storedValueCard: { aggregate: jest.fn(), groupBy: jest.fn() },
  auditLog: { findFirst: jest.fn() },
  tenant: { findMany: jest.fn() },
};

function createService() {
  return new TenantStatsService(mockPrisma as any);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TenantStatsService', () => {
  describe('getTenantStats', () => {
    it('should return correct fields for a single tenant', async () => {
      const service = createService();

      mockPrisma.workOrder.count.mockResolvedValue(12);
      mockPrisma.settlement.aggregate.mockResolvedValue({ _sum: { paidAmount: 1650 } });
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.customer.count.mockResolvedValue(25);
      mockPrisma.storedValueCard.aggregate.mockResolvedValue({ _sum: { balance: 2450 } });
      mockPrisma.auditLog.findFirst.mockResolvedValue({ createdAt: new Date('2026-06-12T10:00:00Z') });

      const result = await service.getTenantStats('tenant-1');

      expect(result).toEqual({
        workOrderCount30d: 12,
        settlementAmount30d: '1650.00',
        activeUserCount7d: 1,
        customerCount: 25,
        storedValueBalance: '2450.00',
        lastActiveAt: expect.stringContaining('2026-06-12'),
      });
    });

    it('should return zeros and null when no data exists', async () => {
      const service = createService();

      mockPrisma.workOrder.count.mockResolvedValue(0);
      mockPrisma.settlement.aggregate.mockResolvedValue({ _sum: { paidAmount: null } });
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.storedValueCard.aggregate.mockResolvedValue({ _sum: { balance: null } });
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getTenantStats('tenant-1');

      expect(result.workOrderCount30d).toBe(0);
      expect(result.settlementAmount30d).toBe('0.00');
      expect(result.activeUserCount7d).toBe(0);
      expect(result.customerCount).toBe(0);
      expect(result.storedValueBalance).toBe('0.00');
      expect(result.lastActiveAt).toBeNull();
    });
  });

  describe('getAllTenantsOverview', () => {
    it('should return overview list without errors', async () => {
      const service = createService();

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 't1', name: 'Shop A', status: 'active', subscriptionStatus: 'active', subscriptionEndAt: new Date('2027-01-01'), createdAt: new Date('2026-01-01') },
        { id: 't2', name: 'Shop B', status: 'active', subscriptionStatus: 'trial', subscriptionEndAt: null, createdAt: new Date('2026-03-01') },
      ]);
      mockPrisma.workOrder.groupBy.mockResolvedValue([
        { tenantId: 't1', _count: { id: 15 } },
      ]);
      mockPrisma.settlement.groupBy.mockResolvedValue([
        { tenantId: 't1', _sum: { paidAmount: 3200 } },
      ]);
      mockPrisma.user.groupBy.mockResolvedValue([
        { tenantId: 't2', _count: { id: 2 } },
      ]);
      mockPrisma.customer.groupBy.mockResolvedValue([
        { tenantId: 't1', _count: { id: 50 } },
      ]);
      mockPrisma.storedValueCard.groupBy.mockResolvedValue([]);

      const result = await service.getAllTenantsOverview();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({
        tenantId: 't1',
        name: 'Shop A',
        workOrderCount30d: 15,
        settlementAmount30d: '3200.00',
        customerCount: 50,
        storedValueBalance: '0.00',
      }));
      expect(result[1]).toEqual(expect.objectContaining({
        tenantId: 't2',
        workOrderCount30d: 0,
        customerCount: 0,
      }));
    });
  });
});
