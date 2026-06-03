import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class SupplierService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: { keyword?: string }) {
    const where: any = { tenantId: user.tenantId!, status: 'active' };
    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword, mode: 'insensitive' } },
        { contactName: { contains: query.keyword, mode: 'insensitive' } },
        { phone: { contains: query.keyword } },
      ];
    }
    return this.prisma.supplier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { parts: true } } },
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: { parts: { where: { status: 'active' }, select: { id: true, code: true, name: true } } },
    });
    if (!supplier) throw new NotFoundException('供货商不存在');
    return supplier;
  }

  async create(data: { name: string; contactName?: string; phone?: string; address?: string; remark?: string }, user: JwtPayload) {
    return this.prisma.supplier.create({
      data: { ...data, tenantId: user.tenantId! },
    });
  }

  async update(id: string, data: { name?: string; contactName?: string; phone?: string; address?: string; remark?: string }, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.supplier.update({ where: { id, tenantId: user.tenantId! }, data });
  }

  async remove(id: string, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.supplier.update({
      where: { id, tenantId: user.tenantId! },
      data: { status: 'inactive' },
    });
  }
}
