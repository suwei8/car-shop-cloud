import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlatformTenantService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { page?: number; pageSize?: number; status?: string }) {
    const { page = 1, pageSize = 20, status } = query;
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { subscriptions: { include: { plan: true }, take: 1 } },
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        subscriptions: { include: { plan: true } },
        featureFlags: { include: { featureFlag: true } },
      },
    });
    if (!tenant) throw new NotFoundException('商户不存在');
    return tenant;
  }

  async create(data: { name: string; contactName?: string; contactPhone?: string }) {
    return this.prisma.tenant.create({ data });
  }

  async update(id: string, data: { name?: string; contactName?: string; contactPhone?: string; status?: string }) {
    await this.findOne(id);
    return this.prisma.tenant.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'suspended' },
    });
  }
}
