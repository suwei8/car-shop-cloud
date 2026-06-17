import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { OcrService } from './ocr.service';

export class RecognizeDto {
  @IsString()
  @IsNotEmpty()
  imageBase64: string;
}

@ApiTags('ocr')
@ApiBearerAuth()
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('license-plate')
  @ApiOperation({ summary: '识别车牌号' })
  async recognizePlate(@Body() dto: RecognizeDto) {
    return this.ocrService.recognizePlate(dto.imageBase64);
  }

  @Post('vin')
  @ApiOperation({ summary: '识别 VIN 码' })
  async recognizeVin(@Body() dto: RecognizeDto) {
    return this.ocrService.recognizeVin(dto.imageBase64);
  }
}
