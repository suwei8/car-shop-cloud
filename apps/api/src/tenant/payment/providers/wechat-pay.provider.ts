import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
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
  private apiV2Key: string;
  private notifyUrl: string;
  private certData?: Buffer;
  private privateKeyData?: Buffer;

  private parser = new XMLParser();
  private builder = new XMLBuilder();

  constructor(private config: ConfigService) {
    this.appid = this.config.get<string>('WECHAT_PAY_APPID', '');
    this.mchid = this.config.get<string>('WECHAT_PAY_MCHID', '');
    this.apiV2Key = this.config.get<string>('WECHAT_PAY_APIV2_KEY', '') || 'mock_api_v2_key_32_chars_long_1';
    this.notifyUrl = this.config.get<string>('WECHAT_PAY_NOTIFY_URL', '');

    const certPath = this.config.get<string>('WECHAT_PAY_CERT_PATH', '');
    const keyPath = this.config.get<string>('WECHAT_PAY_PRIVATE_KEY_PATH', '');

    try {
      if (certPath && fs.existsSync(certPath)) {
        this.certData = fs.readFileSync(certPath);
      }
    } catch (err) {
      this.logger.warn(`Failed to read cert from ${certPath}: ${err}`);
    }

    try {
      if (keyPath && fs.existsSync(keyPath)) {
        this.privateKeyData = fs.readFileSync(keyPath);
      }
    } catch (err) {
      this.logger.warn(`Failed to read private key from ${keyPath}: ${err}`);
    }
  }

  private generateSign(params: Record<string, any>, signType: 'HMAC-SHA256' | 'MD5' = 'HMAC-SHA256'): string {
    const sortedKeys = Object.keys(params)
      .filter(k => k !== 'sign' && params[k] !== undefined && params[k] !== null && params[k] !== '')
      .sort();
    const queryStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
    const stringSignTemp = `${queryStr}&key=${this.apiV2Key}`;

    if (signType === 'HMAC-SHA256') {
      return crypto
        .createHmac('sha256', this.apiV2Key)
        .update(stringSignTemp, 'utf8')
        .digest('hex')
        .toUpperCase();
    } else {
      return crypto
        .createHash('md5')
        .update(stringSignTemp, 'utf8')
        .digest('hex')
        .toUpperCase();
    }
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const nonce_str = this.randomStr(32);
    const data: Record<string, any> = {
      appid: this.appid,
      mch_id: this.mchid,
      nonce_str,
      body: params.description,
      out_trade_no: params.outTradeNo,
      total_fee: params.amount,
      spbill_create_ip: '127.0.0.1',
      notify_url: params.notifyUrl || this.notifyUrl,
      trade_type: params.tradeType || 'NATIVE',
      sign_type: 'HMAC-SHA256',
    };

    if (params.tradeType === 'JSAPI' && params.openid) {
      data.openid = params.openid;
    }

    data.sign = this.generateSign(data, 'HMAC-SHA256');
    const xml = this.builder.build({ xml: data });

    this.logger.log(`createOrder XML: ${xml}`);

    const response = await axios.post('https://api.mch.weixin.qq.com/pay/unifiedorder', xml, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 10000,
    });

    const parsed = this.parser.parse(response.data);
    const xmlData = parsed.xml;

    if (!xmlData) {
      throw new BadRequestException('微信支付返回无效的 XML 响应');
    }

    if (xmlData.return_code !== 'SUCCESS') {
      throw new BadRequestException(xmlData.return_msg || '微信支付统一下单失败');
    }
    if (xmlData.result_code !== 'SUCCESS') {
      throw new BadRequestException(xmlData.err_code_des || xmlData.err_code || '微信支付统一下单失败');
    }

    const prepayId = xmlData.prepay_id;
    let jsapiParams: CreateOrderResult['jsapiParams'] | undefined;

    if (params.tradeType === 'JSAPI' && prepayId) {
      const timeStamp = Math.floor(Date.now() / 1000).toString();
      const nonceStr = this.randomStr(32);
      const pkg = `prepay_id=${prepayId}`;
      const jsapiData = {
        appId: this.appid,
        timeStamp,
        nonceStr,
        package: pkg,
        signType: 'HMAC-SHA256',
      };
      const paySign = this.generateSign(jsapiData, 'HMAC-SHA256');
      jsapiParams = {
        ...jsapiData,
        paySign,
      };
    }

    return {
      codeUrl: xmlData.code_url,
      prepayId,
      jsapiParams,
    };
  }

  async queryOrder(outTradeNo: string): Promise<QueryOrderResult> {
    const nonce_str = this.randomStr(32);
    const data: Record<string, any> = {
      appid: this.appid,
      mch_id: this.mchid,
      out_trade_no: outTradeNo,
      nonce_str,
      sign_type: 'HMAC-SHA256',
    };
    data.sign = this.generateSign(data, 'HMAC-SHA256');
    const xml = this.builder.build({ xml: data });

    const response = await axios.post('https://api.mch.weixin.qq.com/pay/orderquery', xml, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 10000,
    });

    const parsed = this.parser.parse(response.data);
    const xmlData = parsed.xml;

    if (!xmlData) {
      throw new BadRequestException('微信查询订单返回无效的 XML 响应');
    }

    if (xmlData.return_code !== 'SUCCESS') {
      throw new BadRequestException(xmlData.return_msg || '微信查询订单失败');
    }
    if (xmlData.result_code !== 'SUCCESS') {
      throw new BadRequestException(xmlData.err_code_des || xmlData.err_code || '微信查询订单失败');
    }

    const tradeState = xmlData.trade_state;
    const statusMap: Record<string, QueryOrderResult['status']> = {
      SUCCESS: 'paid',
      REFUND: 'refunded',
      NOTPAY: 'pending',
      USERPAYING: 'pending',
      CLOSED: 'closed',
      REVOKED: 'closed',
    };

    return {
      status: statusMap[tradeState] || 'pending',
      transactionId: xmlData.transaction_id,
      paidAt: xmlData.time_end ? this.parseWechatTime(xmlData.time_end) : undefined,
      rawData: xmlData,
    };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const nonce_str = this.randomStr(32);
    const data: Record<string, any> = {
      appid: this.appid,
      mch_id: this.mchid,
      nonce_str,
      transaction_id: params.transactionId,
      out_refund_no: params.outRefundNo,
      total_fee: params.totalAmount,
      refund_fee: params.refundAmount,
      sign_type: 'HMAC-SHA256',
    };
    data.sign = this.generateSign(data, 'HMAC-SHA256');
    const xml = this.builder.build({ xml: data });

    const agentOptions: any = {};
    if (this.certData && this.privateKeyData) {
      agentOptions.httpsAgent = new https.Agent({
        cert: this.certData,
        key: this.privateKeyData,
      });
    } else {
      this.logger.warn('Cert data or private key not loaded, TLS refund might fail.');
    }

    const response = await axios.post('https://api.mch.weixin.qq.com/secapi/pay/refund', xml, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 10000,
      ...agentOptions,
    });

    const parsed = this.parser.parse(response.data);
    const xmlData = parsed.xml;

    if (!xmlData) {
      throw new BadRequestException('微信退款返回无效的 XML 响应');
    }

    if (xmlData.return_code !== 'SUCCESS') {
      throw new BadRequestException(xmlData.return_msg || '微信退款失败');
    }
    if (xmlData.result_code !== 'SUCCESS') {
      throw new BadRequestException(xmlData.err_code_des || xmlData.err_code || '微信退款失败');
    }

    return {
      outRefundNo: xmlData.out_refund_no || params.outRefundNo,
      status: 'success',
      rawData: xmlData,
    };
  }

  async verifyCallback(_headers: Record<string, string>, body: string | Buffer): Promise<CallbackVerifyResult> {
    const rawBody = typeof body === 'string' ? body : body.toString('utf-8');
    try {
      const parsed = this.parser.parse(rawBody);
      const xmlData = parsed.xml;
      this.logger.log(`verifyCallback: parsed XML data: ${JSON.stringify(xmlData)}`);

      if (!xmlData) {
        this.logger.warn('verifyCallback: parsed XML has no xml root element');
        return { verified: false };
      }

      if (xmlData.return_code !== 'SUCCESS' || xmlData.result_code !== 'SUCCESS') {
        this.logger.warn(`verifyCallback: failed return_code=${xmlData.return_code}, result_code=${xmlData.result_code}`);
        return { verified: false, rawData: xmlData };
      }

      const signType = xmlData.sign_type || 'HMAC-SHA256';
      const expectedSign = this.generateSign(xmlData, signType);
      if (xmlData.sign !== expectedSign) {
        this.logger.warn(`verifyCallback: signature mismatch. Got ${xmlData.sign}, expected ${expectedSign}`);
        return { verified: false };
      }

      const amount = parseInt(xmlData.total_fee, 10);

      this.logger.log(`verifyCallback: out_trade_no=${xmlData.out_trade_no}, amount=${amount}`);

      return {
        verified: true,
        outTradeNo: xmlData.out_trade_no,
        transactionId: xmlData.transaction_id,
        amount,
        rawData: xmlData,
      };
    } catch (err) {
      this.logger.error(`verifyCallback error: ${err}`);
      return { verified: false };
    }
  }

  private parseWechatTime(timeStr: string): Date | undefined {
    if (!timeStr || timeStr.length !== 14) return undefined;
    const year = parseInt(timeStr.slice(0, 4), 10);
    const month = parseInt(timeStr.slice(4, 6), 10) - 1;
    const day = parseInt(timeStr.slice(6, 8), 10);
    const hour = parseInt(timeStr.slice(8, 10), 10);
    const minute = parseInt(timeStr.slice(10, 12), 10);
    const second = parseInt(timeStr.slice(12, 14), 10);
    return new Date(year, month, day, hour, minute, second);
  }

  private randomStr(len: number): string {
    return crypto.randomBytes(len).toString('hex').slice(0, len);
  }
}
