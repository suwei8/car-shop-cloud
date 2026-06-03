import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubscriptionPlanDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  priceYearly: number;

  @ApiProperty()
  @IsNumber()
  maxShops: number;

  @ApiProperty()
  @IsNumber()
  maxEmployees: number;

  @ApiPropertyOptional()
  @IsOptional()
  features?: Record<string, unknown>;
}

export class UpdateSubscriptionPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priceYearly?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxShops?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxEmployees?: number;

  @ApiPropertyOptional()
  @IsOptional()
  features?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}
