import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SmsProvider, maskPhone } from './providers/sms.provider';
import { MockSmsProvider } from './providers/mock-sms.provider';
import { AliyunSmsProvider } from './providers/aliyun-sms.provider';
import { WechatMpProvider } from './providers/wechat-mp.provider';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private smsProvider: SmsProvider;
  private wechatMpProvider: WechatMpProvider;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Optional() wechatMpProvider?: WechatMpProvider,
  ) {
    this.smsProvider = this.createSmsProvider();
    this.wechatMpProvider = wechatMpProvider || new WechatMpProvider(config, prisma);
  }

  private createSmsProvider(): SmsProvider {
    const provider = this.config.get('SMS_PROVIDER', 'mock');
    if (provider === 'aliyun') {
      const accessKeyId = this.config.get('ALIYUN_SMS_ACCESS_KEY_ID', '');
      const accessKeySecret = this.config.get('ALIYUN_SMS_ACCESS_KEY_SECRET', '');
      const signName = this.config.get('ALIYUN_SMS_SIGN_NAME', '');
      if (!accessKeyId || !accessKeySecret) {
        this.logger.warn('Aliyun SMS credentials not configured, falling back to MockSmsProvider');
        return new MockSmsProvider();
      }
      return new AliyunSmsProvider({ accessKeyId, accessKeySecret, signName });
    }
    return new MockSmsProvider();
  }

  async send(input: {
    tenantId: string;
    shopId?: string;
    channel: string;
    scene: string;
    recipient: string;
    content: string;
    relatedType?: string;
    relatedId?: string;
    failReason?: string;
  }): Promise<{ id: string; status: string }> {
    if (!input.recipient) {
      return this.skip({
        tenantId: input.tenantId,
        shopId: input.shopId,
        channel: input.channel,
        scene: input.scene,
        recipient: '',
        content: input.content,
        relatedType: input.relatedType,
        relatedId: input.relatedId,
        failReason: input.failReason || '客户无手机号',
      });
    }

    const notification = await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        shopId: input.shopId,
        channel: input.channel,
        scene: input.scene,
        recipient: input.recipient,
        content: input.content,
        status: 'pending',
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      },
    });

    this.logger.log(`Notification created: ${notification.id}, scene: ${input.scene}, to: ${maskPhone(input.recipient)}`);

    try {
      if (input.channel === 'sms') {
        const result = await this.smsProvider.send(input.recipient, input.scene, { content: input.content });

        if (result.ok) {
          await this.prisma.notification.update({
            where: { id: notification.id },
            data: { status: 'sent', sentAt: new Date() },
          });
          this.logger.log(`Notification sent: ${notification.id}`);
          return { id: notification.id, status: 'sent' };
        } else {
          await this.prisma.notification.update({
            where: { id: notification.id },
            data: { status: 'failed', failReason: result.error || 'unknown' },
          });
          this.logger.warn(`Notification failed: ${notification.id}, reason: ${result.error}`);
          return { id: notification.id, status: 'failed' };
        }
      }

      if (input.channel === 'wechat_mp') {
        const templateId = this.config.get<string>(`WX_TPL_${input.scene.toUpperCase()}`);
        if (!templateId) {
          await this.prisma.notification.update({
            where: { id: notification.id },
            data: { status: 'skipped', failReason: '微信订阅消息模板未配置' },
          });
          return { id: notification.id, status: 'skipped' };
        }

        let templateData: Record<string, { value: string }>;
        try {
          const params = typeof input.content === 'string' ? JSON.parse(input.content) : {};
          templateData = this.wechatMpProvider.buildTemplateData(input.scene, params);
        } catch {
          templateData = { thing1: { value: input.content } };
        }

        const page = input.relatedType === 'work_order'
          ? `pages/work-orders/detail?id=${input.relatedId}`
          : input.relatedType === 'appointment'
            ? `pages/appointment/confirm?id=${input.relatedId}`
            : undefined;

        const result = await this.wechatMpProvider.sendSubscribeMessage({
          openid: input.recipient,
          templateId,
          data: templateData,
          page,
        });

        if (result.ok) {
          await this.prisma.notification.update({
            where: { id: notification.id },
            data: { status: 'sent', sentAt: new Date() },
          });
          return { id: notification.id, status: 'sent' };
        } else {
          await this.prisma.notification.update({
            where: { id: notification.id },
            data: { status: 'failed', failReason: result.error || 'unknown' },
          });
          return { id: notification.id, status: 'failed' };
        }
      }

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'skipped', failReason: `Unsupported channel: ${input.channel}` },
      });
      return { id: notification.id, status: 'skipped' };
    } catch (err) {
      this.logger.error(`Notification error: ${notification.id}, ${err.message}`);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'failed', failReason: err.message },
      });
      return { id: notification.id, status: 'failed' };
    }
  }

  async skip(input: {
    tenantId: string;
    shopId?: string;
    channel: string;
    scene: string;
    recipient: string;
    content: string;
    relatedType?: string;
    relatedId?: string;
    failReason: string;
  }): Promise<{ id: string; status: string }> {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        shopId: input.shopId,
        channel: input.channel,
        scene: input.scene,
        recipient: input.recipient,
        content: input.content,
        status: 'skipped',
        failReason: input.failReason,
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      },
    });
    this.logger.log(`Notification skipped: ${notification.id}, reason: ${input.failReason}`);
    return { id: notification.id, status: 'skipped' };
  }

  async findAll(tenantId: string, query: {
    page?: number;
    pageSize?: number;
    scene?: string;
    status?: string;
  }) {
    const { page = 1, pageSize = 20, scene, status } = query;
    const where: any = { tenantId };
    if (scene) where.scene = scene;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async checkDuplicate(tenantId: string, relatedType: string, relatedId: string, scene: string): Promise<boolean> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        tenantId,
        relatedType,
        relatedId,
        scene,
        status: { in: ['sent', 'pending'] },
      },
    });
    return !!existing;
  }

  async sendWechatMpOrFallback(input: {
    tenantId: string;
    shopId?: string;
    customerId: string;
    scene: string;
    phone: string;
    content: string;
    relatedType?: string;
    relatedId?: string;
  }): Promise<void> {
    const openid = await this.wechatMpProvider.lookupOpenid(input.tenantId, input.customerId);
    if (openid) {
      const result = await this.send({
        tenantId: input.tenantId,
        shopId: input.shopId,
        channel: 'wechat_mp',
        scene: input.scene,
        recipient: openid,
        content: input.content,
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      });
      if (result.status === 'sent') return;
      this.logger.warn(`WeChat MP notification failed, falling back to SMS: ${result.status}`);
    }

    await this.send({
      tenantId: input.tenantId,
      shopId: input.shopId,
      channel: 'sms',
      scene: input.scene,
      recipient: input.phone,
      content: input.content,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
    });
  }
}
