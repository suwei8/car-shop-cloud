import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalAuthService } from './customer-portal-auth.service';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerJwtStrategy } from './customer-jwt.strategy';
import { CustomerJwtAuthGuard } from './customer-jwt-auth.guard';
import { SmsCodeService } from '../auth/sms-code.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => {
        const secret =
          config.get<string>('JWT_CUSTOMER_SECRET') ||
          config.get<string>('JWT_SECRET') + ':customer';
        return {
          secret,
          signOptions: { expiresIn: '7d' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [CustomerPortalController],
  providers: [
    CustomerPortalAuthService,
    CustomerPortalService,
    CustomerJwtStrategy,
    CustomerJwtAuthGuard,
    SmsCodeService,
  ],
  exports: [CustomerPortalService],
})
export class CustomerPortalModule {}
