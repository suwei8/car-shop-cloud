import {
  IsString, IsOptional, IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDispatchDto {
  @ApiProperty()
  @IsString()
  workOrderId: string;

  @ApiProperty()
  @IsString()
  technicianId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  itemIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workPlace?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  team?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assistantIds?: string;
}

export class UploadPhotoDto {
  @ApiProperty()
  @IsString()
  fileUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originalName?: string;
}
