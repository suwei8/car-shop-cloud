import { Module } from '@nestjs/common';
import { PackageCardService } from './package-card.service';
import { PackageCardController } from './package-card.controller';

@Module({
  controllers: [PackageCardController],
  providers: [PackageCardService],
  exports: [PackageCardService],
})
export class PackageCardModule {}
