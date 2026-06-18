import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';
import { applyDataScope } from '../../common/utils/scope-where';

interface ReminderListRecord {
  vehicleId: string | null;
  [key: string]: unknown;
}

interface VehiclePlateRecord {
  id: string;
  plateNo: string;
}

@Injectable()
export class ReminderService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    user: JwtPayload,
    query: { status?: string; type?: string; dueDate?: string; page?: number; pageSize?: number },
  ) {
    const tenantId = user.tenantId!;
    const { status, type, dueDate, page = 1, pageSize = 20 } = query;

    const baseWhere: any = { tenantId };
    if (status) baseWhere.status = status;
    if (type) baseWhere.type = type;
    if (dueDate) {
      const d = new Date(dueDate);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      baseWhere.dueDate = { gte: d, lt: next };
    }

    const where = applyDataScope(user, baseWhere, 'shopId');

    const [total, items] = await Promise.all([
      this.prisma.reminder.count({ where }),
      this.prisma.reminder.findMany({
        where,
        orderBy: { dueDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
      }),
    ]);

    const typedItems = items as ReminderListRecord[];
    const vehicleIds = typedItems.map((r: ReminderListRecord) => r.vehicleId).filter(Boolean) as string[];
    const vehicles = vehicleIds.length
      ? ((await this.prisma.vehicle.findMany({
          where: { id: { in: vehicleIds } },
          select: { id: true, plateNo: true },
        })) as VehiclePlateRecord[])
      : [];
    const vehicleMap = new Map(vehicles.map((v: VehiclePlateRecord) => [v.id, v.plateNo]));

    return {
      total,
      page,
      pageSize,
      items: typedItems.map((r: ReminderListRecord) => ({
        ...r,
        vehiclePlateNo: r.vehicleId ? vehicleMap.get(r.vehicleId) || null : null,
      })),
    };
  }

  async handle(user: JwtPayload, id: string, body: { status: 'done' | 'ignored'; remark?: string }) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!reminder) throw new NotFoundException('提醒不存在');

    return this.prisma.reminder.update({
      where: { id },
      data: {
        status: body.status,
        handledBy: user.sub,
        handledAt: new Date(),
        remark: body.remark,
      },
    });
  }

  async countPending(user: JwtPayload) {
    const tenantId = user.tenantId!;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const baseWhere: any = { tenantId, status: 'pending', dueDate: { gte: startOfDay, lt: endOfDay } };
    const where = applyDataScope(user, baseWhere, 'shopId');
    return this.prisma.reminder.count({ where });
  }
}
