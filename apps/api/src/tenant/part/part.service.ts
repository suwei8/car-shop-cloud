import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class PartService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: { page?: number; pageSize?: number; keyword?: string; category?: string; supplierId?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, keyword, category, supplierId } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where: any = { tenantId: user.tenantId!, status: 'active' };

    if (category) where.category = category;
    if (supplierId) where.supplierId = supplierId;
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { code: { contains: keyword, mode: 'insensitive' } },
        { brand: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.part.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { supplier: { select: { id: true, name: true } } },
      }),
      this.prisma.part.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string, user: JwtPayload) {
    const part = await this.prisma.part.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: { supplier: true },
    });
    if (!part) throw new NotFoundException('配件不存在');
    return part;
  }

  async create(data: {
    code: string; name: string; category?: string; brand?: string;
    supplierId?: string; warrantyMonths?: number;
    unit?: string; costPrice?: number; salePrice?: number; minStock?: number; remark?: string;
  }, user: JwtPayload) {
    const existing = await this.prisma.part.findFirst({
      where: { tenantId: user.tenantId!, code: data.code },
    });
    if (existing) throw new ConflictException('配件编码已存在');

    return this.prisma.part.create({
      data: { ...data, tenantId: user.tenantId! },
      include: { supplier: true },
    });
  }

  async update(id: string, data: {
    name?: string; category?: string; brand?: string;
    supplierId?: string; warrantyMonths?: number;
    unit?: string; costPrice?: number; salePrice?: number; minStock?: number; remark?: string;
  }, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.part.update({
      where: { id, tenantId: user.tenantId! },
      data,
      include: { supplier: true },
    });
  }

  async remove(id: string, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.part.update({
      where: { id, tenantId: user.tenantId! },
      data: { status: 'inactive' },
    });
  }
}
