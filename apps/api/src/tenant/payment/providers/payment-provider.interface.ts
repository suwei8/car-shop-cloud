export interface CreateOrderParams {
  outTradeNo: string;
  amount: number;
  description: string;
  notifyUrl: string;
  tradeType?: 'NATIVE' | 'JSAPI';
  openid?: string;
}

export interface CreateOrderResult {
  codeUrl?: string;
  prepayId?: string;
  transactionId?: string;
  jsapiParams?: {
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
  };
}

export interface QueryOrderResult {
  status: 'pending' | 'paid' | 'closed' | 'refunded';
  transactionId?: string;
  paidAt?: Date;
  rawData?: any;
}

export interface RefundParams {
  transactionId: string;
  outRefundNo: string;
  totalAmount: number;
  refundAmount: number;
  reason?: string;
}

export interface RefundResult {
  outRefundNo: string;
  status: 'pending' | 'success' | 'failed';
  rawData?: any;
}

export interface CallbackVerifyResult {
  verified: boolean;
  outTradeNo?: string;
  transactionId?: string;
  amount?: number;
  rawData?: any;
}

export interface PaymentProvider {
  readonly method: 'wechat' | 'alipay' | 'mock';

  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;

  queryOrder(outTradeNo: string): Promise<QueryOrderResult>;

  refund(params: RefundParams): Promise<RefundResult>;

  verifyCallback(headers: Record<string, string>, body: string | Buffer): Promise<CallbackVerifyResult>;
}
