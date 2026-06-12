import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class DispatchService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: { page?: number; pageSize?: number; status?: string; technicianId?: string; workOrderId?: string }) {
    const { page: _p = 1, pageSize: _ps = 20, status, technicianId, workOrderId } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where: any = { tenantId: user.tenantId! };

    if (status) where.status = status;
    if (technicianId) where.technicianId = technicianId;
    if (workOrderId) where.workOrderId = workOrderId;

    const scope = user.dataScope || 'shop';
    if (!user.isPlatform) {
      if (scope === 'shop' && user.shopId) {
        where.workOrder = { shopId: user.shopId };
      } else if (scope === 'self') {
        where.technicianId = user.sub;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.dispatchTask.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          workOrder: {
            select: { id: true, orderNo: true, orderType: true, vehiclePlateNo: true, status: true },
          },
        },
      }),
      this.prisma.dispatchTask.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string, user: JwtPayload) {
    const task = await this.prisma.dispatchTask.findFirst({
      where: { id, tenantId: user.tenantId! },
      include: {
        workOrder: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            vehicle: { select: { id: true, plateNo: true, brand: true, model: true } },
            items: true,
          },
        },
      },
    });
    if (!task) throw new NotFoundException('派工任务不存在');
    return task;
  }

  async create(data: {
    workOrderId: string; technicianId: string; itemIds?: string[]; remark?: string;
    workPlace?: string; team?: string; assistantIds?: string;
  }, user: JwtPayload) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: data.workOrderId, tenantId: user.tenantId! },
    });
    if (!workOrder) throw new NotFoundException('工单不存在');
    if (!['confirmed', 'dispatching'].includes(workOrder.status)) {
      throw new ForbiddenException('当前工单状态不允许派工');
    }

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.dispatchTask.create({
        data: {
          tenantId: user.tenantId!,
          workOrderId: data.workOrderId,
          technicianId: data.technicianId,
          itemIds: data.itemIds ? JSON.stringify(data.itemIds) : null,
          workPlace: data.workPlace,
          team: data.team,
          assistantIds: data.assistantIds,
          remark: data.remark,
        },
      });

      await tx.workOrder.update({
        where: { id: data.workOrderId, tenantId: user.tenantId! },
        data: { status: 'dispatching' },
      });

      return task;
    });
  }

  async start(id: string, user: JwtPayload) {
    const task = await this.findOne(id, user);
    if (task.status !== 'pending') throw new ForbiddenException('只能开始待处理的任务');

    return this.prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: task.workOrderId, tenantId: user.tenantId! },
        data: { status: 'in_progress' },
      });

      return tx.dispatchTask.update({
        where: { id, tenantId: user.tenantId! },
        data: { status: 'in_progress', startAt: new Date() },
      });
    });
  }

  async pause(id: string, user: JwtPayload) {
    const task = await this.findOne(id, user);
    if (task.status !== 'in_progress') throw new ForbiddenException('只能暂停进行中的任务');

    return this.prisma.dispatchTask.update({
      where: { id },
      data: { status: 'paused' },
    });
  }

  async complete(id: string, user: JwtPayload) {
    const task = await this.findOne(id, user);
    if (!['in_progress', 'paused'].includes(task.status)) {
      throw new ForbiddenException('只能完成进行中或已暂停的任务');
    }

    return this.prisma.$transaction(async (tx) => {
      const allTasks = await tx.dispatchTask.findMany({
        where: { workOrderId: task.workOrderId, tenantId: user.tenantId! },
      });

      const updatedTask = await tx.dispatchTask.update({
        where: { id, tenantId: user.tenantId! },
        data: { status: 'completed', endAt: new Date() },
      });

      const allCompleted = allTasks.every(t => t.id === id || t.status === 'completed');
      if (allCompleted) {
        await tx.workOrder.update({
          where: { id: task.workOrderId, tenantId: user.tenantId! },
          data: { status: 'completed' },
        });
      }

      return updatedTask;
    });
  }

  async getMyTasks(user: JwtPayload, query: { status?: string }) {
    const where: any = {
      tenantId: user.tenantId!,
      technicianId: user.sub,
    };
    if (query.status) where.status = query.status;

    return this.prisma.dispatchTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        workOrder: {
          select: { id: true, orderNo: true, orderType: true, vehiclePlateNo: true, description: true },
        },
      },
    });
  }

  async uploadPhoto(id: string, data: { fileUrl: string; originalName?: string }, user: JwtPayload) {
    const task = await this.findOne(id, user);

    // 1. 创建文件关联记录
    await this.prisma.file.create({
      data: {
        tenantId: user.tenantId!,
        uploadedBy: user.sub,
        originalName: data.originalName || 'construction_photo.jpg',
        fileName: data.fileUrl.split('/').pop() || 'construction_photo.jpg',
        mimeType: 'image/jpeg',
        size: 0,
        url: data.fileUrl,
        source: 'mobile',
        businessType: 'dispatch-task',
        businessId: id,
      },
    });

    // 2. 联动车间状态：如果派工状态为待处理 (pending)，上传照片即视为开工
    if (task.status === 'pending') {
      await this.start(id, user);
    }

    return { success: true };
  }
}

