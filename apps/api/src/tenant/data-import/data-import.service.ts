import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';
import { Prisma } from '@prisma/client';
const ExcelJS = require('exceljs');

const AMOUNT_RE = /^(0|[1-9]\d*)(\.\d{1,2})?$/;

function amountToCents(str: string): number {
  const match = AMOUNT_RE.exec(str);
  if (!match) return NaN;
  const [integerPart, decimalPart = ''] = str.split('.');
  const centsPart = decimalPart.padEnd(2, '0');
  return Number(integerPart) * 100 + Number(centsPart);
}

function centsToAmount(cents: number): number {
  return cents / 100;
}

export interface PreviewResult {
  customers: { valid: PreviewRow[]; errors: PreviewRow[] };
  vehicles: { valid: PreviewRow[]; errors: PreviewRow[] };
  storedValueCards: { valid: PreviewRow[]; errors: PreviewRow[] };
  summary: { totalRows: number; validRows: number; errorRows: number; skipRows: number };
}

export interface PreviewRow {
  rowNum: number;
  data: Record<string, string>;
  errors?: string[];
  status?: 'valid' | 'error' | 'skip';
}

interface CustomerPhoneRecord {
  phone: string;
}

interface VehiclePlateRecord {
  plateNo: string;
}

interface CustomerIdPhoneRecord {
  id: string;
  phone: string;
}

@Injectable()
export class DataImportService {
  private readonly logger = new Logger(DataImportService.name);

  constructor(private prisma: PrismaService) {}

  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '车店云管家';
    workbook.created = new Date();

    // Sheet1: 客户
    const customerSheet = workbook.addWorksheet('客户');
    customerSheet.columns = [
      { header: '客户姓名*', key: 'name', width: 15 },
      { header: '手机号*', key: 'phone', width: 18 },
      { header: '备注', key: 'remark', width: 25 },
    ];
    this.styleHeader(customerSheet);
    customerSheet.addRow({ name: '张三', phone: '13800001111', remark: '示例数据' });
    this.styleExampleRow(customerSheet, 2);

    // Sheet2: 车辆
    const vehicleSheet = workbook.addWorksheet('车辆');
    vehicleSheet.columns = [
      { header: '车牌号*', key: 'plateNo', width: 15 },
      { header: '客户手机号*', key: 'customerPhone', width: 18 },
      { header: '品牌', key: 'brand', width: 12 },
      { header: '车型', key: 'model', width: 15 },
      { header: 'VIN', key: 'vin', width: 22 },
      { header: '行驶里程', key: 'mileage', width: 12 },
    ];
    this.styleHeader(vehicleSheet);
    vehicleSheet.addRow({
      plateNo: '京A12345', customerPhone: '13800001111',
      brand: '丰田', model: '卡罗拉', vin: 'LVGBH42K8NG123456', mileage: '50000',
    });
    this.styleExampleRow(vehicleSheet, 2);

