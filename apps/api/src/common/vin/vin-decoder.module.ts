import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VinDecoderController } from './vin-decoder.controller';
import { VinDecoderService } from './vin-decoder.service';

@Module({
  imports: [HttpModule],
  controllers: [VinDecoderController],
  providers: [VinDecoderService],
  exports: [VinDecoderService],
})
export class VinDecoderModule {}
