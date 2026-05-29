import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class SystemParameterService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, group?: string) {
    const where: any = { tenantId: user.tenantId! };
    if (group) where.group = group;
    return this.prisma.systemParameter.findMany({ where, orderBy: { group: 'asc' } });
  }

  async upsert(data: { group: string; key: string; value: string; remark?: string }, user: JwtPayload) {
    return this.prisma.systemParameter.upsert({
      where: { tenantId_group_key: { tenantId: user.tenantId!, group: data.group, key: data.key } },
      update: { value: data.value, remark: data.remark },
      create: { ...data, tenantId: user.tenantId! },
    });
  }
}
