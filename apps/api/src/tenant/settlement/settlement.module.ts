import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { SettlementController } from './settlement.controller';
import { PackageCardModule } from '../package-card/package-card.module';
import { PaymentGatewayModule } from '../payment/payment-gateway.module';
import { MarketingModule } from '../marketing/marketing.module';

@Module({
  imports: [PackageCardModule, PaymentGatewayModule, MarketingModule],
  controllers: [SettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
