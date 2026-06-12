import {
  IsString, IsOptional, IsNumber, IsArray, IsDateString, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConsumePackageCardDto {
  @ApiProperty()
  @IsString()
  serviceItemId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty()
  @IsString()
  relatedType: string;

  @ApiProperty()
  @IsString()
  relatedId: string;
}

class CreatePackageCardItemDto {
  @ApiProperty()
  @IsString()
  serviceItemId: string;

  @ApiProperty()
  @IsNumber()
  totalQty: number;
}

export class CreatePackageCardDto {
  @ApiProperty()
  @IsString()
  cardNo: string;

  @ApiProperty()
  @IsString()
  customerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  shopIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsDateString()
  startAt: string;

  @ApiProperty()
  @IsDateString()
  endAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiProperty()
  @IsArray()
  items: CreatePackageCardItemDto[];
}
