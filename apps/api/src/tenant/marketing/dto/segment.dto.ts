import { IsOptional, IsNumber, IsString, Min, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SegmentPreviewDto {
  @ApiProperty({ description: '消费金额大于(元)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minSpendAmount?: number;

  @ApiProperty({ description: '消费次数大于等于', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderCount?: number;

  @ApiProperty({ description: '未到店天数大于', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  inactiveDays?: number;

  @ApiProperty({ description: '来源筛选', required: false, enum: ['walk_in', 'online'] })
  @IsOptional()
  @IsString()
  @IsIn(['walk_in', 'online'])
  source?: string;
}
