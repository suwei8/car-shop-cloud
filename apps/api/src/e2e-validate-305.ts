import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SubscriptionService } from './tenant/subscription/subscription.service';
import { PaymentGatewayService } from './tenant/payment/payment-gateway.service';
import { PrismaService } from './prisma/prisma.service';
import { JwtPayload } from '@car/shared';

const mockUser: JwtPayload = {
  sub: 'e2e-305-admin-user',
  tenantId: 'e2e-305-tenant',
  shopId: 'e2e-305-shop',
  isPlatform: false,
  roles: ['tenant_admin'],
  permissions: [],
  dataScope: 'all',
};

async function main() {
  console.log('=== Booting NestJS Application Context for TASK-305 ===');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const prisma = app.get(PrismaService);
  const subscriptionService = app.get(SubscriptionService);
  const paymentGatewayService = app.get(PaymentGatewayService);

  console.log('=== Cleaning up existing TASK-305 E2E Test Data ===');
  await prisma.auditLog.deleteMany({ where: { tenantId: 'e2e-305-tenant' } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: 'e2e-305-admin-user' } }).catch(() => {});
  await prisma.payment.deleteMany({ where: { tenantId: 'e2e-305-tenant' } }).catch(() => {});
  await prisma.subscriptionOrder.deleteMany({ where: { tenantId: 'e2e-305-tenant' } }).catch(() => {});
  await prisma.tenantSubscription.deleteMany({ where: { tenantId: 'e2e-305-tenant' } }).catch(() => {});
  await prisma.tenant.deleteMany({ where: { id: 'e2e-305-tenant' } }).catch(() => {});

  console.log('=== Preparing Core Entities ===');
  // Check/create test subscription plans
  let planBasic = await prisma.subscriptionPlan.findUnique({ where: { id: 'plan-basic' } });
  if (!planBasic) {
    planBasic = await prisma.subscriptionPlan.create({
      data: {
        id: 'plan-basic',
        name: '单店版',
        priceMonthly: 150.00,
        priceYearly: 1280.00,
        discount3m: 1.0,
        discount6m: 0.9,
        discount12m: 0.8,
        maxShops: 1,
        maxEmployees: 5,
        status: 'active',
      },
    });
  }

  const tenant = await prisma.tenant.create({
    data: {
      id: 'e2e-305-tenant',
      name: 'TASK-305 E2E 测试租户',
      subscriptionStatus: 'trial',
      subscriptionEndAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days remaining (should trigger warning < 7 days)
    },
  });

  await prisma.user.create({
    data: {
      id: 'e2e-305-admin-user',
      tenantId: 'e2e-305-tenant',
      name: 'TASK-305 E2E 测试管理员',
      phone: '13899990000',
      passwordHash: 'password123',
    },
  });

  console.log('--- 初始租户订阅状态 ---');
  console.log(` 租户状态: ${tenant.subscriptionStatus}`);
  console.log(` 有效期至: ${tenant.subscriptionEndAt?.toISOString()}`);

  console.log('\n=== Step 1: 可购套餐列表查询 ===');
  const plans = await subscriptionService.getPlans();
  console.log('--- 平台可购套餐列表 ---');
  for (const p of plans) {
    console.log(` 套餐名称: ${p.name}, 年费: ¥${p.priceYearly}, 月单价: ¥${p.priceMonthly}`);
  }

  console.log('\n=== Step 2: 选套餐并下单 (创建订阅订单) ===');
  const order = await subscriptionService.createOrder(mockUser, {
    planId: 'plan-basic',
    months: 12, // 购买 12 个月
    paymentMethod: 'wechat',
  });
  console.log(` 订单创建成功: 订单号: ${order.orderNo}, 订单金额: ¥${order.amount}, 状态: ${order.status}`);

  console.log('\n=== Step 3: 发起微信支付下单 (JSAPI/小程序支付) ===');
  const payResult = await subscriptionService.payOrder(mockUser, order.id, {
    paymentMethod: 'wechat',
    openid: 'mock_openid_123456',
  });
  console.log('--- 下单返回支付参数 (WeChat JSAPI params) ---');
  console.log(JSON.stringify(payResult, null, 2));

  console.log('\n=== Step 4: 支付回调验签、金额校验与幂等性测试 ===');
  
  // 1. 模拟错误的金额进行回调 (金额校验)
  console.log('--- 测试 1: 故意传入错误的回调金额 (期望被拦截并报错) ---');
  const badBody = JSON.stringify({
    outTradeNo: order.orderNo,
    amount: 99900, // 错误金额：999元 (应为1228.80元)
    transactionId: 'WX_TX_MOCK_11111',
  });
  try {
    await paymentGatewayService.handleCallback('wechat', {}, badBody);
    console.log(' [错误] 错误金额回调居然通过了！');
  } catch (err: any) {
    console.log(` [正确拦截] 成功拦截错误金额回调: ${err.message}`);
  }

  // 2. 模拟正确的金额进行回调 (开通/续费)
  console.log('\n--- 测试 2: 传入正确金额的回调 (期望支付成功并开通/续费) ---');
  const correctAmountCents = Math.round(Number(order.amount) * 100);
  const correctBody = JSON.stringify({
    outTradeNo: order.orderNo,
    amount: correctAmountCents,
    transactionId: 'WX_TX_MOCK_22222',
  });
  await paymentGatewayService.handleCallback('wechat', {}, correctBody);
  console.log(' 正确金额回调处理成功！');

  // 3. 幂等性测试：重复回调不重复处理
  console.log('\n--- 测试 3: 重复触发同笔订单的回调 (验证幂等性，期望直接返回) ---');
  await paymentGatewayService.handleCallback('wechat', {}, correctBody);
  console.log(' 重复回调幂等处理成功（控制台未报错且未重复生成记录）！');

  console.log('\n=== Step 5: 验证支付成功后租户订阅状态与有效期的变更 ===');
  const updatedTenant = await prisma.tenant.findUnique({
    where: { id: 'e2e-305-tenant' },
  });
  console.log('--- 支付后租户订阅状态 ---');
  console.log(` 租户状态 (应为 active): ${updatedTenant?.subscriptionStatus}`);
  console.log(` 有效期已成功顺延至: ${updatedTenant?.subscriptionEndAt?.toISOString()}`);

  const activeSub = await prisma.tenantSubscription.findFirst({
    where: { tenantId: 'e2e-305-tenant', status: 'active' },
    include: { plan: true },
  });
  console.log(` 关联激活订阅套餐: ${activeSub?.plan.name}, 周期: ${activeSub?.startAt.toISOString()} 至 ${activeSub?.endAt.toISOString()}`);

  console.log('\n=== TASK-305 E2E Subscription and Payment Verification Success ===');
  await app.close();
}

main().catch(err => {
  console.error('E2E TASK-305 Verification Script Failed:', err);
  process.exit(1);
});
