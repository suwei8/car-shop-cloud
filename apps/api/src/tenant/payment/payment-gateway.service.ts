import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  PaymentProvider,
  CreateOrderParams,
} from './providers/payment-provider.interface';

@Injectable()
export class PaymentGatewayService {
  private logger = new Logger('PaymentGateway');
  private providers: Map<string, PaymentProvider> = new Map();
  private notifyUrls: Record<string, string> = {};

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private auditService: AuditService,
    @Inject('PAYMENT_PROVIDERS') providers: PaymentProvider[],
    private moduleRef: ModuleRef,
  ) {
    for (const p of providers) {
      this.providers.set(p.method, p);
    }
    this.notifyUrls['wechat'] = this.config.get<string>('WECHAT_PAY_NOTIFY_URL', '');
    this.notifyUrls['alipay'] = this.config.get<string>('ALIPAY_NOTIFY_URL', '');
  }

  getProvider(method: string): PaymentProvider {
    const provider = this.providers.get(method);
    if (!provider) throw new BadRequestException(`不支持的支付方式: ${method}`);
    return provider;
  }

  async createPaymentOrder(
    paymentId: string,
    method: 'wechat' | 'alipay',
    tenantId: string,
    options?: { tradeType?: 'NATIVE' | 'JSAPI'; openid?: string },
  ): Promise<{ codeUrl?: string; prepayId?: string; jsapiParams?: any }> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
    });
    if (!payment) throw new NotFoundException('支付记录不存在');
    if (payment.status !== 'pending' && payment.status !== 'paid') {
      throw new BadRequestException(`支付状态异常: ${payment.status}`);
    }

    const provider = this.getProvider(method);
    const amountCents = Math.round(Number(payment.amount) * 100);

    const params: CreateOrderParams = {
      outTradeNo: payment.id,
      amount: amountCents,
      description: `结算单支付`,
      notifyUrl: this.notifyUrls[method] || '',
      tradeType: options?.tradeType,
      openid: options?.openid,
    };

    const result = await provider.createOrder(params);

    const expiredAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'pending',
        expiredAt,
      },
    });

    await this.auditService.log({
      tenantId: payment.tenantId,
      action: 'payment_create',
      targetType: 'Payment',
      targetId: paymentId,
      changes: { method, amount: Number(payment.amount), codeUrl: result.codeUrl },
    });

    this.logger.log(`createPaymentOrder: ${paymentId} method=${method}`);

    return { codeUrl: result.codeUrl, prepayId: result.prepayId, jsapiParams: result.jsapiParams };
  }

  async handleCallback(method: string, headers: Record<string, string>, body: string | Buffer): Promise<void> {
    const provider = this.getProvider(method);
    const result = await provider.verifyCallback(headers, body);

    if (!result.verified) {
      this.logger.warn(`handleCallback: verify failed for ${method}`);
      throw new UnauthorizedException('签名验证失败');
    }

    if (!result.outTradeNo) {
      this.logger.warn(`handleCallback: no outTradeNo in callback for ${method}`);
      return;
    }

    // Check if this is a subscription order (SUB prefix)
    if (result.outTradeNo.startsWith('SUB')) {
      try {
        const { SubscriptionService } = await import('../subscription/subscription.service');
        const subService = this.moduleRef.get(SubscriptionService, { strict: false });
        await subService.handleSubscriptionPaymentCallback(
          result.outTradeNo,
          result.transactionId || '',
          result.amount,
        );
      } catch (err) {
        this.logger.error(`handleCallback: subscription callback error: ${err}`);
        throw err;
      }
      await this.auditService.log({
        action: 'payment_callback',
        targetType: 'Payment',
        targetId: result.outTradeNo,
        changes: { method, transactionId: result.transactionId, amount: result.amount, type: 'subscription' },
      });
      this.logger.log(`handleCallback: subscription order paid ${result.outTradeNo}`);
      return;
    }

    const payment = await this.prisma.payment.findFirst({
      where: { id: result.outTradeNo },
    });
    if (!payment) {
      this.logger.warn(`handleCallback: payment not found: ${result.outTradeNo}`);
      return;
    }

    if (payment.status === 'paid') {
      this.logger.log(`handleCallback: already paid (idempotent): ${payment.id}`);
      return;
    }

    if (result.transactionId) {
      const existing = await this.prisma.payment.findFirst({
        where: {
          transactionId: result.transactionId,
          id: { not: payment.id },
          tenantId: payment.tenantId,
        },
      });
      if (existing) {
        this.logger.warn(`handleCallback: duplicate transactionId: ${result.transactionId}`);
        return;
      }
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'paid',
        transactionId: result.transactionId,
        callbackData: result.rawData,
        paidAt: new Date(),
      },
    });

    const settlement = payment.settlementId
      ? await this.prisma.settlement.findUnique({
          where: { id: payment.settlementId },
          include: { payments: true },
        })
      : null;

    if (settlement && settlement.status === 'pending_payment') {
      const allPaid = settlement.payments.every(
        (p: any) => p.id === payment.id || p.status === 'paid',
      );
      if (allPaid) {
        await this.prisma.settlement.update({
          where: { id: settlement.id },
          data: { status: 'settled' },
        });
        await this.prisma.workOrder.update({
          where: { id: settlement.workOrderId },
          data: { status: 'settled' },
        });
      }
    }

    await this.auditService.log({
      tenantId: payment.tenantId,
      action: 'payment_callback',
      targetType: 'Payment',
      targetId: payment.id,
      changes: { method, transactionId: result.transactionId, amount: result.amount },
    });

    this.logger.log(`handleCallback: paid ${payment.id} txId=${result.transactionId}`);
  }

  async queryPaymentStatus(paymentId: string, tenantId: string): Promise<{ status: string; transactionId?: string }> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
    });
    if (!payment) throw new NotFoundException('支付记录不存在');

    if (payment.status === 'pending' && payment.expiredAt && new Date() > payment.expiredAt) {
      return { status: 'expired' };
    }

    if (payment.status === 'pending') {
      const provider = this.providers.get(payment.payMethod);
      if (provider) {
        try {
          const result = await provider.queryOrder(paymentId);
          if (result.status === 'paid') {
            await this.prisma.payment.update({
              where: { id: paymentId },
              data: {
                status: 'paid',
                transactionId: result.transactionId,
                paidAt: result.paidAt || new Date(),
              },
            });

            const settlement = payment.settlementId
              ? await this.prisma.settlement.findUnique({
                  where: { id: payment.settlementId },
                  include: { payments: true },
                })
              : null;
            if (settlement && settlement.status === 'pending_payment') {
              const allPaid = settlement.payments.every(
                (p: any) => p.id === paymentId || p.status === 'paid',
              );
              if (allPaid) {
                await this.prisma.settlement.update({
                  where: { id: settlement.id },
                  data: { status: 'settled' },
                });
                await this.prisma.workOrder.update({
                  where: { id: settlement.workOrderId },
                  data: { status: 'settled' },
                });
              }
            }

            return { status: 'paid', transactionId: result.transactionId };
          }
          return { status: result.status };
        } catch (err) {
          this.logger.error(`queryPaymentStatus error: ${err}`);
        }
      }
    }

    return { status: payment.status, transactionId: payment.transactionId || undefined };
  }

  async refund(paymentId: string, amount: number, reason: string, operatorId: string, tenantId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
    });
    if (!payment) throw new NotFoundException('支付记录不存在');

    if (!['paid', 'partially_refunded'].includes(payment.status)) {
      throw new BadRequestException(`支付状态不允许退款: ${payment.status}`);
    }

    if (!payment.transactionId) {
      throw new BadRequestException('缺少第三方支付交易号，无法发起退款');
    }

    const maxRefundable = Number(payment.amount) - Number(payment.refundAmount);
    if (amount > maxRefundable) {
      throw new BadRequestException(`退款金额超出可退金额: 最多 ${maxRefundable.toFixed(2)}`);
    }

    const refundNo = await this.generateRefundNo(payment.tenantId);

    const paymentRefund = await this.prisma.paymentRefund.create({
      data: {
        tenantId: payment.tenantId,
        paymentId,
        refundNo,
        amount,
        reason,
        status: 'pending',
        operatorId,
      },
    });

    const provider = this.getProvider(payment.payMethod);
    const amountCents = Math.round(amount * 100);
    const totalCents = Math.round(Number(payment.amount) * 100);

    const result = await provider.refund({
      transactionId: payment.transactionId,
      outRefundNo: refundNo,
      totalAmount: totalCents,
      refundAmount: amountCents,
      reason,
    });

    const newRefundAmount = Number(payment.refundAmount) + amount;
    const newStatus = newRefundAmount >= Number(payment.amount) ? 'refunded' : 'partially_refunded';

    await this.prisma.paymentRefund.update({
      where: { id: paymentRefund.id },
      data: {
        status: result.status,
        outRefundNo: result.outRefundNo,
        callbackData: result.rawData,
      },
    });

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        refundAmount: newRefundAmount,
        status: newStatus,
      },
    });

    await this.auditService.log({
      tenantId: payment.tenantId,
      userId: operatorId,
      action: 'payment_refund',
      targetType: 'PaymentRefund',
      targetId: paymentRefund.id,
      changes: { paymentId, amount, reason, refundNo },
    });

    this.logger.log(`refund: ${paymentRefund.id} amount=${amount} status=${result.status}`);

    return paymentRefund;
  }

  private async generateRefundNo(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = await this.prisma.sequence.upsert({
      where: {
        tenantId_key_date: { tenantId, key: 'payment_refund', date: dateStr },
      },
      update: { value: { increment: 1 } },
      create: { tenantId, key: 'payment_refund', date: dateStr, value: 1 },
    });
    return `RF${dateStr}${String(seq.value).padStart(4, '0')}`;
  }
}
