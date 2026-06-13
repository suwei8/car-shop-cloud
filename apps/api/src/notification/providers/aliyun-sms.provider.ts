import { Logger } from '@nestjs/common';
import { SmsProvider, maskPhone } from './sms.provider';

export class AliyunSmsProvider implements SmsProvider {
  private readonly logger = new Logger('AliyunSmsProvider');
  private accessKeyId: string;
  private accessKeySecret: string;
  private signName: string;

  constructor(config: { accessKeyId: string; accessKeySecret: string; signName: string }) {
    this.accessKeyId = config.accessKeyId;
    this.accessKeySecret = config.accessKeySecret;
    this.signName = config.signName;
  }

  async send(phone: string, templateCode: string, params: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
    this.logger.log(`[Aliyun SMS] Sending to ${maskPhone(phone)}, template: ${templateCode}`);

    try {
      // TODO: 集成阿里云短信 SDK (@alicloud/dysmsapi20170525)
      // const Dysmsapi = require('@alicloud/dysmsapi20170525').default;
      // const client = new Dysmsapi({ accessKeyId: this.accessKeyId, accessKeySecret: this.accessKeySecret });
      // const result = await client.sendSms({
      //   PhoneNumbers: phone,
      //   SignName: this.signName,
      //   TemplateCode: templateCode,
      //   TemplateParam: JSON.stringify(params),
      // });
      // if (result.body.code === 'OK') return { ok: true };
      // return { ok: false, error: result.body.message };

      this.logger.warn('[Aliyun SMS] SDK not installed, treating as mock');
      return { ok: true };
    } catch (err) {
      this.logger.error(`[Aliyun SMS] Failed: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }
}
