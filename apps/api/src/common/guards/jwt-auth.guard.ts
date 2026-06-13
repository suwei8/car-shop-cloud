import { Injectable, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const path: string = request.path || request.url || '';
    if (path.includes('/customer-portal/')) {
      return true;
    }

    const result = super.canActivate(context);
    if (result instanceof Promise) {
      return result.then((valid) => {
        if (valid) {
          const req = context.switchToHttp().getRequest();
          if (req.user?.audience === 'customer') {
            throw new ForbiddenException('车主 Token 不可访问商户端接口');
          }
        }
        return valid;
      });
    }
    if (result) {
      if (request.user?.audience === 'customer') {
        throw new ForbiddenException('车主 Token 不可访问商户端接口');
      }
    }
    return result;
  }
}
