import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    tenantId?: string;
    userId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    changes?: any;
    ip?: string;
  }) {
    return this.prisma.auditLog.create({ data });
  }

  async findAll(tenantId: string, query: {
    page?: number;
    pageSize?: number;
    targetType?: string;
    action?: string;
    userId?: string;
  }) {
    const { page = 1, pageSize = 20, targetType, action, userId } = query;
    const where: any = { tenantId };
    if (targetType) where.targetType = targetType;
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
