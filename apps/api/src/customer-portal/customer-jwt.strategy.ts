import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@car/shared';

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'jwt-customer') {
  constructor(config: ConfigService) {
    const secret =
      config.get<string>('JWT_CUSTOMER_SECRET') ||
      config.get<string>('JWT_SECRET') + ':customer';
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (payload.audience !== 'customer') {
      throw new UnauthorizedException('非车主 Token，拒绝访问');
    }
    if (!payload.customerId || !payload.tenantId) {
      throw new UnauthorizedException('车主 Token 缺少必要信息');
    }
    return payload;
  }
}
