import { IsString, IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PaySubscriptionOrderDto {
  @ApiProperty({ description: '支付方式', enum: ['wechat', 'alipay'] })
  @IsString()
  @IsIn(['wechat', 'alipay'])
  paymentMethod: string;

  @ApiProperty({ description: 'JSAPI openid（微信公众号支付时必填）', required: false })
  @IsOptional()
  @IsString()
  openid?: string;
}
