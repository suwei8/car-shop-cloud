import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SuspendDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
