import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionService {
  constructor(private prisma: PrismaService) {}

  async findAll(module?: string) {
    const where = module ? { module } : {};
    return this.prisma.permission.findMany({
      where,
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
  }

  async findByModules() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
    const grouped: Record<string, typeof permissions> = {};
    for (const p of permissions) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }
    return grouped;
  }
}
