import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CustomerWxLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class CustomerBindDto {
  @IsString()
  @IsNotEmpty()
  openid: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}

export class CustomerSwitchShopDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  customerId: string;
}
