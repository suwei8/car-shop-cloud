import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '@car/shared';

export const TENANT_REQUIRED = 'tenantRequired';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const tenantRequired = this.reflector.getAllAndOverride<boolean>(
      TENANT_REQUIRED,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) return true;

    // 平台用户访问平台接口不需要 tenantId
    if (user.isPlatform && !tenantRequired) return true;

    // 商户用户必须有 tenantId
    if (!user.isPlatform && !user.tenantId) {
      throw new ForbiddenException('缺少租户信息');
    }

    return true;
  }
}
