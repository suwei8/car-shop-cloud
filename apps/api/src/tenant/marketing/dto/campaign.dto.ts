import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty({ description: '活动名称' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '短信模板 Code', required: false })
  @IsOptional()
  @IsString()
  templateCode?: string;

  @ApiProperty({ description: '短信内容', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ description: '目标客户 ID 列表', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customerIds?: string[];

  @ApiProperty({ description: '目标门店 ID', required: false })
  @IsOptional()
  @IsString()
  targetShopId?: string;
}
