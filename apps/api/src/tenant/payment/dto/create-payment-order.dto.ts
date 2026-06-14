import { IsString, IsIn, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePaymentOrderDto {
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @IsString()
  @IsIn(['wechat', 'alipay'])
  method: 'wechat' | 'alipay';

  @IsOptional()
  @IsString()
  @IsIn(['NATIVE', 'JSAPI'])
  tradeType?: 'NATIVE' | 'JSAPI';

  @IsOptional()
  @IsString()
  openid?: string;
}
