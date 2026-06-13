import * as ExcelJS from 'exceljs';
import { ReportService } from './report.service';

const mockPrisma = {
  workOrder: { groupBy: jest.fn(), findMany: jest.fn() },
  payment: { groupBy: jest.fn() },
  settlement: { aggregate: jest.fn() },
  user: { findMany: jest.fn() },
  dispatchTask: { findMany: jest.fn() },
  workOrderItem: { findMany: jest.fn() },
  part: { findMany: jest.fn() },
  customer: { findMany: jest.fn(), count: jest.fn() },
  storedValueCard: { findMany: jest.fn() },
  packageCardTransaction: { findMany: jest.fn() },
};

const mockUser = {
  sub: 'u1',
  tenantId: 't1',
  shopId: 's1',
  isPlatform: false,
  roles: [],
  permissions: [],
  dataScope: 'all' as const,
};

describe('ReportService - Excel Export', () => {
  let service: ReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportService(mockPrisma as any);
  });

  describe('exportDailyReport', () => {
    beforeEach(() => {
      mockPrisma.workOrder.groupBy.mockResolvedValue([
        { status: 'completed', _count: { id: 5 }, _sum: { totalAmount: 2500 } },
        { status: 'settled', _count: { id: 3 }, _sum: { totalAmount: 1500 } },
      ]);
      mockPrisma.payment.groupBy.mockResolvedValue([
        { payMethod: 'wechat', _sum: { amount: 2000 }, _count: { id: 4 } },
        { payMethod: 'cash', _sum: { amount: 1000 }, _count: { id: 2 } },
      ]);
      mockPrisma.settlement.aggregate.mockResolvedValue({
        _sum: { totalAmount: 4000, discountAmount: 200, paidAmount: 3500, debtAmount: 300 },
        _count: { id: 8 },
      });
    });

    it('should generate a valid Excel buffer', async () => {
      const buffer = await service.exportDailyReport(mockUser, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should contain correct sheet data when re-read', async () => {
      const buffer = await service.exportDailyReport(mockUser, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const mainSheet = wb.getWorksheet('营业日报');
      expect(mainSheet).toBeDefined();
      expect(mainSheet!.rowCount).toBeGreaterThanOrEqual(7);

      const statusSheet = wb.getWorksheet('按状态');
      expect(statusSheet).toBeDefined();
      expect(statusSheet!.rowCount).toBeGreaterThanOrEqual(3);

      const paySheet = wb.getWorksheet('按支付方式');
      expect(paySheet).toBeDefined();
      expect(paySheet!.rowCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('exportTechnicianReport', () => {
    beforeEach(() => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'tech1', name: '技师A' },
        { id: 'tech2', name: '技师B' },
      ]);
      mockPrisma.dispatchTask.findMany
        .mockResolvedValueOnce([
          { status: 'completed' },
          { status: 'completed' },
          { status: 'pending' },
        ])
        .mockResolvedValueOnce([
          { status: 'completed' },
        ]);
      mockPrisma.workOrderItem.findMany
        .mockResolvedValueOnce([
          { amount: 500 },
          { amount: 300 },
        ])
        .mockResolvedValueOnce([
          { amount: 200 },
        ]);
    });

    it('should generate a valid Excel buffer', async () => {
      const buffer = await service.exportTechnicianReport(mockUser, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should contain technician rows when re-read', async () => {
      const buffer = await service.exportTechnicianReport(mockUser, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const sheet = wb.getWorksheet('技师产值');
      expect(sheet).toBeDefined();
      expect(sheet!.rowCount).toBe(3);
    });
  });
});
