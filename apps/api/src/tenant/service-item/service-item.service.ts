import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class ServiceItemService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: { category?: string; keyword?: string }) {
    const { category, keyword } = query;
    const where: any = { tenantId: user.tenantId!, status: 'active' };

    if (category) where.category = category;
    if (keyword) {
      where.name = { contains: keyword, mode: 'insensitive' };
    }

    return this.prisma.serviceItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const item = await this.prisma.serviceItem.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!item) throw new NotFoundException('服务项目不存在');
    return item;
  }

  async create(data: {
    name: string; category: string; unit?: string;
    unitPrice: number; description?: string;
  }, user: JwtPayload) {
    return this.prisma.serviceItem.create({
      data: { ...data, tenantId: user.tenantId! },
    });
  }

  async update(id: string, data: {
    name?: string; category?: string; unit?: string;
    unitPrice?: number; description?: string;
  }, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.serviceItem.update({ where: { id }, data });
  }

  async remove(id: string, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.serviceItem.update({
      where: { id },
      data: { status: 'inactive' },
    });
  }
}
