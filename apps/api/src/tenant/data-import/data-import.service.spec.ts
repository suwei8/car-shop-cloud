import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataImportService } from './data-import.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';
const ExcelJS = require('exceljs');

describe('DataImportService', () => {
  let service: DataImportService;
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
      customer: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      vehicle: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      storedValueCard: { create: jest.fn() },
      storedValueTransaction: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn({
        customer: prisma.customer,
        vehicle: prisma.vehicle,
        storedValueCard: prisma.storedValueCard,
        storedValueTransaction: prisma.storedValueTransaction,
        auditLog: prisma.auditLog,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataImportService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DataImportService);
  });

  describe('generateTemplate', () => {
    it('should generate a valid Excel buffer with 3 sheets', async () => {
      const buffer = await service.generateTemplate();
      expect(buffer).toBeInstanceOf(Buffer);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      expect(workbook.getWorksheet('客户')).toBeDefined();
      expect(workbook.getWorksheet('车辆')).toBeDefined();
      expect(workbook.getWorksheet('储值卡')).toBeDefined();

      const customerSheet = workbook.getWorksheet('客户')!;
      expect(customerSheet.rowCount).toBe(2); // header + example
      expect(customerSheet.getRow(1).getCell(1).value).toBe('客户姓名*');
    });
  });

  describe('preview', () => {
    async function createTestWorkbook(): Promise<Buffer> {
      const workbook = new ExcelJS.Workbook();
      const cs = workbook.addWorksheet('客户');
      cs.addRow(['客户姓名*', '手机号*', '备注']);
      cs.addRow(['张三', '13800001111', '']);

      const vs = workbook.addWorksheet('车辆');
      vs.addRow(['车牌号*', '客户手机号*', '品牌', '车型', 'VIN', '行驶里程']);
      vs.addRow(['京A12345', '13800001111', '丰田', '卡罗拉', '', '50000']);

      const cardSheet = workbook.addWorksheet('储值卡');
      cardSheet.addRow(['客户手机号*', '卡号（留空自动生成）', '当前余额*', '其中赠送金额（默认0）', '开卡日期']);
      cardSheet.addRow(['13800001111', '', '500.00', '100.00', '']);

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer as ArrayBuffer);
    }

    it('should parse valid data correctly', async () => {
      const buffer = await createTestWorkbook();
      const result = await service.preview(buffer, mockUser);

      expect(result.customers.valid).toHaveLength(1);
      expect(result.customers.errors).toHaveLength(0);
      expect(result.vehicles.valid).toHaveLength(1);
      expect(result.vehicles.errors).toHaveLength(0);
      expect(result.storedValueCards.valid).toHaveLength(1);
      expect(result.storedValueCards.errors).toHaveLength(0);
      expect(result.summary.errorRows).toBe(0);
    });

    it('should detect invalid phone number', async () => {
      const workbook = new ExcelJS.Workbook();
      const cs = workbook.addWorksheet('客户');
      cs.addRow(['客户姓名*', '手机号*', '备注']);
      cs.addRow(['张三', '138', '']); // invalid phone

      const vs = workbook.addWorksheet('车辆');
      vs.addRow(['车牌号*', '客户手机号*', '品牌', '车型', 'VIN', '行驶里程']);

      const cardSheet = workbook.addWorksheet('储值卡');
      cardSheet.addRow(['客户手机号*', '卡号（留空自动生成）', '当前余额*', '其中赠送金额（默认0）', '开卡日期']);

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
      const result = await service.preview(buffer, mockUser);

      expect(result.customers.errors).toHaveLength(1);
      expect(result.customers.errors[0].errors).toContain('手机号必须为11位数字');
    });

    it('should detect duplicate phone in database', async () => {
      prisma.customer.findMany.mockResolvedValue([{ phone: '13800001111' }]);

      const buffer = await createTestWorkbook();
      const result = await service.preview(buffer, mockUser);

      expect(result.customers.valid[0].status).toBe('skip');
      expect(result.customers.valid[0].errors).toContain('手机号已存在，将跳过');
    });

    it('should detect invalid balance', async () => {
      const workbook = new ExcelJS.Workbook();
      const cs = workbook.addWorksheet('客户');
      cs.addRow(['客户姓名*', '手机号*', '备注']);
      cs.addRow(['张三', '13800001111', '']);

      const vs = workbook.addWorksheet('车辆');
      vs.addRow(['车牌号*', '客户手机号*', '品牌', '车型', 'VIN', '行驶里程']);

      const cardSheet = workbook.addWorksheet('储值卡');
      cardSheet.addRow(['客户手机号*', '卡号（留空自动生成）', '当前余额*', '其中赠送金额（默认0）', '开卡日期']);
      cardSheet.addRow(['13800001111', '', '-100', '0', '']);

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
      const result = await service.preview(buffer, mockUser);

      expect(result.storedValueCards.errors).toHaveLength(1);
      expect(result.storedValueCards.errors[0].errors).toContain('当前余额格式不正确，支持格式：0、0.00、123、123.45');
    });

    it('should detect gift exceeding balance', async () => {
      const workbook = new ExcelJS.Workbook();
      const cs = workbook.addWorksheet('客户');
      cs.addRow(['客户姓名*', '手机号*', '备注']);
      cs.addRow(['张三', '13800001111', '']);

      const vs = workbook.addWorksheet('车辆');
      vs.addRow(['车牌号*', '客户手机号*', '品牌', '车型', 'VIN', '行驶里程']);

      const cardSheet = workbook.addWorksheet('储值卡');
      cardSheet.addRow(['客户手机号*', '卡号（留空自动生成）', '当前余额*', '其中赠送金额（默认0）', '开卡日期']);
      cardSheet.addRow(['13800001111', '', '100.00', '200.00', '']); // gift > balance

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
      const result = await service.preview(buffer, mockUser);

      expect(result.storedValueCards.errors).toHaveLength(1);
      expect(result.storedValueCards.errors[0].errors).toContain('赠送金额不能超过当前余额');
    });

    it('should reject file exceeding row limit', async () => {
      const workbook = new ExcelJS.Workbook();
      const cs = workbook.addWorksheet('客户');
      cs.addRow(['客户姓名*', '手机号*', '备注']);
      for (let i = 0; i < 5001; i++) {
        cs.addRow([`客户${i}`, `1380000${String(i).padStart(4, '0')}`, '']);
      }

      const vs = workbook.addWorksheet('车辆');
      vs.addRow(['车牌号*', '客户手机号*', '品牌', '车型', 'VIN', '行驶里程']);

      const cardSheet = workbook.addWorksheet('储值卡');
      cardSheet.addRow(['客户手机号*', '卡号（留空自动生成）', '当前余额*', '其中赠送金额（默认0）', '开卡日期']);

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);

      await expect(service.preview(buffer, mockUser)).rejects.toThrow('总行数');
    });
  });

  describe('execute', () => {
    it('should import valid data in a transaction', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      const previewResult = {
        customers: { valid: [{ rowNum: 2, data: { name: '张三', phone: '13800001111', remark: '' }, status: 'valid' as const }], errors: [] },
        vehicles: { valid: [{ rowNum: 2, data: { plateNo: '京A12345', customerPhone: '13800001111', brand: '丰田', model: '', vin: '', mileage: '' }, status: 'valid' as const }], errors: [] },
        storedValueCards: { valid: [{ rowNum: 2, data: { customerPhone: '13800001111', cardNo: '', balance: '500.00', giftAmount: '100.00', openDate: '' }, status: 'valid' as const }], errors: [] },
        summary: { totalRows: 3, validRows: 3, errorRows: 0, skipRows: 0 },
      };

      prisma.customer.create.mockResolvedValue({ id: 'cust-1' });
      prisma.vehicle.findFirst.mockResolvedValue(null);
      prisma.vehicle.create.mockResolvedValue({});
      prisma.storedValueCard.create.mockResolvedValue({ id: 'card-1' });
      prisma.auditLog.create.mockResolvedValue({});

      const result = await service.execute(Buffer.from(''), previewResult, mockUser);

      expect(result.customers).toBe(1);
      expect(result.vehicles).toBe(1);
      expect(result.storedValueCards).toBe(1);
      expect(prisma.storedValueTransaction.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should skip existing customers by phone', async () => {
      prisma.customer.findMany.mockResolvedValue([{ id: 'existing', phone: '13800001111' }]);
      prisma.customer.findFirst.mockResolvedValue({ id: 'existing', phone: '13800001111' });

      const previewResult = {
        customers: { valid: [{ rowNum: 2, data: { name: '张三', phone: '13800001111', remark: '' }, status: 'valid' as const }], errors: [] },
        vehicles: { valid: [], errors: [] },
        storedValueCards: { valid: [], errors: [] },
        summary: { totalRows: 1, validRows: 1, errorRows: 0, skipRows: 0 },
      };

      const result = await service.execute(Buffer.from(''), previewResult, mockUser);
      expect(result.customers).toBe(0);
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('should write import transaction for stored value cards', async () => {
      prisma.customer.findMany.mockResolvedValue([{ id: 'cust-1', phone: '13800001111' }]);

      const previewResult = {
        customers: { valid: [], errors: [] },
        vehicles: { valid: [], errors: [] },
        storedValueCards: {
          valid: [{
            rowNum: 2,
            data: { customerPhone: '13800001111', cardNo: '', balance: '500.00', giftAmount: '100.00', openDate: '' },
            status: 'valid' as const,
          }],
          errors: [],
        },
        summary: { totalRows: 1, validRows: 1, errorRows: 0, skipRows: 0 },
      };

      prisma.storedValueCard.create.mockResolvedValue({ id: 'card-1' });
      prisma.auditLog.create.mockResolvedValue({});

      const result = await service.execute(Buffer.from(''), previewResult, mockUser);

      expect(result.storedValueCards).toBe(1);
      expect(prisma.storedValueTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'import',
            amount: 500,
            principal: 400,
            gift: 100,
          }),
        }),
      );
    });
  });
});
