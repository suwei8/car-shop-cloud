import { IsString, IsOptional, IsDateString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAppointmentStatusDto {
  @ApiProperty({ enum: ['pending', 'confirmed', 'cancelled', 'completed'] })
  @IsIn(['pending', 'confirmed', 'cancelled', 'completed'])
  status: string;
}

export class CreateAppointmentDto {
  @ApiProperty()
  @IsString()
  shopId: string;

  @ApiProperty()
  @IsString()
  customerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiProperty()
  @IsString()
  serviceType: string;

  @ApiProperty()
  @IsDateString()
  appointTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remark?: string;
}