    // Sheet3: 储值卡
    const cardSheet = workbook.addWorksheet('储值卡');
    cardSheet.columns = [
      { header: '客户手机号*', key: 'customerPhone', width: 18 },
      { header: '卡号（留空自动生成）', key: 'cardNo', width: 20 },
      { header: '当前余额*', key: 'balance', width: 15 },
      { header: '其中赠送金额（默认0）', key: 'giftAmount', width: 20 },
      { header: '开卡日期', key: 'openDate', width: 15 },
    ];
    this.styleHeader(cardSheet);
    cardSheet.addRow({
      customerPhone: '13800001111', cardNo: '',
      balance: '500.00', giftAmount: '100.00', openDate: '2025-01-01',
    });
    this.styleExampleRow(cardSheet, 2);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }

  private styleHeader(sheet: any) {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  private styleExampleRow(sheet: any, rowNum: number) {
    const row = sheet.getRow(rowNum);
    row.font = { color: { argb: 'FF999999' } };
    row.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FFF2F2F2' },
    };
  }

  async preview(fileBuffer: Buffer | ArrayBuffer, user: JwtPayload): Promise<PreviewResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const customersSheet = workbook.getWorksheet('客户');
    const vehiclesSheet = workbook.getWorksheet('车辆');
    const cardsSheet = workbook.getWorksheet('储值卡');

    if (!customersSheet || !vehiclesSheet || !cardsSheet) {
      throw new BadRequestException('Excel文件缺少必要的Sheet（客户/车辆/储值卡）');
    }

    const totalRows = (customersSheet.rowCount - 1) + (vehiclesSheet.rowCount - 1) + (cardsSheet.rowCount - 1);
    if (totalRows > 5000) {
      throw new BadRequestException(`总行数 ${totalRows} 超过上限5000，请分批导入`);
    }

    const activeCustomers = (await this.prisma.customer.findMany({
      where: { tenantId: user.tenantId!, status: 'active' },
      select: { phone: true },
    })) as CustomerPhoneRecord[];
    const existingPhones = new Set<string>(activeCustomers.map((c) => c.phone));

    const activeVehicles = (await this.prisma.vehicle.findMany({
      where: { tenantId: user.tenantId!, status: 'active' },
      select: { plateNo: true },
    })) as VehiclePlateRecord[];
    const existingPlates = new Set<string>(activeVehicles.map((v) => v.plateNo.toUpperCase()));

    const customerResult = this.parseCustomerSheet(customersSheet, existingPhones);
    const vehicleResult = this.parseVehicleSheet(vehiclesSheet, existingPhones, existingPlates, customerResult.valid);
    const cardResult = this.parseCardSheet(cardsSheet, existingPhones, customerResult.valid);

    const validRows = customerResult.valid.length + vehicleResult.valid.length + cardResult.valid.length;
    const errorRows = customerResult.errors.length + vehicleResult.errors.length + cardResult.errors.length;
    const skipRows = customerResult.valid.filter((r: PreviewRow) => r.status === 'skip').length
      + vehicleResult.valid.filter((r: PreviewRow) => r.status === 'skip').length
      + cardResult.valid.filter((r: PreviewRow) => r.status === 'skip').length;

    return {
      customers: customerResult,
      vehicles: vehicleResult,
      storedValueCards: cardResult,
      summary: {
        totalRows: customerResult.valid.length + customerResult.errors.length
          + vehicleResult.valid.length + vehicleResult.errors.length
          + cardResult.valid.length + cardResult.errors.length,
        validRows,
        errorRows,
        skipRows,
      },
    };
  }

  private parseCustomerSheet(sheet: any, existingPhones: Set<string>): { valid: PreviewRow[]; errors: PreviewRow[] } {
    const valid: PreviewRow[] = [];
    const errors: PreviewRow[] = [];

    sheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return;

      const data = {
        name: String(row.getCell(1).value || '').trim(),
        phone: String(row.getCell(2).value || '').trim(),
        remark: String(row.getCell(3).value || '').trim(),
      };

      const rowErrors: string[] = [];

      if (!data.phone || !/^\d{11}$/.test(data.phone)) {
        rowErrors.push('手机号必须为11位数字');
      }

      if (!data.name) {
        rowErrors.push('客户姓名不能为空');
      }

      if (rowErrors.length > 0) {
        errors.push({ rowNum: rowNumber, data, errors: rowErrors, status: 'error' });
        return;
      }

      if (existingPhones.has(data.phone)) {
        valid.push({ rowNum: rowNumber, data, status: 'skip', errors: ['手机号已存在，将跳过'] });
      } else {
        valid.push({ rowNum: rowNumber, data, status: 'valid' });
        existingPhones.add(data.phone);
      }
    });

    return { valid, errors };
  }

  private parseVehicleSheet(
    sheet: any,
    existingPhones: Set<string>,
    existingPlates: Set<string>,
    customerValid: PreviewRow[],
  ): { valid: PreviewRow[]; errors: PreviewRow[] } {
    const validPhoneSet = new Set(customerValid.map((r: PreviewRow) => r.data.phone));
    const valid: PreviewRow[] = [];
    const errors: PreviewRow[] = [];

    sheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return;

      const data = {
        plateNo: String(row.getCell(1).value || '').trim().toUpperCase(),
        customerPhone: String(row.getCell(2).value || '').trim(),
        brand: String(row.getCell(3).value || '').trim(),
        model: String(row.getCell(4).value || '').trim(),
        vin: String(row.getCell(5).value || '').trim(),
        mileage: String(row.getCell(6).value || '').trim(),
      };

      const rowErrors: string[] = [];

      if (!data.plateNo) {
        rowErrors.push('车牌号不能为空');
      }

      if (!data.customerPhone || !/^\d{11}$/.test(data.customerPhone)) {
        rowErrors.push('客户手机号必须为11位数字');
      }

      if (data.mileage && !/^\d+$/.test(data.mileage)) {
        rowErrors.push('行驶里程必须为数字');
      }

      if (data.customerPhone && !existingPhones.has(data.customerPhone) && !validPhoneSet.has(data.customerPhone)) {
        rowErrors.push('客户手机号不存在（请先在客户Sheet中导入该手机号）');
      }

      if (rowErrors.length > 0) {
        errors.push({ rowNum: rowNumber, data, errors: rowErrors, status: 'error' });
        return;
      }

      if (existingPlates.has(data.plateNo)) {
        valid.push({ rowNum: rowNumber, data, status: 'skip', errors: ['车牌号已存在，将跳过'] });
      } else {
        valid.push({ rowNum: rowNumber, data, status: 'valid' });
        existingPlates.add(data.plateNo);
      }
    });

    return { valid, errors };
  }

  private parseCardSheet(
    sheet: any,
    existingPhones: Set<string>,
    customerValid: PreviewRow[],
  ): { valid: PreviewRow[]; errors: PreviewRow[] } {
    const validPhoneSet = new Set(customerValid.map((r: PreviewRow) => r.data.phone));
    const valid: PreviewRow[] = [];
    const errors: PreviewRow[] = [];

    sheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return;

      const data = {
        customerPhone: String(row.getCell(1).value || '').trim(),
        cardNo: String(row.getCell(2).value || '').trim(),
        balance: String(row.getCell(3).value || '').trim(),
        giftAmount: String(row.getCell(4).value || '0').trim(),
        openDate: String(row.getCell(5).value || '').trim(),
      };

      const rowErrors: string[] = [];

      if (!data.customerPhone || !/^\d{11}$/.test(data.customerPhone)) {
        rowErrors.push('客户手机号必须为11位数字');
      }

      if (!AMOUNT_RE.test(data.balance)) {
        rowErrors.push('当前余额格式不正确，支持格式：0、0.00、123、123.45');
      }

      if (!AMOUNT_RE.test(data.giftAmount || '0')) {
        rowErrors.push('赠送金额格式不正确，支持格式：0、0.00、123、123.45');
      }

      const balanceCents = amountToCents(data.balance);
      const giftCents = amountToCents(data.giftAmount || '0');

      if (!isNaN(balanceCents) && !isNaN(giftCents) && giftCents > balanceCents) {
        rowErrors.push('赠送金额不能超过当前余额');
      }

      if (data.customerPhone && !existingPhones.has(data.customerPhone) && !validPhoneSet.has(data.customerPhone)) {
        rowErrors.push('客户手机号不存在（请先在客户Sheet中导入该手机号）');
      }

      if (rowErrors.length > 0) {
        errors.push({ rowNum: rowNumber, data, errors: rowErrors, status: 'error' });
        return;
      }

      valid.push({ rowNum: rowNumber, data, status: 'valid' });
    });

    return { valid, errors };
  }

  async execute(
    fileBuffer: Buffer | ArrayBuffer,
    previewResult: PreviewResult,
    user: JwtPayload,
  ): Promise<{ customers: number; vehicles: number; storedValueCards: number }> {
    const validCustomers = previewResult.customers.valid.filter((r: PreviewRow) => r.status === 'valid');
    const validVehicles = previewResult.vehicles.valid.filter((r: PreviewRow) => r.status === 'valid');
    const validCards = previewResult.storedValueCards.valid.filter((r: PreviewRow) => r.status === 'valid');

    if (validCustomers.length === 0 && validVehicles.length === 0 && validCards.length === 0) {
      throw new BadRequestException('没有需要导入的有效数据');
    }

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let customersCreated = 0;
      let vehiclesCreated = 0;
      let cardsCreated = 0;

      // 1. 导入客户
      const phoneToIdMap = new Map<string, string>();

      for (const row of validCustomers) {
        const existing = await tx.customer.findFirst({
          where: { tenantId: user.tenantId!, phone: row.data.phone },
        });
        if (existing) {
          phoneToIdMap.set(row.data.phone, existing.id);
          continue;
        }

        const customer = await tx.customer.create({
          data: {
            tenantId: user.tenantId!,
            name: row.data.name,
            phone: row.data.phone,
            remark: row.data.remark || null,
          },
        });
        phoneToIdMap.set(row.data.phone, customer.id);
        customersCreated++;
      }

      // 查询已存在的客户
      const existingCustomers = (await tx.customer.findMany({
        where: { tenantId: user.tenantId! },
        select: { id: true, phone: true },
      })) as CustomerIdPhoneRecord[];
      for (const c of existingCustomers) {
        if (!phoneToIdMap.has(c.phone)) {
          phoneToIdMap.set(c.phone, c.id);
        }
      }

      // 2. 导入车辆
      for (const row of validVehicles) {
        const plateNo = row.data.plateNo.toUpperCase();
        const customerId = phoneToIdMap.get(row.data.customerPhone);
        if (!customerId) {
          this.logger.warn(`车辆导入跳过：手机号 ${row.data.customerPhone} 对应客户不存在`);
          continue;
        }

        const existing = await tx.vehicle.findFirst({
          where: { tenantId: user.tenantId!, plateNo },
        });
        if (existing) continue;

        await tx.vehicle.create({
          data: {
            tenantId: user.tenantId!,
            customerId,
            plateNo,
            brand: row.data.brand || null,
            model: row.data.model || null,
            vin: row.data.vin || null,
            mileage: row.data.mileage ? parseInt(row.data.mileage) : null,
          },
        });
        vehiclesCreated++;
      }

      // 3. 导入储值卡
      for (const row of validCards) {
        const customerId = phoneToIdMap.get(row.data.customerPhone);
        if (!customerId) {
          this.logger.warn(`储值卡导入跳过：手机号 ${row.data.customerPhone} 对应客户不存在`);
          continue;
        }

        const balanceCents = amountToCents(row.data.balance);
        const giftCents = amountToCents(row.data.giftAmount || '0');
        const balance = centsToAmount(balanceCents);
        const giftAmount = centsToAmount(giftCents);
        const principal = centsToAmount(balanceCents - giftCents);

        const cardNo = row.data.cardNo || `SVC${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

        const card = await tx.storedValueCard.create({
          data: {
            tenantId: user.tenantId!,
            cardNo,
            customerId,
            balance,
            principalBalance: principal,
            giftBalance: giftAmount,
            remark: '数据导入',
          },
        });

        await tx.storedValueTransaction.create({
          data: {
            tenantId: user.tenantId!,
            cardId: card.id,
            type: 'import',
            amount: balance,
            principal: principal,
            gift: giftAmount,
            balanceAfter: balance,
            operatorId: user.sub,
            remark: '数据导入初始余额',
          },
        });

        cardsCreated++;
      }

      // 4. 写入审计日志
      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId!,
          userId: user.sub,
          action: 'data_import',
          targetType: 'data_import',
          changes: {
            customers: customersCreated,
            vehicles: vehiclesCreated,
            storedValueCards: cardsCreated,
          },
        },
      });

      return { customers: customersCreated, vehicles: vehiclesCreated, storedValueCards: cardsCreated };
    });

    this.logger.log(`数据导入完成: 客户${result.customers}条, 车辆${result.vehicles}条, 储值卡${result.storedValueCards}条`);
    return result;
  }
}
