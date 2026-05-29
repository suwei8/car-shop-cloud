import { Module } from '@nestjs/common';
import { PartService } from './part.service';
import { PartController } from './part.controller';

@Module({
  controllers: [PartController],
  providers: [PartService],
  exports: [PartService],
})
export class PartModule {}
