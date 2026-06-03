import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload) {
    return this.prisma.role.findMany({
      where: { tenantId: user.tenantId! },
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('角色不存在');
    return role;
  }

  async create(data: { name: string; code: string; description?: string; permissionIds: string[] }, user: JwtPayload) {
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          tenantId: user.tenantId!,
          name: data.name,
          code: data.code,
          description: data.description,
        },
      });

      for (const permId of data.permissionIds) {
        await tx.rolePermission.create({
          data: { roleId: role.id, permissionId: permId },
        });
      }

      return role;
    });
  }

  async update(id: string, data: { name?: string; description?: string; permissionIds?: string[] }, user: JwtPayload) {
    const role = await this.findOne(id, user);
    if (role.isBuiltIn) throw new ForbiddenException('内置角色不可编辑');

    return this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id, tenantId: user.tenantId! },
        data: { name: data.name, description: data.description },
      });

      if (data.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        for (const permId of data.permissionIds) {
          await tx.rolePermission.create({
            data: { roleId: id, permissionId: permId },
          });
        }
      }

      return tx.role.findUnique({
        where: { id },
        include: { rolePermissions: { include: { permission: true } } },
      });
    });
  }

  async remove(id: string, user: JwtPayload) {
    const role = await this.findOne(id, user);
    if (role.isBuiltIn) throw new ForbiddenException('内置角色不可删除');
    return this.prisma.role.delete({ where: { id, tenantId: user.tenantId! } });
  }
}
