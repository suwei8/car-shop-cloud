import { IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RenewDto {
  @ApiProperty()
  @IsString()
  planId: string;

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  months: number;
}
