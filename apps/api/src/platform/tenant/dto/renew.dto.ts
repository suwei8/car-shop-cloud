import { IsString, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RenewDto {
  @ApiProperty()
  @IsString()
  planId: string;

  @ApiProperty({ minimum: 1, maximum: 120 })
  @IsNumber()
  @Min(1)
  @Max(120)
  months: number;
}
