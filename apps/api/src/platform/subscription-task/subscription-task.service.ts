import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubscriptionTaskService {
  private readonly logger = new Logger(SubscriptionTaskService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private subscriptionGuard: SubscriptionGuard,
    private config: ConfigService,
  ) {}

  @Cron('0 0 2 * * *')
  async handleSubscriptionScan() {
    this.logger.log('Starting subscription lifecycle scan...');
    await this.scanAndUpdateSubscriptions();
  }

  async manualRun() {
    this.logger.log('Manual subscription scan triggered');
    return this.scanAndUpdateSubscriptions();
  }

  private async scanAndUpdateSubscriptions() {
    const graceDays = parseInt(this.config.get('GRACE_DAYS', '7'));
    const now = new Date();
    const graceDeadline = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);

    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      include: {
        subscriptions: {
          orderBy: { startAt: 'desc' },
          take: 1,
        },
      },
    });

    let updated = 0;

    for (const tenant of tenants) {
      const sub = tenant.subscriptions[0];
      if (!sub) continue;

      const newStatus = this.calculateStatus(sub, now, graceDeadline);

      if (newStatus !== tenant.subscriptionStatus) {
        const oldStatus = tenant.subscriptionStatus;

        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            subscriptionStatus: newStatus,
            subscriptionEndAt: sub.endAt,
          },
        });

        if (newStatus === 'suspended') {
          await this.prisma.tenantSubscription.update({
            where: { id: sub.id },
            data: { status: 'expired' },
          });
        }

        await this.auditService.log({
          tenantId: tenant.id,
          action: 'subscription_status_change',
          targetType: 'tenant',
          targetId: tenant.id,
          changes: { from: oldStatus, to: newStatus, subscriptionId: sub.id },
        });

        this.logger.log(
          `Tenant ${tenant.id} (${tenant.name}): ${oldStatus} → ${newStatus}`,
        );
        updated++;
      }
    }

    this.logger.log(`Subscription scan completed. ${updated} tenant(s) updated.`);
    return { scanned: tenants.length, updated };
  }

  private calculateStatus(
    subscription: { status: string; endAt: Date },
    now: Date,
    graceDeadline: Date,
  ): string {
    if (subscription.status === 'cancelled') {
      return 'suspended';
    }

    if (now <= subscription.endAt) {
      return subscription.status === 'trial' ? 'trial' : 'active';
    }

    if (graceDeadline <= subscription.endAt) {
      return 'grace';
    }

    return 'suspended';
  }
}
