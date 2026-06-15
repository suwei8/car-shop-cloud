import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: { page?: number; pageSize?: number; shopId?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, shopId } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where: any = { tenantId: user.tenantId! };
    if (shopId) where.employee = { shopId };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, phone: true, status: true, createdAt: true,
          employee: { select: { id: true, shopId: true, position: true, shop: { select: { name: true } } } },
          userRoles: { select: { role: { select: { id: true, name: true, code: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string, user: JwtPayload) {
    const u = await this.prisma.user.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: {
        employee: { include: { shop: true } },
        userRoles: { include: { role: true } },
      },
    });
    if (!u) throw new NotFoundException('员工不存在');
    return u;
  }

  async create(data: {
    name: string; phone: string; password: string;
    shopId: string; position?: string; roleIds: string[];
  }, user: JwtPayload) {
    // 检查手机号重复
    const existing = await this.prisma.user.findFirst({
      where: { tenantId: user.tenantId!, phone: data.phone },
    });
    if (existing) throw new ConflictException('手机号已存在');

    // 检查套餐员工数限制
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId! },
      include: {
        subscriptions: {
          include: { plan: true },
          where: { status: { in: ['active', 'trial'] }, endAt: { gte: new Date() } },
          take: 1,
        },
      },
    });
    const maxEmployees = tenant?.subscriptions[0]?.plan?.maxEmployees || 5;
    const currentCount = await this.prisma.user.count({
      where: { tenantId: user.tenantId!, isPlatform: false, status: 'active' },
    });
    if (currentCount >= maxEmployees) {
      throw new ForbiddenException(`已达员工数量上限(${maxEmployees})，请升级套餐`);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          tenantId: user.tenantId!,
          phone: data.phone,
          passwordHash,
          name: data.name,
        },
      });

      await tx.employee.create({
        data: {
          userId: newUser.id,
          tenantId: user.tenantId!,
          shopId: data.shopId,
          position: data.position,
        },
      });

      for (const roleId of data.roleIds) {
        await tx.userRole.create({
          data: { userId: newUser.id, roleId },
        });
      }

      return newUser;
    });
  }

  async update(id: string, data: {
    name?: string; phone?: string; password?: string;
    shopId?: string; position?: string; roleIds?: string[];
  }, user: JwtPayload) {
    const existing = await this.findOne(id, user);

    // 检查手机号重复（排除自己）
    if (data.phone && data.phone !== existing.phone) {
      const dup = await this.prisma.user.findFirst({
        where: { tenantId: user.tenantId!, phone: data.phone, id: { not: id } },
      });
      if (dup) throw new ConflictException('手机号已存在');
    }

    return this.prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.phone) updateData.phone = data.phone;
      if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 10);

      await tx.user.update({ where: { id, tenantId: user.tenantId! }, data: updateData });

      if (data.shopId || data.position !== undefined) {
        await tx.employee.update({
          where: { userId: id, tenantId: user.tenantId! },
          data: {
            ...(data.shopId && { shopId: data.shopId }),
            ...(data.position !== undefined && { position: data.position }),
          },
        });
      }

      if (data.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        for (const roleId of data.roleIds) {
          await tx.userRole.create({ data: { userId: id, roleId } });
        }
      }

      return this.findOne(id, user);
    });
  }

  async updateStatus(id: string, status: string, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.user.update({ where: { id, tenantId: user.tenantId! }, data: { status } });
  }
}
