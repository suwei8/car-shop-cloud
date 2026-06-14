import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class SendCodeDto {
  @ApiProperty({ example: '13800000000' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '请输入正确的手机号' })
  phone: string;
}

export class RegisterDto {
  @ApiProperty({ example: '张三汽修店' })
  @IsString()
  @MinLength(2, { message: '店铺名称至少2个字符' })
  shopName: string;

  @ApiProperty({ example: '13800000000' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '请输入正确的手机号' })
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6, { message: '验证码至少6位' })
  code: string;

  @ApiProperty({ example: 'Abc12345' })
  @IsString()
  @IsStrongPassword()
  password: string;
}
