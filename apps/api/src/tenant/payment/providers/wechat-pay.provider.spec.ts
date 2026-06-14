import { WechatPayProvider } from './wechat-pay.provider';
import { ConfigService } from '@nestjs/config';
import { XMLBuilder } from 'fast-xml-parser';

describe('WechatPayProvider', () => {
  let provider: WechatPayProvider;
  let mockConfigService: any;
  const builder = new XMLBuilder();

  const mockAppid = 'wx_test_appid';
  const mockMchid = '1234567890';
  const mockApiKey = '12345678901234567890123456789012'; // 32 chars V2 key

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'WECHAT_PAY_APPID') return mockAppid;
        if (key === 'WECHAT_PAY_MCHID') return mockMchid;
        if (key === 'WECHAT_PAY_APIV2_KEY') return mockApiKey;
        if (key === 'WECHAT_PAY_NOTIFY_URL') return 'https://test.com/notify';
        return '';
      }),
    };
    provider = new WechatPayProvider(mockConfigService as ConfigService);
  });

  describe('generateSign & verifyCallback', () => {
    it('should verifyCallback successfully with a correct signature', async () => {
      // Create a mock XML payload
      const payload: Record<string, any> = {
        return_code: 'SUCCESS',
        result_code: 'SUCCESS',
        appid: mockAppid,
        mch_id: mockMchid,
        out_trade_no: 'order-123',
        transaction_id: 'trans-456',
        total_fee: '100', // 100 cents
        nonce_str: 'nonce123',
        sign_type: 'HMAC-SHA256',
      };

      // Generate sign using our helper logic in test, matching WechatPayProvider signature generation
      const sortedKeys = Object.keys(payload).sort();
      const queryStr = sortedKeys.map(k => `${k}=${payload[k]}`).join('&');
      const stringSignTemp = `${queryStr}&key=${mockApiKey}`;
      const sign = require('crypto')
        .createHmac('sha256', mockApiKey)
        .update(stringSignTemp, 'utf8')
        .digest('hex')
        .toUpperCase();

      payload.sign = sign;

      const xml = builder.build({ xml: payload });

      const result = await provider.verifyCallback({}, xml);

      expect(result.verified).toBe(true);
      expect(result.outTradeNo).toBe('order-123');
      expect(result.transactionId).toBe('trans-456');
      expect(result.amount).toBe(100);
    });

    it('should reject callback with an incorrect signature', async () => {
      const payload: Record<string, any> = {
        return_code: 'SUCCESS',
        result_code: 'SUCCESS',
        appid: mockAppid,
        mch_id: mockMchid,
        out_trade_no: 'order-123',
        total_fee: '100',
        nonce_str: 'nonce123',
        sign: 'INCORRECT_SIGNATURE_HERE',
      };

      const xml = builder.build({ xml: payload });

      const result = await provider.verifyCallback({}, xml);

      expect(result.verified).toBe(false);
    });
  });
});
