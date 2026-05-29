import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class PrintService {
  constructor(private prisma: PrismaService) {}

  // 获取工单打印数据
  async getWorkOrderPrintData(workOrderId: string, user: JwtPayload) {
    const order = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId: user.tenantId! },
      include: {
        customer: true,
        vehicle: true,
        items: true,
        inspections: true,
      },
    });
    if (!order) throw new NotFoundException('工单不存在');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId! },
    });

    const shop = await this.prisma.shop.findFirst({
      where: { id: order.shopId, tenantId: user.tenantId! },
    });

    return {
      tenant: { name: tenant?.name, phone: tenant?.contactPhone },
      shop: { name: shop?.name, address: shop?.address, phone: shop?.phone },
      order: {
        orderNo: order.orderNo,
        orderType: order.orderType,
        status: order.status,
        createdAt: order.createdAt,
        description: order.description,
        vehiclePlateNo: order.vehiclePlateNo,
        vehicleMileage: order.vehicleMileage,
      },
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
      },
      vehicle: {
        plateNo: order.vehicle.plateNo,
        brand: order.vehicle.brand,
        model: order.vehicle.model,
        vin: order.vehicle.vin,
        color: order.vehicle.color,
      },
      items: order.items.map(item => ({
        name: item.name,
        itemType: item.itemType,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        amount: Number(item.amount),
      })),
      inspections: order.inspections.map(insp => ({
        category: insp.category,
        item: insp.item,
        condition: insp.condition,
        note: insp.note,
      })),
      summary: {
        totalAmount: Number(order.totalAmount),
        discountAmount: Number(order.discountAmount),
        payableAmount: Number(order.payableAmount),
      },
    };
  }

  // 获取结算单打印数据
  async getSettlementPrintData(settlementId: string, user: JwtPayload) {
    const settlement = await this.prisma.settlement.findFirst({
      where: { id: settlementId, tenantId: user.tenantId! },
      include: { payments: true },
    });
    if (!settlement) throw new NotFoundException('结算单不存在');

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: settlement.workOrderId, tenantId: user.tenantId! },
      include: {
        customer: true,
        vehicle: true,
        items: true,
      },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId! },
    });

    const shop = await this.prisma.shop.findFirst({
      where: { id: settlement.shopId, tenantId: user.tenantId! },
    });

    const payMethodMap: Record<string, string> = {
      cash: '现金', wechat: '微信', alipay: '支付宝', card: '银行卡',
      stored_value: '储值卡', package_card: '套餐卡',
    };

    return {
      tenant: { name: tenant?.name },
      shop: { name: shop?.name, address: shop?.address, phone: shop?.phone },
      settlement: {
        settleNo: settlement.settleNo,
        createdAt: settlement.createdAt,
        totalAmount: Number(settlement.totalAmount),
        discountAmount: Number(settlement.discountAmount),
        payableAmount: Number(settlement.payableAmount),
        paidAmount: Number(settlement.paidAmount),
        debtAmount: Number(settlement.debtAmount),
      },
      customer: workOrder ? {
        name: workOrder.customer.name,
        phone: workOrder.customer.phone,
      } : null,
      vehicle: workOrder ? {
        plateNo: workOrder.vehicle.plateNo,
        brand: workOrder.vehicle.brand,
        model: workOrder.vehicle.model,
      } : null,
      items: workOrder?.items.map(item => ({
        name: item.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        amount: Number(item.amount),
      })) || [],
      payments: settlement.payments.map(p => ({
        method: payMethodMap[p.payMethod] || p.payMethod,
        amount: Number(p.amount),
        referenceNo: p.referenceNo,
      })),
    };
  }
}
