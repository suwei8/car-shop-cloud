import { IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExtendDto {
  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  days: number;

  @ApiProperty()
  @IsString()
  reason: string;
}
