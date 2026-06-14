import { IsOptional, IsDateString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnalyticsQueryDto {
  @ApiProperty({ description: '开始日期', required: false, example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: '结束日期', required: false, example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: '时间维度（营收趋势用）', required: false, enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  dimension?: 'day' | 'week' | 'month';

  @ApiProperty({ description: '门店 ID 筛选', required: false })
  @IsOptional()
  shopId?: string;
}
