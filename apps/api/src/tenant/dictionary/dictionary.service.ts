import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class DictionaryService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, type?: string) {
    const where: any = { tenantId: user.tenantId! };
    if (type) where.type = type;
    return this.prisma.dictionary.findMany({
      where,
      orderBy: [{ type: 'asc' }, { sort: 'asc' }],
    });
  }

  async create(data: { type: string; code: string; name: string; sort?: number }, user: JwtPayload) {
    return this.prisma.dictionary.create({
      data: { ...data, tenantId: user.tenantId! },
    });
  }

  async update(id: string, data: { name?: string; sort?: number; status?: string }, user: JwtPayload) {
    const dict = await this.prisma.dictionary.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!dict) throw new NotFoundException('字典项不存在');
    return this.prisma.dictionary.update({ where: { id, tenantId: user.tenantId! }, data });
  }

  async remove(id: string, user: JwtPayload) {
    const dict = await this.prisma.dictionary.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!dict) throw new NotFoundException('字典项不存在');
    return this.prisma.dictionary.delete({ where: { id, tenantId: user.tenantId! } });
  }
}
