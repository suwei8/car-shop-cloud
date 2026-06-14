import { Logger, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { SmsCodeService } from './sms-code.service';
import { RegistrationService } from './registration.service';
import { RegistrationController } from './registration.controller';
import { WechatLoginService } from './wechat-login.service';
import { PlatformTenantModule } from '../platform/tenant/tenant.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        if (secret.length < 32) {
          new Logger('AuthModule').warn(
            `JWT_SECRET 长度仅为 ${secret.length}，建议至少 32 个字符以确保安全强度`,
          );
        }
        return {
          secret,
          signOptions: {
            expiresIn: config.get('JWT_ACCESS_TOKEN_TTL', '15m'),
          },
        };
      },
      inject: [ConfigService],
    }),
    PlatformTenantModule,
    NotificationModule,
  ],
  controllers: [AuthController, RegistrationController],
  providers: [
    AuthService,
    JwtStrategy,
    SmsCodeService,
    RegistrationService,
    WechatLoginService,
  ],
  exports: [AuthService, SmsCodeService],
})
export class AuthModule {}
