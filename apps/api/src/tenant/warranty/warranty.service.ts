import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class WarrantyService {
  constructor(private prisma: PrismaService) {}

  /**
   * 查询车辆已换配件的质保状态
   * @param vehicleId 车辆 ID
   * @param user JWT 载荷（租户隔离）
   */
  async getWarrantyByVehicle(vehicleId: string, user: JwtPayload) {
    const items = await this.prisma.workOrderItem.findMany({
      where: {
        tenantId: user.tenantId!,
        workOrder: { vehicleId, status: { notIn: ['cancelled'] } },
        itemType: 'part',
        partId: { not: null },
        warrantyUntil: { not: null },
      },
      select: {
        id: true,
        name: true,
        quantity: true,
        warrantyMonths: true,
        warrantyUntil: true,
        supplierId: true,
        part: { select: { id: true, code: true, name: true } },
        workOrder: {
          select: {
            id: true,
            orderNo: true,
            createdAt: true,
            vehicle: { select: { id: true, plateNo: true } },
          },
        },
      },
      orderBy: { workOrder: { createdAt: 'desc' } },
    });

    const now = new Date();
    return items.map(item => ({
      id: item.id,
      partCode: item.part?.code,
      partName: item.part?.name || item.name,
      quantity: Number(item.quantity),
      warrantyMonths: item.warrantyMonths,
      warrantyUntil: item.warrantyUntil,
      isUnderWarranty: item.warrantyUntil ? item.warrantyUntil > now : false,
      workOrderId: item.workOrder.id,
      workOrderNo: item.workOrder.orderNo,
      installedAt: item.workOrder.createdAt,
      plateNo: item.workOrder.vehicle?.plateNo,
    }));
  }

  /**
   * 查询客户所有车辆已换配件的质保状态
   * @param customerId 客户 ID
   * @param user JWT 载荷（租户隔离）
   */
  async getWarrantyByCustomer(customerId: string, user: JwtPayload) {
    const items = await this.prisma.workOrderItem.findMany({
      where: {
        tenantId: user.tenantId!,
        workOrder: { customerId, status: { notIn: ['cancelled'] } },
        itemType: 'part',
        partId: { not: null },
        warrantyUntil: { not: null },
      },
      select: {
        id: true,
        name: true,
        quantity: true,
        warrantyMonths: true,
        warrantyUntil: true,
        supplierId: true,
        part: { select: { id: true, code: true, name: true } },
        workOrder: {
          select: {
            id: true,
            orderNo: true,
            createdAt: true,
            vehicle: { select: { id: true, plateNo: true } },
          },
        },
      },
      orderBy: { workOrder: { createdAt: 'desc' } },
    });

    const now = new Date();
    return items.map(item => ({
      id: item.id,
      partCode: item.part?.code,
      partName: item.part?.name || item.name,
      quantity: Number(item.quantity),
      warrantyMonths: item.warrantyMonths,
      warrantyUntil: item.warrantyUntil,
      isUnderWarranty: item.warrantyUntil ? item.warrantyUntil > now : false,
      workOrderId: item.workOrder.id,
      workOrderNo: item.workOrder.orderNo,
      installedAt: item.workOrder.createdAt,
      plateNo: item.workOrder.vehicle?.plateNo,
    }));
  }
}
