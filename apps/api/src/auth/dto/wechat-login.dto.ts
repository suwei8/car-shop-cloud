import { IsString, MinLength, Matches, IsOptional, IsIn, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WechatLoginDto {
  @ApiProperty({ description: '微信小程序 login code' })
  @IsString()
  code: string;
}

export class WechatBindDto {
  @ApiProperty({ description: '微信小程序 login code' })
  @IsString()
  code: string;

  @ApiProperty({ example: '13800000000' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '请输入正确的手机号' })
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6, { message: '验证码至少6位' })
  smsCode: string;

  @ApiPropertyOptional({ example: '张三汽修店' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: '店铺名称至少2个字符' })
  shopName?: string;

  @ApiPropertyOptional({ example: 'repair', enum: ['repair', 'wash_beauty', 'composite'] })
  @IsOptional()
  @IsString()
  @IsIn(['repair', 'wash_beauty', 'composite'], { message: '经营类型必须为 repair/wash_beauty/composite' })
  businessType?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1, { message: '员工数至少为1' })
  employeeCount?: number;

  @ApiPropertyOptional({ example: '北京市朝阳区xxx路xxx号' })
  @IsOptional()
  @IsString()
  address?: string;
}
