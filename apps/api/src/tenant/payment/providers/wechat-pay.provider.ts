import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import axios from 'axios';
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
export class WechatPayProvider implements PaymentProvider {
  readonly method = 'wechat' as const;
  private logger = new Logger('WechatPay');

  private appid: string;
  private mchid: string;
  private serialNo: string;
  private privateKey: string;
  private apiV3Key: string;
  private notifyUrl: string;

  constructor(private config: ConfigService) {
    this.appid = this.config.get<string>('WECHAT_PAY_APPID', '');
    this.mchid = this.config.get<string>('WECHAT_PAY_MCHID', '');
    this.serialNo = this.config.get<string>('WECHAT_PAY_SERIAL_NO', '');
    this.apiV3Key = this.config.get<string>('WECHAT_PAY_APIV3_KEY', '');
    this.notifyUrl = this.config.get<string>('WECHAT_PAY_NOTIFY_URL', '');

    const keyPath = this.config.get<string>('WECHAT_PAY_PRIVATE_KEY_PATH', '');
    try {
      this.privateKey = fs.readFileSync(keyPath, 'utf-8');
    } catch {
      this.logger.warn(`Private key not found at ${keyPath}, wechat pay will not work`);
      this.privateKey = '';
    }
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const url = params.tradeType === 'JSAPI'
      ? 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi'
      : 'https://api.mch.weixin.qq.com/v3/pay/transactions/native';

    const body = {
      appid: this.appid,
      mchid: this.mchid,
      description: params.description,
      out_trade_no: params.outTradeNo,
      notify_url: params.notifyUrl || this.notifyUrl,
      amount: { total: params.amount },
      ...(params.tradeType === 'JSAPI' && params.openid
        ? { payer: { openid: params.openid } }
        : {}),
    };

    const authStr = this.buildAuth('POST', url.replace('https://api.mch.weixin.qq.com', ''), body);
    const resp = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authStr,
        'Accept': 'application/json',
      },
    });

    this.logger.log(`createOrder: ${params.outTradeNo}`);

    const prepayId = resp.data.prepay_id;
    let jsapiParams: CreateOrderResult['jsapiParams'] | undefined;

    if (params.tradeType === 'JSAPI' && prepayId) {
      const timeStamp = Math.floor(Date.now() / 1000).toString();
      const nonceStr = this.randomStr(32);
      const pkg = `prepay_id=${prepayId}`;
      const message = `${this.appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;

      const sign = crypto.createSign('RSA-SHA256');
      sign.update(message);
      const paySign = sign.sign(this.privateKey || 'mock_key', 'base64');

      jsapiParams = {
        appId: this.appid,
        timeStamp,
        nonceStr,
        package: pkg,
        signType: 'RSA',
        paySign,
      };
    }

    return {
      codeUrl: resp.data.code_url,
      prepayId,
      jsapiParams,
    };
  }

  async queryOrder(outTradeNo: string): Promise<QueryOrderResult> {
    const path = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${this.mchid}`;
    const url = `https://api.mch.weixin.qq.com${path}`;

    const authStr = this.buildAuth('GET', path, null);
    const resp = await axios.get(url, {
      headers: {
        'Authorization': authStr,
        'Accept': 'application/json',
      },
    });

    const data = resp.data;
    const statusMap: Record<string, QueryOrderResult['status']> = {
      SUCCESS: 'paid',
      REFUND: 'refunded',
      NOTPAY: 'pending',
      CLOSED: 'closed',
    };

    return {
      status: statusMap[data.trade_state] || 'pending',
      transactionId: data.transaction_id,
      paidAt: data.success_time ? new Date(data.success_time) : undefined,
      rawData: data,
    };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const path = '/v3/refund/domestic/refunds';
    const url = `https://api.mch.weixin.qq.com${path}`;

    const body = {
      transaction_id: params.transactionId,
      out_refund_no: params.outRefundNo,
      reason: params.reason,
      amount: {
        refund: params.refundAmount,
        total: params.totalAmount,
        currency: 'CNY',
      },
    };

    const authStr = this.buildAuth('POST', path, body);
    const resp = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authStr,
        'Accept': 'application/json',
      },
    });

    this.logger.log(`refund: ${params.outRefundNo}`);

    const statusMap: Record<string, RefundResult['status']> = {
      SUCCESS: 'success',
      PROCESSING: 'pending',
      ABNORMAL: 'failed',
      CLOSED: 'failed',
    };

    return {
      outRefundNo: resp.data.out_refund_no || params.outRefundNo,
      status: statusMap[resp.data.status] || 'pending',
      rawData: resp.data,
    };
  }

  async verifyCallback(headers: Record<string, string>, body: string | Buffer): Promise<CallbackVerifyResult> {
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const signature = headers['wechatpay-signature'];
    const serial = headers['wechatpay-serial'];

    if (!timestamp || !nonce || !signature) {
      this.logger.warn('Missing wechat pay callback headers');
      return { verified: false };
    }

    const rawBody = typeof body === 'string' ? body : body.toString('utf-8');

    try {
      const parsed = JSON.parse(rawBody);
      const resource = parsed.resource;

      if (!resource) {
        return { verified: false };
      }

      const decrypted = this.decryptResource(resource.ciphertext, resource.nonce, resource.associated_data);
      const payment = JSON.parse(decrypted);

      this.logger.log(`verifyCallback: out_trade_no=${payment.out_trade_no}, serial=${serial}`);

      return {
        verified: true,
        outTradeNo: payment.out_trade_no,
        transactionId: payment.transaction_id,
        amount: payment.amount?.total,
        rawData: payment,
      };
    } catch (err) {
      this.logger.error(`verifyCallback error: ${err}`);
      return { verified: false };
    }
  }

  private buildAuth(method: string, url: string, body: any): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = this.randomStr(32);
    const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body ? JSON.stringify(body) : ''}\n`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    const signature = sign.sign(this.privateKey, 'base64');

    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${this.serialNo}"`;
  }

  private decryptResource(ciphertext: string, nonce: string, associatedData: string): string {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(this.apiV3Key),
      Buffer.from(nonce),
    );
    decipher.setAAD(Buffer.from(associatedData));

    const cipherBuffer = Buffer.from(ciphertext, 'base64');
    const authTag = cipherBuffer.subarray(cipherBuffer.length - 16);
    const data = cipherBuffer.subarray(0, cipherBuffer.length - 16);

    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf-8');
  }

  private randomStr(len: number): string {
    return crypto.randomBytes(len).toString('hex').slice(0, len);
  }
}
