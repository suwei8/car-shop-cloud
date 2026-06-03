import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class InspectionService {
  constructor(private prisma: PrismaService) {}

  async findByWorkOrder(workOrderId: string, user: JwtPayload) {
    return this.prisma.inspectionRecord.findMany({
      where: { workOrderId, tenantId: user.tenantId! },
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(data: {
    workOrderId: string; category: string; item: string;
    condition: string; note?: string; photoUrl?: string;
  }, user: JwtPayload) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: data.workOrderId, tenantId: user.tenantId! },
    });
    if (!workOrder) throw new NotFoundException('工单不存在');

    return this.prisma.inspectionRecord.create({
      data: { ...data, tenantId: user.tenantId! },
    });
  }

  async batchCreate(workOrderId: string, records: {
    category: string; item: string; condition: string; note?: string;
  }[], user: JwtPayload) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId: user.tenantId! },
    });
    if (!workOrder) throw new NotFoundException('工单不存在');

    return this.prisma.inspectionRecord.createMany({
      data: records.map(r => ({ ...r, workOrderId, tenantId: user.tenantId! })),
    });
  }

  async update(id: string, data: {
    condition?: string; note?: string; photoUrl?: string;
  }, user: JwtPayload) {
    const record = await this.prisma.inspectionRecord.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!record) throw new NotFoundException('检查记录不存在');

    return this.prisma.inspectionRecord.update({ where: { id, tenantId: user.tenantId! }, data });
  }

  async remove(id: string, user: JwtPayload) {
    const record = await this.prisma.inspectionRecord.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!record) throw new NotFoundException('检查记录不存在');

    return this.prisma.inspectionRecord.delete({ where: { id, tenantId: user.tenantId! } });
  }
}
