import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  CreateOrderParams,
  CreateOrderResult,
  QueryOrderResult,
  RefundParams,
  RefundResult,
  CallbackVerifyResult,
} from './payment-provider.interface';

@Injectable()
export class AlipayProvider implements PaymentProvider {
  readonly method = 'alipay' as const;
  private logger = new Logger('Alipay');
  private alipaySdk: any;
  private notifyUrl: string;

  constructor(private config: ConfigService) {
    const appId = this.config.get<string>('ALIPAY_APP_ID', '');
    const privateKey = this.config.get<string>('ALIPAY_PRIVATE_KEY', '');
    const alipayPublicKey = this.config.get<string>('ALIPAY_PUBLIC_KEY', '');
    this.notifyUrl = this.config.get<string>('ALIPAY_NOTIFY_URL', '');

    try {
      const AlipaySdk = require('alipay-sdk').AlipaySdk;
      this.alipaySdk = new AlipaySdk({
        appId,
        privateKey,
        alipayPublicKey,
        signType: 'RSA2',
      });
    } catch {
      this.logger.warn('alipay-sdk not installed or config missing, AlipayProvider will not work');
    }
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    if (!this.alipaySdk) throw new Error('Alipay SDK not initialized');

    const amountYuan = (params.amount / 100).toFixed(2);
    const result = await this.alipaySdk.exec('alipay.trade.precreate', {
      bizContent: {
        out_trade_no: params.outTradeNo,
        total_amount: amountYuan,
        subject: params.description,
      },
      notify_url: params.notifyUrl || this.notifyUrl,
    });

    this.logger.log(`createOrder: ${params.outTradeNo}`);

    return {
      codeUrl: result.qrCode,
    };
  }

  async queryOrder(outTradeNo: string): Promise<QueryOrderResult> {
    if (!this.alipaySdk) throw new Error('Alipay SDK not initialized');

    const result = await this.alipaySdk.exec('alipay.trade.query', {
      bizContent: { out_trade_no: outTradeNo },
    });

    const statusMap: Record<string, QueryOrderResult['status']> = {
      TRADE_SUCCESS: 'paid',
      TRADE_FINISHED: 'paid',
      WAIT_BUYER_PAY: 'pending',
      TRADE_CLOSED: 'closed',
    };

    return {
      status: statusMap[result.tradeStatus] || 'pending',
      transactionId: result.tradeNo,
      paidAt: result.sendPayDate ? new Date(result.sendPayDate) : undefined,
      rawData: result,
    };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    if (!this.alipaySdk) throw new Error('Alipay SDK not initialized');

    const refundAmountYuan = (params.refundAmount / 100).toFixed(2);
    const result = await this.alipaySdk.exec('alipay.trade.refund', {
      bizContent: {
        trade_no: params.transactionId,
        refund_amount: refundAmountYuan,
        out_request_no: params.outRefundNo,
        refund_reason: params.reason,
      },
    });

    this.logger.log(`refund: ${params.outRefundNo}`);

    return {
      outRefundNo: params.outRefundNo,
      status: result.fundChange === 'Y' ? 'success' : 'pending',
      rawData: result,
    };
  }

  async verifyCallback(headers: Record<string, string>, body: string | Buffer): Promise<CallbackVerifyResult> {
    if (!this.alipaySdk) {
      this.logger.warn('Alipay SDK not initialized, verifyCallback skipped');
      return { verified: false };
    }

    try {
      const rawBody = typeof body === 'string' ? body : body.toString('utf-8');
      const params = this.parseFormData(rawBody);

      const verified = this.alipaySdk.checkNotifySign(params);
      if (!verified) {
        this.logger.warn('verifyCallback: sign verification failed');
        return { verified: false };
      }

      this.logger.log(`verifyCallback: out_trade_no=${params.out_trade_no}`);

      return {
        verified: true,
        outTradeNo: params.out_trade_no,
        transactionId: params.trade_no,
        amount: params.total_amount ? Math.round(parseFloat(params.total_amount) * 100) : undefined,
        rawData: params,
      };
    } catch (err) {
      this.logger.error(`verifyCallback error: ${err}`);
      return { verified: false };
    }
  }

  private parseFormData(body: string): Record<string, string> {
    const params: Record<string, string> = {};
    if (!body) return params;
    body.split('&').forEach((pair) => {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    });
    return params;
  }
}
