import { IsString, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExtendDto {
  @ApiProperty({ minimum: 1, maximum: 365 })
  @IsNumber()
  @Min(1)
  @Max(365)
  days: number;

  @ApiProperty()
  @IsString()
  reason: string;
}
