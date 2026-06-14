import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  CreateOrderParams,
  CreateOrderResult,
  QueryOrderResult,
  RefundParams,
  RefundResult,
  CallbackVerifyResult,
} from './payment-provider.interface';

interface MockOrder {
  outTradeNo: string;
  amount: number;
  createdAt: number;
}

@Injectable()
export class MockPayProvider implements PaymentProvider {
  private logger = new Logger('MockPay');
  private orders: Map<string, MockOrder> = new Map();

  constructor(public readonly method: 'mock' | 'wechat' | 'alipay' = 'mock') {}

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    this.orders.set(params.outTradeNo, {
      outTradeNo: params.outTradeNo,
      amount: params.amount,
      createdAt: Date.now(),
    });
    this.logger.log(`[MockPay] createOrder: ${params.outTradeNo} amount=${params.amount} tradeType=${params.tradeType}`);

    const prepayId = `mock_prepay_${Date.now()}`;
    let jsapiParams: CreateOrderResult['jsapiParams'] | undefined;

    if (params.tradeType === 'JSAPI') {
      jsapiParams = {
        appId: 'mock_appid',
        timeStamp: Math.floor(Date.now() / 1000).toString(),
        nonceStr: 'mock_nonce_str_32_chars_long_random',
        package: `prepay_id=${prepayId}`,
        signType: 'RSA',
        paySign: 'mock_signature_for_jsapi_payment',
      };
    }

    return {
      codeUrl: `https://mock-pay.example.com/qr/${params.outTradeNo}`,
      prepayId,
      jsapiParams,
    };
  }

  async queryOrder(outTradeNo: string): Promise<QueryOrderResult> {
    const order = this.orders.get(outTradeNo);
    if (!order) {
      return { status: 'pending' };
    }
    const elapsed = Date.now() - order.createdAt;
    if (elapsed >= 5000) {
      const transactionId = `MOCK_${order.createdAt}_${Math.random().toString(36).slice(2, 8)}`;
      this.logger.log(`[MockPay] queryOrder: ${outTradeNo} → paid (mock)`);
      return {
        status: 'paid',
        transactionId,
        paidAt: new Date(),
      };
    }
    this.logger.log(`[MockPay] queryOrder: ${outTradeNo} → pending (${Math.round(elapsed / 1000)}s)`);
    return { status: 'pending' };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    this.logger.log(`[MockPay] refund: ${params.outRefundNo} amount=${params.refundAmount}`);
    return {
      outRefundNo: params.outRefundNo,
      status: 'success',
    };
  }

  async verifyCallback(_headers: Record<string, string>, body: string | Buffer): Promise<CallbackVerifyResult> {
    this.logger.log(`[MockPay] verifyCallback: verified=true`);
    const raw = typeof body === 'string' ? body : body.toString('utf-8');
    try {
      const parsed = JSON.parse(raw);
      return {
        verified: true,
        outTradeNo: parsed.outTradeNo,
        transactionId: parsed.transactionId || `MOCK_${Date.now()}`,
        amount: parsed.amount,
        rawData: parsed,
      };
    } catch {
      return { verified: true, rawData: raw };
    }
  }
}
