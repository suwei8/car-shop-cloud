import { IsString, IsNumber, IsNotEmpty, Min, IsOptional } from 'class-validator';

export class RefundDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  operatorId?: string;
}
