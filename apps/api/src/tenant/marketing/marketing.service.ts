import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';
import { SegmentPreviewDto } from './dto/segment.dto';
import { CreateCampaignDto } from './dto/campaign.dto';
import { CreateCouponDto, DistributeCouponDto } from './dto/coupon.dto';

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(private prisma: PrismaService) {}

  // ==================== 客户分群 ====================

  async previewSegment(user: JwtPayload, query: SegmentPreviewDto) {
    const tenantId = user.tenantId!;
    const where: any = { tenantId };

    // 按消费金额筛选
    if (query.minSpendAmount !== undefined) {
      const customerIds = await this.prisma.payment.groupBy({
        by: ['tenantId'],
        where: {
          tenantId,
          status: 'paid',
        },
        having: {
          amount: { _sum: { gt: query.minSpendAmount } },
        },
      });
      // Note: This is simplified. In production, use raw query for complex conditions
    }

    // 基础查询：找出符合条件的客户
    let customerIdFilter: string[] | undefined;

    if (query.minOrderCount !== undefined && query.minOrderCount > 0) {
      const customers = await this.prisma.workOrder.groupBy({
        by: ['customerId'],
        where: {
          tenantId,
          ...(query.source === 'online' ? {} : {}),
        },
        _count: { id: true },
        having: {
          id: { _count: { gte: query.minOrderCount } },
        },
      });
      customerIdFilter = customers.map(c => c.customerId);
    }

    // 按未到店时长筛选
    if (query.inactiveDays !== undefined && query.inactiveDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - query.inactiveDays);

      const activeCustomers = await this.prisma.workOrder.findMany({
        where: {
          tenantId,
          createdAt: { gte: cutoff },
        },
        select: { customerId: true },
        distinct: ['customerId'],
      });

      const activeIds = new Set(activeCustomers.map(c => c.customerId));
      if (customerIdFilter) {
        customerIdFilter = customerIdFilter.filter(id => !activeIds.has(id));
      } else {
        // 找出所有客户，排除活跃的
        const allCustomers = await this.prisma.customer.findMany({
          where: { tenantId },
          select: { id: true },
        });
        customerIdFilter = allCustomers.filter(c => !activeIds.has(c.id)).map(c => c.id);
      }
    }

    // 按来源筛选（通过预约来源 - 预留接口，当前 Appointment 无 source 字段）
    if (query.source) {
      // 预留：当 Appointment 模型增加 source 字段后实现
      // 目前无匹配则返回 0
      customerIdFilter = customerIdFilter || [];
    }

    let count: number;
    if (customerIdFilter !== undefined) {
      count = customerIdFilter.length;
    } else {
      count = await this.prisma.customer.count({ where: { tenantId } });
    }

    return {
      count,
      criteria: query,
    };
  }

  // ==================== 营销活动 ====================

  async createCampaign(user: JwtPayload, data: CreateCampaignDto) {
    const tenantId = user.tenantId!;

    // 今日已发送数量检查（每日限 500 条）
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todaySentCount = await this.prisma.notification.count({
      where: {
        tenantId,
        scene: 'marketing',
        createdAt: { gte: todayStart },
        status: { in: ['sent', 'pending'] },
      },
    });

    // 确定目标客户
    let targetCustomerIds = data.customerIds || [];

    if (targetCustomerIds.length === 0 && data.targetShopId) {
      // 通过门店获取所有客户
      const customers = await this.prisma.workOrder.findMany({
        where: { tenantId, shopId: data.targetShopId },
        select: { customerId: true },
        distinct: ['customerId'],
      });
      targetCustomerIds = [...new Set(customers.map(c => c.customerId))];
    }

    if (targetCustomerIds.length === 0) {
      throw new BadRequestException('未指定目标客户群体');
    }

    const totalToSend = targetCustomerIds.length;
    if (todaySentCount + totalToSend > 500) {
      throw new ForbiddenException(`今日营销短信已达限额（已发${todaySentCount}条，本次需发${totalToSend}条，剩余${Math.max(0, 500 - todaySentCount)}条）`);
    }

    // 获取客户手机号
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: targetCustomerIds }, tenantId },
      select: { id: true, phone: true, name: true },
    });

    // 批量创建通知记录
    const notifications = customers.map(c => ({
      tenantId,
      channel: 'sms' as const,
      scene: 'marketing',
      recipient: c.phone,
      content: data.content || data.name,
      status: 'pending' as const,
      relatedType: 'campaign',
      relatedId: data.name,
    }));

    await this.prisma.notification.createMany({ data: notifications });

    // 实际发送（异步）
    this.sendMarketingSms(tenantId, customers, data).catch(err => {
      this.logger.error(`营销短信发送失败: ${err.message}`);
    });

    this.logger.log(`营销活动创建: ${data.name}, 目标${totalToSend}人`);

    return {
      name: data.name,
      targetCount: totalToSend,
      status: 'sending',
      todayRemaining: Math.max(0, 500 - todaySentCount - totalToSend),
    };
  }

  private async sendMarketingSms(tenantId: string, customers: { id: string; phone: string; name: string }[], data: CreateCampaignDto) {
    // TODO: 调用阿里云营销短信模板发送
    // 当前为模拟发送，实际对接 TASK-202 的阿里短信服务
    for (const customer of customers) {
      const content = (data.content || data.name).replace('{name}', customer.name);
      try {
        await this.prisma.notification.updateMany({
          where: {
            tenantId,
            scene: 'marketing',
            recipient: customer.phone,
            relatedId: data.name,
            status: 'pending',
          },
          data: {
            status: 'sent',
            sentAt: new Date(),
            content,
          },
        });
      } catch (err) {
        this.logger.warn(`发送短信失败 ${customer.phone}: ${err.message}`);
      }
    }
  }

  // ==================== 优惠券 ====================

  async getCoupons(user: JwtPayload, query: { page?: number; pageSize?: number }) {
    const tenantId = user.tenantId!;
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where: { tenantId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.coupon.count({ where: { tenantId } }),
    ]);

    return { items, total, page, pageSize };
  }

  async createCoupon(user: JwtPayload, data: CreateCouponDto) {
    const tenantId = user.tenantId!;

    const coupon = await this.prisma.coupon.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type,
        discountValue: data.discountValue,
        conditionAmount: data.conditionAmount || 0,
        validDays: data.validDays || 30,
        totalQuantity: data.totalQuantity || 0,
        remark: data.remark,
      },
    });

    this.logger.log(`优惠券创建: ${coupon.name}`);
    return coupon;
  }

  async distributeCoupon(user: JwtPayload, couponId: string, data: DistributeCouponDto) {
    const tenantId = user.tenantId!;

    const coupon = await this.prisma.coupon.findFirst({
      where: { id: couponId, tenantId },
    });
    if (!coupon) throw new NotFoundException('优惠券不存在');
    if (coupon.status !== 'active') throw new ForbiddenException('优惠券已停用');
    if (coupon.totalQuantity > 0 && coupon.issuedQuantity + data.customerIds.length > coupon.totalQuantity) {
      throw new ForbiddenException('优惠券库存不足');
    }

    // 检查是否已经领取过
    const existingClaims = await this.prisma.couponClaim.findMany({
      where: {
        couponId,
        customerId: { in: data.customerIds },
        status: { notIn: ['expired'] },
      },
      select: { customerId: true },
    });

    const existingIds = new Set(existingClaims.map(c => c.customerId));
    const newCustomerIds = data.customerIds.filter(id => !existingIds.has(id));

    if (newCustomerIds.length === 0) {
      throw new BadRequestException('所有目标客户已领取过该优惠券');
    }

    // 创建领取记录
    const now = new Date();
    const expiresAt = new Date(now.getTime() + coupon.validDays * 24 * 60 * 60 * 1000);

    await this.prisma.couponClaim.createMany({
      data: newCustomerIds.map(customerId => ({
        tenantId,
        couponId,
        customerId,
        status: 'unused',
        expiredAt: expiresAt,
      })),
    });

    // 更新已发放数量
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: {
        issuedQuantity: { increment: newCustomerIds.length },
      },
    });

    this.logger.log(`优惠券发放: ${coupon.name}, ${newCustomerIds.length}张`);

    return {
      couponId,
      distributed: newCustomerIds.length,
      skipped: data.customerIds.length - newCustomerIds.length,
    };
  }

  // ==================== 优惠券核销（供 Settlement 调用） ====================

  async validateAndRedeemCoupon(tx: any, tenantId: string, couponClaimId: string, settlementAmount: number) {
    const claim = await tx.couponClaim.findFirst({
      where: { id: couponClaimId, tenantId, status: 'unused' },
      include: { coupon: true },
    });

    if (!claim) throw new NotFoundException('优惠券不存在或已使用');
    if (claim.expiredAt < new Date()) {
      throw new ForbiddenException('优惠券已过期');
    }

    const coupon = claim.coupon;
    if (coupon.type === 'full_reduction') {
      if (Number(settlementAmount) < Number(coupon.conditionAmount)) {
        throw new ForbiddenException(`未满足满减条件（需满¥${coupon.conditionAmount}）`);
      }
    }

    // 标记为已使用
    await tx.couponClaim.update({
      where: { id: couponClaimId },
      data: { status: 'used', usedAt: new Date() },
    });

    // 更新优惠券统计
    await tx.coupon.update({
      where: { id: coupon.couponId },
      data: { usedQuantity: { increment: 1 } },
    });

    // 计算优惠金额
    let discountAmount = 0;
    if (coupon.type === 'full_reduction') {
      discountAmount = Number(coupon.discountValue);
    } else if (coupon.type === 'discount') {
      discountAmount = Number(settlementAmount) * (1 - Number(coupon.discountValue));
    }

    return { discountAmount: Math.round(discountAmount * 100) / 100 };
  }

  async getCustomerCoupons(user: JwtPayload, customerId: string) {
    const tenantId = user.tenantId!;
    const now = new Date();

    return this.prisma.couponClaim.findMany({
      where: {
        tenantId,
        customerId,
        status: 'unused',
        expiredAt: { gt: now },
      },
      include: { coupon: true },
      orderBy: { expiredAt: 'asc' },
    });
  }
}
