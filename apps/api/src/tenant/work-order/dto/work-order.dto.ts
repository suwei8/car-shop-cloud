import {
  IsString, IsOptional, IsNumber, IsArray, IsEnum, IsIn, ValidateNested, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkOrderItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partId?: string;

  @ApiProperty()
  @IsEnum(['service', 'part', 'addon'])
  itemType: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty()
  @IsNumber()
  unitPrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technicianId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateWorkOrderStatusDto {
  @ApiProperty({ enum: ['draft', 'confirmed', 'dispatching', 'in_progress', 'completed', 'cancelled'] })
  @IsIn(['draft', 'confirmed', 'dispatching', 'in_progress', 'completed', 'cancelled'])
  status: string;
}

export class AddWorkOrderItemsDto {
  @ApiProperty({ type: [CreateWorkOrderItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateWorkOrderItemDto)
  items: CreateWorkOrderItemDto[];
}

export class CreateWorkOrderDto {
  @ApiProperty()
  @IsString()
  shopId: string;

  @ApiProperty()
  @IsEnum(['repair', 'wash', 'quick'])
  orderType: string;

  @ApiProperty()
  @IsString()
  customerId: string;

  @ApiProperty()
  @IsString()
  vehicleId: string;

  @ApiProperty()
  @IsString()
  vehiclePlateNo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  vehicleMileage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  advisorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expectDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkOrderItemDto)
  items?: CreateWorkOrderItemDto[];
}
