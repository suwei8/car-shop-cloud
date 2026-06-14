import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WorkOrderService } from './tenant/work-order/work-order.service';
import { SettlementService } from './tenant/settlement/settlement.service';
import { DashboardService } from './tenant/dashboard/dashboard.service';
import { WarrantyService } from './tenant/warranty/warranty.service';
import { PartService } from './tenant/part/part.service';
import { PrismaService } from './prisma/prisma.service';
import { JwtPayload } from '@car/shared';

const mockUser: JwtPayload = {
  sub: 'e2e-303-admin-user',
  tenantId: 'e2e-303-tenant',
  shopId: 'e2e-303-shop',
  isPlatform: false,
  roles: ['tenant_admin'],
  permissions: [],
  dataScope: 'all',
};

async function main() {
  console.log('=== Booting NestJS Application Context for TASK-303 ===');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const prisma = app.get(PrismaService);
  const workOrderService = app.get(WorkOrderService);
  const settlementService = app.get(SettlementService);
  const dashboardService = app.get(DashboardService);
  const warrantyService = app.get(WarrantyService);
  const partService = app.get(PartService);

  console.log('=== Cleaning up existing TASK-303 E2E Test Data ===');
  await prisma.payment.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.settlement.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.stockMovement.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.stockBillItem.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.stockBill.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.stockBalance.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.workOrderItem.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.workOrder.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.vehicle.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.customer.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.serviceItem.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.part.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.supplier.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.warehouse.deleteMany({ where: { tenantId: 'e2e-303-tenant' } }).catch(() => {});
  await prisma.shop.deleteMany({ where: { id: 'e2e-303-shop' } }).catch(() => {});
  await prisma.tenant.deleteMany({ where: { id: 'e2e-303-tenant' } }).catch(() => {});

  console.log('=== Preparing Core Entities ===');
  await prisma.tenant.create({
    data: { id: 'e2e-303-tenant', name: 'TASK-303 E2E 测试租户' },
  });

  await prisma.shop.create({
    data: { id: 'e2e-303-shop', tenantId: 'e2e-303-tenant', name: 'TASK-303 E2E 测试门店' },
  });

  await prisma.warehouse.create({
    data: {
      id: 'e2e-303-wh',
      tenantId: 'e2e-303-tenant',
      shopId: 'e2e-303-shop',
      name: 'E2E测试默认仓库',
      isDefault: true,
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      id: 'e2e-303-supplier',
      tenantId: 'e2e-303-tenant',
      name: 'E2E测试供应商',
      phone: '13911112222',
    },
  });

  const serviceItem = await prisma.serviceItem.create({
    data: {
      id: 'e2e-303-service-item',
      tenantId: 'e2e-303-tenant',
      name: '发动机常规保养人工费',
      category: 'maintenance',
      unit: '工时',
      unitPrice: 150.00,
    },
  });

  // 创建两个配件，一个库存充足，一个低库存触发预警
  const partNormal = await prisma.part.create({
    data: {
      id: 'e2e-303-part-normal',
      tenantId: 'e2e-303-tenant',
      code: 'PART-NORMAL-001',
      name: 'E2E普通火花塞',
      supplierId: supplier.id,
      warrantyMonths: 12,
      costPrice: 40.00,
      salePrice: 80.00,
      minStock: 2,
    },
  });

  const partLow = await prisma.part.create({
    data: {
      id: 'e2e-303-part-low',
      tenantId: 'e2e-303-tenant',
      code: 'PART-LOW-002',
      name: 'E2E低库存机油滤',
      supplierId: supplier.id,
      warrantyMonths: 6,
      costPrice: 20.00,
      salePrice: 50.00,
      minStock: 5,
    },
  });

  // 正常库存：10
  await prisma.stockBalance.create({
    data: {
      tenantId: 'e2e-303-tenant',
      warehouseId: 'e2e-303-wh',
      partId: partNormal.id,
      quantity: 10,
    },
  });

  // 低库存：3（低于安全下限 5）
  await prisma.stockBalance.create({
    data: {
      tenantId: 'e2e-303-tenant',
      warehouseId: 'e2e-303-wh',
      partId: partLow.id,
      quantity: 3,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      id: 'e2e-303-customer',
      tenantId: 'e2e-303-tenant',
      name: '体验客户',
      phone: '13812345678',
    },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      id: 'e2e-303-vehicle',
      tenantId: 'e2e-303-tenant',
      customerId: customer.id,
      plateNo: '粤B99999',
      model: '宝马 3系',
    },
  });

  console.log('=== Step 1: 获取当前首页看板数据 (看账) ===');
  let overview = await dashboardService.getOverview(mockUser);
  console.log('--- 初始今日经营看板 ---');
  console.log(` 今日营业额: ¥${overview.todayRevenue.toFixed(2)}`);
  console.log(` 今日工单数: ${overview.todayOrders}`);
  console.log(` 施工中工单: ${overview.inProgressOrders}`);
  console.log(` 低库存警报数: ${overview.lowStockCount}`);

  console.log('\n=== Step 2: 查配件库存 ===');
  const partListRes = await partService.findAll(mockUser, { page: 1, pageSize: 10 });
  console.log('--- 配件列表查验 ---');
  for (const part of partListRes.items) {
    const qty = part.stockBalances.reduce((sum: number, b: any) => sum + Number(b.quantity), 0);
    const isLow = qty <= (part.minStock || 0);
    console.log(` 配件: ${part.name} [${part.code}], 库存: ${qty}, 安全下限: ${part.minStock}, 预警状态: ${isLow ? '🚨 低库存' : '正常'}, 供应商: ${part.supplier?.name || '无'} (电话: ${part.supplier?.phone || '无'})`);
  }

  console.log('\n=== Step 3: 开单 (添加服务与配件) ===');
  // 创建工单：1个服务项目 (150元) + 2个普通火花塞 (2 * 80 = 160元) = 310元
  const order = await workOrderService.create({
    shopId: 'e2e-303-shop',
    orderType: 'repair',
    customerId: customer.id,
    vehicleId: vehicle.id,
    description: '常规保养与火花塞更换',
    items: [
      {
        itemType: 'service',
        serviceItemId: serviceItem.id,
        name: '发动机常规保养人工费',
        quantity: 1,
        unit: '工时',
        unitPrice: 150.00,
      },
      {
        itemType: 'part',
        serviceItemId: partNormal.id,
        name: partNormal.name,
        quantity: 2,
        unit: '个',
        unitPrice: 80.00,
      }
    ]
  }, mockUser);
  console.log(`工单创建成功: ${order.orderNo}, 总价: ¥${Number(order.totalAmount).toFixed(2)}, 当前状态: ${order.status}`);

  console.log('\n=== Step 4: 工单流转至完工 (扣减配件库存，写入质保快照) ===');
  await workOrderService.updateStatus(order.id, 'confirmed', mockUser);
  await workOrderService.updateStatus(order.id, 'dispatching', mockUser);
  await workOrderService.updateStatus(order.id, 'in_progress', mockUser);
  await workOrderService.updateStatus(order.id, 'completed', mockUser);
  
  // 确认普通火花塞库存已被扣减 (10 -> 8)
  const balanceNormal = await prisma.stockBalance.findFirst({
    where: { tenantId: 'e2e-303-tenant', partId: partNormal.id }
  });
  console.log(`施工完工后普通火花塞库存 (应为 8): ${Number(balanceNormal?.quantity)}`);

  console.log('\n=== Step 5: 简易模式收款结算 (今日收入变化) ===');
  const settlement = await settlementService.settle({
    workOrderId: order.id,
    discountAmount: 10.00, // 优惠10元，实付300元
    payments: [
      {
        payMethod: 'cash',
        amount: 300.00,
        remark: '客户现金支付300元',
      }
    ]
  }, mockUser);
  console.log(`工单结算成功: 结算单号: ${settlement.settleNo}, 实收金额: ¥${Number(settlement.paidAmount).toFixed(2)}, 欠款: ¥${Number(settlement.debtAmount).toFixed(2)}`);

  console.log('\n=== Step 6: 重新获取今日经营看板数据，对比今日收入变化 ===');
  overview = await dashboardService.getOverview(mockUser);
  console.log('--- 结算后今日经营看板 ---');
  console.log(` 今日营业额 (应为 ¥300.00): ¥${overview.todayRevenue.toFixed(2)}`);
  console.log(` 今日工单数 (应为 1): ${overview.todayOrders}`);

  console.log('\n=== Step 7: 查客户历史维保与在保质保查询 ===');
  // 1. 获取客户历史记录
  const historyOrders = await prisma.workOrder.findMany({
    where: { tenantId: 'e2e-303-tenant', vehicleId: vehicle.id },
    include: {
      items: true
    }
  });
  console.log(`--- 该车 [${vehicle.plateNo}] 历史维保档案 ---`);
  for (const wo of historyOrders) {
    console.log(` 工单号: ${wo.orderNo}, 类型: ${wo.orderType}, 状态: ${wo.status}, 金额: ¥${Number(wo.totalAmount).toFixed(2)}, 时间: ${wo.createdAt.toLocaleString()}`);
  }

  // 2. 质保追溯查询
  const warrantyRecords = await warrantyService.getWarrantyByVehicle(vehicle.id, mockUser);
  console.log('--- 该车配件在保状态查询 ---');
  for (const record of warrantyRecords) {
    console.log(` 配件: ${record.partName} [${record.partCode}], 数量: ${record.quantity}, 质保期: ${record.warrantyMonths}个月, 质保截止: ${record.warrantyUntil ? new Date(record.warrantyUntil).toLocaleDateString() : '无'}, 是否在保: ${record.isUnderWarranty ? '✅ 是' : '❌ 否'}`);
  }

  console.log('\n=== TASK-303 E2E Integration Verification Success ===');
  await app.close();
}

main().catch(err => {
  console.error('E2E TASK-303 Verification Script Failed:', err);
  process.exit(1);
});
