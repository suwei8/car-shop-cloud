import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class AppointmentService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: { page?: number; pageSize?: number; status?: string; shopId?: string; date?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, status, shopId, date } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where: any = { tenantId: user.tenantId! };

    if (status) where.status = status;
    if (shopId) where.shopId = shopId;
    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      where.appointTime = { gte: d, lt: nextDay };
    }

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { appointTime: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          vehicle: { select: { id: true, plateNo: true, brand: true, model: true } },
        },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string, user: JwtPayload) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: {
        customer: true,
        vehicle: true,
      },
    });
    if (!appointment) throw new NotFoundException('预约不存在');
    return appointment;
  }

  async create(data: {
    shopId: string; customerId: string; vehicleId?: string;
    serviceType: string; appointTime: string; description?: string; remark?: string;
  }, user: JwtPayload) {
    return this.prisma.appointment.create({
      data: {
        tenantId: user.tenantId!,
        shopId: data.shopId,
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        serviceType: data.serviceType,
        appointTime: new Date(data.appointTime),
        description: data.description,
        remark: data.remark,
      },
    });
  }

  async updateStatus(id: string, status: string, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.appointment.update({
      where: { id },
      data: { status },
    });
  }
}
