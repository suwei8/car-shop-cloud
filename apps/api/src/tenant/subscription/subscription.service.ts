import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { PaymentGatewayService } from '../payment/payment-gateway.service';
import { JwtPayload } from '@car/shared';
import { Prisma } from '@prisma/client';

type Decimalish = { toString(): string } | number | string;

interface SubscriptionPlanListRecord {
  id?: string;
  name: string;
  priceMonthly?: Decimalish | null;
  priceYearly: Decimalish;
  discount3m: Decimalish;
  discount6m: Decimalish;
  discount12m: Decimalish;
  [key: string]: unknown;
}

interface SubscriptionHistoryRecord {
  originalAmount: Decimalish;
  discountRate: Decimalish;
  amount: Decimalish;
  plan: { priceYearly: Decimalish; [key: string]: unknown };
  [key: string]: unknown;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private paymentGatewayService: PaymentGatewayService,
  ) {}

  async getPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { status: 'active' },
      orderBy: { priceYearly: 'asc' },
    });

    return (plans as SubscriptionPlanListRecord[]).map((plan: SubscriptionPlanListRecord) => {
      const monthlyPrice = plan.priceMonthly
        ? Number(plan.priceMonthly)
        : Number(plan.priceYearly) / 12;

      const discounts: Record<string, { rate: number; price: string }> = {
        '1': { rate: 1.0, price: monthlyPrice.toFixed(2) },
        '3': {
          rate: Number(plan.discount3m),
          price: (monthlyPrice * 3 * Number(plan.discount3m)).toFixed(2),
        },
        '6': {
          rate: Number(plan.discount6m),
          price: (monthlyPrice * 6 * Number(plan.discount6m)).toFixed(2),
        },
        '12': {
          rate: Number(plan.discount12m),
          price: (monthlyPrice * 12 * Number(plan.discount12m)).toFixed(2),
        },
      };

      return {
        ...plan,
        priceYearly: plan.priceYearly.toString(),
        priceMonthly: monthlyPrice.toFixed(2),
        discount3m: plan.discount3m.toString(),
        discount6m: plan.discount6m.toString(),
        discount12m: plan.discount12m.toString(),
        discounts,
      };
    });
  }

  async getCurrentSubscription(user: JwtPayload) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId! },
      include: {
        subscriptions: {
          where: { status: { in: ['active', 'trial'] } },
          orderBy: { endAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
    });

    if (!tenant || !tenant.subscriptions.length) {
      return null;
    }

    const sub = tenant.subscriptions[0];
    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil((sub.endAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return {
      status: tenant.subscriptionStatus,
      planName: sub.plan.name,
      startAt: sub.startAt.toISOString(),
      endAt: sub.endAt.toISOString(),
      daysRemaining,
      maxShops: sub.plan.maxShops,
      maxEmployees: sub.plan.maxEmployees,
    };
  }

  async createOrder(
    user: JwtPayload,
    dto: { planId: string; months: number; paymentMethod: string },
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan || plan.status !== 'active') {
      throw new NotFoundException('套餐不存在或已下架');
    }

    // Cancel any existing pending orders for this tenant
    await this.prisma.subscriptionOrder.updateMany({
      where: {
        tenantId: user.tenantId!,
        status: 'pending',
      },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });

    const monthlyPrice = plan.priceMonthly
      ? Number(plan.priceMonthly)
      : Number(plan.priceYearly) / 12;

    const originalAmount = monthlyPrice * dto.months;

    let discountRate = 1.0;
    if (dto.months === 3) discountRate = Number(plan.discount3m);
    else if (dto.months === 6) discountRate = Number(plan.discount6m);
    else if (dto.months === 12) discountRate = Number(plan.discount12m);

    const amount = Math.round(originalAmount * discountRate * 100) / 100;

    const orderNo = await this.generateOrderNo(user.tenantId!);

    const order = await this.prisma.subscriptionOrder.create({
      data: {
        tenantId: user.tenantId!,
        orderNo,
        planId: dto.planId,
        months: dto.months,
        originalAmount,
        discountRate,
        amount,
        status: 'pending',
        paymentMethod: dto.paymentMethod,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId || undefined,
      userId: user.sub,
      action: 'subscription_order_create',
      targetType: 'SubscriptionOrder',
      targetId: order.id,
      changes: { orderNo, planId: dto.planId, months: dto.months, amount },
    });

    return {
      id: order.id,
      orderNo: order.orderNo,
      amount: order.amount.toString(),
      status: order.status,
    };
  }

  async payOrder(
    user: JwtPayload,
    orderId: string,
    dto: { paymentMethod: string; openid?: string },
  ) {
    const order = await this.prisma.subscriptionOrder.findFirst({
      where: { id: orderId, tenantId: user.tenantId! },
      include: { plan: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'pending') {
      throw new BadRequestException('订单状态不允许支付');
    }

    const plan = order.plan;
    const description = `车店云管家 - ${plan.name} ${order.months}个月`;

    // Create a Payment record for the payment gateway
    const payment = await this.prisma.payment.create({
      data: {
        tenantId: user.tenantId!,
        settlementId: null, // Will be linked via subscription order
        payMethod: dto.paymentMethod,
        amount: order.amount,
        status: 'pending',
        referenceNo: order.orderNo,
      },
    });

    // Update the subscription order with the payment reference
    await this.prisma.subscriptionOrder.update({
      where: { id: orderId },
      data: { transactionId: payment.id },
    });

    const result = await this.paymentGatewayService.createPaymentOrder(
      payment.id,
      dto.paymentMethod as 'wechat' | 'alipay',
      user.tenantId!,
      {
        tradeType: dto.openid ? 'JSAPI' : 'NATIVE',
        openid: dto.openid,
      },
    );

    return {
      codeUrl: result.codeUrl,
      jsapiParams: result.jsapiParams,
      orderId: order.id,
    };
  }

  async getOrder(user: JwtPayload, orderId: string) {
    const order = await this.prisma.subscriptionOrder.findFirst({
      where: { id: orderId, tenantId: user.tenantId! },
      include: { plan: true },
    });
    if (!order) throw new NotFoundException('订单不存在');

    return {
      ...order,
      originalAmount: order.originalAmount.toString(),
      discountRate: order.discountRate.toString(),
      amount: order.amount.toString(),
      plan: {
        ...order.plan,
        priceYearly: order.plan.priceYearly.toString(),
      },
    };
  }

  async getHistory(user: JwtPayload, query: { page?: number; pageSize?: number }) {
    const { page: _p = 1, pageSize: _ps = 20 } = query;
    const page = Number(_p) || 1;
    const pageSize = Number(_ps) || 20;
    const where = { tenantId: user.tenantId! };

    const [items, total] = await Promise.all([
      this.prisma.subscriptionOrder.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      }),
      this.prisma.subscriptionOrder.count({ where }),
    ]);

    return {
      items: (items as SubscriptionHistoryRecord[]).map((item: SubscriptionHistoryRecord) => ({
        ...item,
        originalAmount: item.originalAmount.toString(),
        discountRate: item.discountRate.toString(),
        amount: item.amount.toString(),
        plan: {
          ...item.plan,
          priceYearly: item.plan.priceYearly.toString(),
        },
      })),
      total,
      page,
      pageSize,
    };
  }

  async handleSubscriptionPaymentCallback(orderNo: string, transactionId: string, callbackAmountCents?: number) {
    const order = await this.prisma.subscriptionOrder.findFirst({
      where: { orderNo },
    });
    if (!order) {
      this.logger.warn(`Subscription order not found: ${orderNo}`);
      return;
    }

    if (callbackAmountCents !== undefined) {
      const expectedCents = Math.round(Number(order.amount) * 100);
      if (expectedCents !== callbackAmountCents) {
        this.logger.error(`Subscription callback amount mismatch: expected ${expectedCents} cents, got ${callbackAmountCents} cents`);
        throw new BadRequestException('金额不一致');
      }
    }

    if (order.status === 'paid') {
      this.logger.log(`Subscription order already paid (idempotent): ${orderNo}`);
      return;
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update order status
      await tx.subscriptionOrder.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          transactionId,
          paidAt: new Date(),
        },
      });

      // Activate subscription by calling renew logic inline
      const tenant = await tx.tenant.findUnique({ where: { id: order.tenantId } });
      if (!tenant) {
        this.logger.error(`Tenant not found for subscription order: ${order.tenantId}`);
        return;
      }

      const now = new Date();
      const baseDate =
        tenant.subscriptionEndAt && tenant.subscriptionEndAt > now
          ? tenant.subscriptionEndAt
          : now;

      const startAt = new Date(baseDate);
      const endAt = new Date(baseDate);
      endAt.setMonth(endAt.getMonth() + order.months);

      await tx.tenantSubscription.create({
        data: {
          tenantId: order.tenantId,
          planId: order.planId,
          startAt,
          endAt,
          status: 'active',
        },
      });

      await tx.tenant.update({
        where: { id: order.tenantId },
        data: {
          subscriptionStatus: 'active',
          subscriptionEndAt: endAt,
        },
      });
    });

    await this.auditService.log({
      tenantId: order.tenantId,
      action: 'subscription_purchase',
      targetType: 'SubscriptionOrder',
      targetId: order.id,
      changes: {
        planId: order.planId,
        months: order.months,
        amount: Number(order.amount),
        orderNo,
      },
    });

    this.logger.log(
      `Subscription activated: ${orderNo} tenant=${order.tenantId} months=${order.months}`,
    );
  }

  private async generateOrderNo(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = await this.prisma.sequence.upsert({
      where: {
        tenantId_key_date: {
          tenantId,
          key: 'subscription_order',
          date: dateStr,
        },
      },
      update: { value: { increment: 1 } },
      create: { tenantId, key: 'subscription_order', date: dateStr, value: 1 },
    });
    return `SUB${dateStr}${String(seq.value).padStart(4, '0')}`;
  }
}
