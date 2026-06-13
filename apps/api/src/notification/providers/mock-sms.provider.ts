import { Logger } from '@nestjs/common';
import { SmsProvider, maskPhone } from './sms.provider';

export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger('MockSmsProvider');

  async send(phone: string, templateCode: string, params: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
    this.logger.log(`[MOCK SMS] To: ${maskPhone(phone)}, Template: ${templateCode}, Params: ${JSON.stringify(params)}`);
    return { ok: true };
  }
}
