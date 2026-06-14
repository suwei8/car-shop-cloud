import { IsString, IsNotEmpty } from 'class-validator';

export class QueryPaymentDto {
  @IsString()
  @IsNotEmpty()
  paymentId: string;
}
