import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class VehicleService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: { page?: number; pageSize?: number; keyword?: string; customerId?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, keyword, customerId } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where: any = { tenantId: user.tenantId!, status: 'active' };

    if (customerId) where.customerId = customerId;
    if (keyword) {
      where.OR = [
        { plateNo: { contains: keyword, mode: 'insensitive' } },
        { vin: { contains: keyword, mode: 'insensitive' } },
        { customer: { name: { contains: keyword, mode: 'insensitive' } } },
        { customer: { phone: { contains: keyword } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { id: true, name: true, phone: true } } },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string, user: JwtPayload) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: { customer: true },
    });
    if (!vehicle) throw new NotFoundException('车辆不存在');
    return vehicle;
  }

  async create(data: {
    customerId: string; plateNo: string; brand?: string; model?: string;
    vin?: string; engineNo?: string; color?: string; mileage?: number;
    firstRegDate?: string; remark?: string;
  }, user: JwtPayload) {
    const existing = await this.prisma.vehicle.findFirst({
      where: { tenantId: user.tenantId!, plateNo: data.plateNo, status: 'active' },
    });
    if (existing) throw new ConflictException('该车牌号已存在');

    return this.prisma.vehicle.create({
      data: {
        ...data,
        tenantId: user.tenantId!,
        firstRegDate: data.firstRegDate ? new Date(data.firstRegDate) : undefined,
      },
      include: { customer: true },
    });
  }

  async update(id: string, data: {
    plateNo?: string; brand?: string; model?: string;
    vin?: string; engineNo?: string; color?: string; mileage?: number;
    firstRegDate?: string; remark?: string;
  }, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...data,
        firstRegDate: data.firstRegDate ? new Date(data.firstRegDate) : undefined,
      },
    });
  }

  async search(user: JwtPayload, keyword: string) {
    return this.prisma.vehicle.findMany({
      where: {
        tenantId: user.tenantId!,
        status: 'active',
        OR: [
          { plateNo: { contains: keyword, mode: 'insensitive' } },
          { vin: { contains: keyword, mode: 'insensitive' } },
          { customer: { phone: { contains: keyword } } },
        ],
      },
      include: { customer: { select: { id: true, name: true, phone: true } } },
      take: 10,
    });
  }

  // 车型库：从已有车辆中提取品牌/车系/年份/车型选项
  async getModelLibrary(user: JwtPayload) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { tenantId: user.tenantId!, status: 'active', model: { not: null } },
      select: { model: true },
    });

    const brands = new Set<string>();
    const seriesMap = new Map<string, Set<string>>();
    const yearMap = new Map<string, Set<string>>();
    const detailMap = new Map<string, Set<string>>();

    for (const v of vehicles) {
      if (!v.model) continue;
      const parts = v.model.split('/');
      const brand = parts[0]?.trim();
      const series = parts[1]?.trim();
      const year = parts[2]?.trim();
      const detail = parts[3]?.trim();

      if (brand) {
        brands.add(brand);
        if (series) {
          const key = brand;
          if (!seriesMap.has(key)) seriesMap.set(key, new Set());
          seriesMap.get(key)!.add(series);
          if (year) {
            const sKey = `${brand}/${series}`;
            if (!yearMap.has(sKey)) yearMap.set(sKey, new Set());
            yearMap.get(sKey)!.add(year);
            if (detail) {
              const yKey = `${brand}/${series}/${year}`;
              if (!detailMap.has(yKey)) detailMap.set(yKey, new Set());
              detailMap.get(yKey)!.add(detail);
            }
          }
        }
      }
    }

    const toObj = (m: Map<string, Set<string>>) => {
      const obj: Record<string, string[]> = {};
      for (const [k, v] of m) obj[k] = [...v].sort();
      return obj;
    };

    return {
      brands: [...brands].sort(),
      series: toObj(seriesMap),
      years: toObj(yearMap),
      details: toObj(detailMap),
    };
  }
}
