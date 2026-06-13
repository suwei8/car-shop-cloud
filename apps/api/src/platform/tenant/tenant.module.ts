import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PlatformTenantService } from './tenant.service';
import { PlatformTenantController } from './tenant.controller';
import { TenantInitializerService } from './tenant-initializer.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
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
  ],
  controllers: [PlatformTenantController],
  providers: [PlatformTenantService, TenantInitializerService],
  exports: [PlatformTenantService, TenantInitializerService],
})
export class PlatformTenantModule {}
