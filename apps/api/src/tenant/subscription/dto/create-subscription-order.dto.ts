import { IsString, IsIn, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionOrderDto {
  @ApiProperty({ description: '套餐 ID' })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ description: '购买月数', enum: [1, 3, 6, 12] })
  @IsNumber()
  @IsIn([1, 3, 6, 12])
  months: number;

  @ApiProperty({ description: '支付方式', enum: ['wechat', 'alipay'] })
  @IsString()
  @IsIn(['wechat', 'alipay'])
  paymentMethod: string;
}
