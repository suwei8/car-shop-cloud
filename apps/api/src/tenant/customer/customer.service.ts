import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: { page?: number; pageSize?: number; keyword?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, keyword } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where: any = { tenantId: user.tenantId!, status: 'active' };

    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { phone: { contains: keyword } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { vehicles: { where: { status: 'active' }, take: 5 } },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string, user: JwtPayload) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: { vehicles: { where: { status: 'active' } } },
    });
    if (!customer) throw new NotFoundException('客户不存在');
    return customer;
  }

  async create(data: { name: string; phone: string; gender?: string; email?: string; address?: string; remark?: string }, user: JwtPayload) {
    const existing = await this.prisma.customer.findFirst({
      where: { tenantId: user.tenantId!, phone: data.phone, status: 'active' },
    });
    if (existing) throw new ConflictException('该手机号客户已存在');

    return this.prisma.customer.create({
      data: { ...data, tenantId: user.tenantId! },
    });
  }

  async update(id: string, data: { name?: string; phone?: string; gender?: string; email?: string; address?: string; remark?: string }, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.customer.update({ where: { id }, data });
  }

  async search(user: JwtPayload, keyword: string) {
    return this.prisma.customer.findMany({
      where: {
        tenantId: user.tenantId!,
        status: 'active',
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { phone: { contains: keyword } },
          { vehicles: { some: { plateNo: { contains: keyword, mode: 'insensitive' } } } },
        ],
      },
      include: { vehicles: { where: { status: 'active' }, take: 3 } },
      take: 10,
    });
  }
}
