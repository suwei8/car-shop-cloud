import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VinDecoderService } from './vin-decoder.service';

@ApiTags('vin')
@ApiBearerAuth()
@Controller('vin')
export class VinDecoderController {
  constructor(private readonly vinDecoderService: VinDecoderService) {}

  @Get('decode')
  @ApiOperation({ summary: '通过 VIN 码查询车辆信息' })
  @ApiQuery({ name: 'vin', description: '17位 VIN 码', example: 'LSVAU2180N2123456' })
  async decodeVin(@Query('vin') vin: string) {
    if (!vin || vin.length !== 17) {
      return {
        code: 400,
        message: 'VIN 码必须是 17 位',
        data: null,
      };
    }

    const result = await this.vinDecoderService.decodeVin(vin);
    
    if (result) {
      return {
        code: 0,
        message: 'ok',
        data: result,
      };
    } else {
      return {
        code: 0,
        message: '未找到该 VIN 码对应的车辆信息',
        data: null,
      };
    }
  }
}
