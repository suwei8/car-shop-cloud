import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../common/validators/password.validator';

export class CreateTenantDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ description: '管理员初始密码（至少8位，必须包含字母和数字）' })
  @IsString()
  @IsStrongPassword()
  password: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: '留空则不修改密码（至少8位，必须包含字母和数字）' })
  @IsOptional()
  @IsString()
  @IsStrongPassword()
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['active', 'suspended', 'expired'])
  status?: string;
}
