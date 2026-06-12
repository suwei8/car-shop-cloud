import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

const READONLY_STATUSES = ['suspended'];

@Injectable()
export class SubscriptionGuard implements CanActivate {
  private cache = new Map<string, { status: string; ts: number }>();
  private readonly CACHE_TTL = 60_000;

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    if (!user) return true;

    if (user.isPlatform) return true;

    if (!user.tenantId) return true;

    const status = await this.getTenantSubscriptionStatus(user.tenantId);

    if (READONLY_STATUSES.includes(status)) {
      if (request.method !== 'GET') {
        throw new ForbiddenException('订阅已到期，系统处于只读模式，请联系服务商续费');
      }
    }

    return true;
  }

  private async getTenantSubscriptionStatus(tenantId: string): Promise<string> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) {
      return cached.status;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionStatus: true },
    });

    const status = tenant?.subscriptionStatus || 'trial';
    this.cache.set(tenantId, { status, ts: Date.now() });
    return status;
  }

  invalidateCache(tenantId?: string) {
    if (tenantId) {
      this.cache.delete(tenantId);
    } else {
      this.cache.clear();
    }
  }
}
