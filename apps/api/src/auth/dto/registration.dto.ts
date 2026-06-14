import { IsString, MinLength, Matches, IsOptional, IsIn, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional({ example: 'Abc12345', description: '密码（可选，小程序可不传）' })
  @IsOptional()
  @IsString()
  @IsStrongPassword()
  password?: string;

  @ApiProperty({ example: 'repair', enum: ['repair', 'wash_beauty', 'composite'] })
  @IsString()
  @IsIn(['repair', 'wash_beauty', 'composite'], { message: '经营类型必须为 repair/wash_beauty/composite' })
  businessType: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1, { message: '员工数至少为1' })
  employeeCount: number;
}
