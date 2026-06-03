import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class ShopService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload) {
    return this.prisma.shop.findMany({
      where: { tenantId: user.tenantId!, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const shop = await this.prisma.shop.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!shop) throw new NotFoundException('门店不存在');
    return shop;
  }

  async create(data: { name: string; address?: string; phone?: string }, user: JwtPayload) {
    // 检查套餐限制
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId! },
      include: { subscriptions: { include: { plan: true }, where: { status: 'active' }, take: 1 } },
    });
    const maxShops = tenant?.subscriptions[0]?.plan?.maxShops || 1;
    const currentCount = await this.prisma.shop.count({
      where: { tenantId: user.tenantId!, status: 'active' },
    });
    if (currentCount >= maxShops) {
      throw new ForbiddenException(`已达门店数量上限(${maxShops})，请升级套餐`);
    }

    return this.prisma.shop.create({
      data: { ...data, tenantId: user.tenantId! },
    });
  }

  async update(id: string, data: { name?: string; address?: string; phone?: string; status?: string }, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.shop.update({ where: { id, tenantId: user.tenantId! }, data });
  }
}
