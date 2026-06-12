import {
  IsString, IsOptional, IsNumber, IsArray, ValidateNested, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentItemDto {
  @ApiProperty()
  @IsString()
  payMethod: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remark?: string;
}

export class PackageRedemptionDto {
  @ApiProperty()
  @IsString()
  cardId: string;

  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty()
  @IsString()
  serviceItemId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class SettleDto {
  @ApiProperty()
  @IsString()
  workOrderId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiProperty({ type: [PaymentItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  payments: PaymentItemDto[];

  @ApiPropertyOptional({ type: [PackageRedemptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackageRedemptionDto)
  packageRedemptions?: PackageRedemptionDto[];
}
