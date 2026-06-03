import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInspectionDto {
  @ApiProperty()
  @IsString()
  workOrderId: string;

  @ApiProperty()
  @IsString()
  category: string;

  @ApiProperty()
  @IsString()
  item: string;

  @ApiProperty()
  @IsString()
  condition: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class UpdateInspectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  item?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class BatchCreateInspectionsDto {
  @ApiProperty()
  @IsString()
  workOrderId: string;

  @ApiProperty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInspectionDto)
  records: CreateInspectionDto[];
}
