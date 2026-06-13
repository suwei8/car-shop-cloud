import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class SmsCodeService {
  private readonly logger = new Logger(SmsCodeService.name);
  private redis: Redis;
  private readonly CODE_TTL = 300; // 5 minutes
  private readonly RESEND_INTERVAL = 60; // 60 seconds
  private readonly DAILY_LIMIT_PER_PHONE = 10;
  private readonly DAILY_LIMIT_PER_IP = 20;
  private readonly DAILY_REGISTER_LIMIT_PER_IP = 5;

  constructor(private config: ConfigService) {
    const redisUrl = this.config.get<string>('API_REDIS_URL') || this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
    this.redis.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });
  }

  private key(type: string, identifier: string): string {
    return `sms:${type}:${identifier}`;
  }

  async generateCode(phone: string, ip: string): Promise<string> {
    // Check resend interval
    const resendKey = this.key('resend', phone);
    const resendTtl = await this.redis.ttl(resendKey);
    if (resendTtl > 0) {
      throw new BadRequestException(`请等待 ${resendTtl} 秒后重试`);
    }

    // Check daily limit per phone
    const phoneDailyKey = this.key('daily_phone', phone);
    const phoneCount = await this.redis.incr(phoneDailyKey);
    if (phoneCount === 1) {
      await this.redis.expire(phoneDailyKey, 86400);
    }
    if (phoneCount > this.DAILY_LIMIT_PER_PHONE) {
      throw new BadRequestException('该手机号今日发送次数已达上限');
    }

    // Check daily limit per IP
    const ipDailyKey = this.key('daily_ip', ip);
    const ipCount = await this.redis.incr(ipDailyKey);
    if (ipCount === 1) {
      await this.redis.expire(ipDailyKey, 86400);
    }
    if (ipCount > this.DAILY_LIMIT_PER_IP) {
      throw new BadRequestException('该IP今日发送次数已达上限');
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Store code with TTL
    const codeKey = this.key('code', phone);
    await this.redis.setex(codeKey, this.CODE_TTL, code);

    // Set resend interval
    await this.redis.setex(resendKey, this.RESEND_INTERVAL, '1');

    return code;
  }

  async verifyCode(phone: string, code: string): Promise<boolean> {
    const codeKey = this.key('code', phone);
    const stored = await this.redis.get(codeKey);

    if (!stored) {
      throw new BadRequestException('验证码已过期，请重新发送');
    }

    if (stored !== code) {
      throw new BadRequestException('验证码错误');
    }

    // Delete after successful verification (one-time use)
    await this.redis.del(codeKey);
    return true;
  }

  async checkRegisterLimit(ip: string): Promise<void> {
    const key = this.key('daily_register_ip', ip);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 86400);
    }
    if (count > this.DAILY_REGISTER_LIMIT_PER_IP) {
      throw new BadRequestException('该IP今日注册次数已达上限');
    }
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }
}
