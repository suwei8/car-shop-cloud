import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentCallbackController } from './payment-callback.controller';
import { PaymentProvider } from './providers/payment-provider.interface';
import { MockPayProvider } from './providers/mock-pay.provider';
import { WechatPayProvider } from './providers/wechat-pay.provider';
import { AlipayProvider } from './providers/alipay.provider';

@Module({
  controllers: [PaymentCallbackController],
  providers: [
    {
      provide: 'PAYMENT_PROVIDERS',
      inject: [ConfigService],
      useFactory: (config: ConfigService): PaymentProvider[] => {
        const provider = config.get<string>('PAYMENT_PROVIDER', 'mock');
        const providers: PaymentProvider[] = [];

        if (provider === 'mock') {
          providers.push(new MockPayProvider());
        } else {
          if (provider === 'wechat' || provider === 'all') {
            providers.push(new WechatPayProvider(config));
          }
          if (provider === 'alipay' || provider === 'all') {
            providers.push(new AlipayProvider(config));
          }
        }

        if (providers.length === 0) {
          providers.push(new MockPayProvider());
        }

        return providers;
      },
    },
    PaymentGatewayService,
  ],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}
