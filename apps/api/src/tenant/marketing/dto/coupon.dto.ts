import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, IsIn, Max, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCouponDto {
  @ApiProperty({ description: '优惠券名称' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '类型', enum: ['full_reduction', 'discount'] })
  @IsString()
  @IsIn(['full_reduction', 'discount'])
  type: string;

  @ApiProperty({ description: '优惠值(满减金额或折扣率如0.85)' })
  @IsNumber()
  @Min(0.01)
  discountValue: number;

  @ApiProperty({ description: '满减门槛金额(折扣类型时为0)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  conditionAmount?: number;

  @ApiProperty({ description: '领取后有效天数', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  validDays?: number;

  @ApiProperty({ description: '总发行量(0=不限)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalQuantity?: number;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class DistributeCouponDto {
  @ApiProperty({ description: '目标客户 ID 列表' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  customerIds: string[];
}
