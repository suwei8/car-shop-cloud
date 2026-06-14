import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RegistrationService } from './registration.service';
import { SendCodeDto, RegisterDto } from './dto';
import { Public } from '../common/decorators';
import { Request } from 'express';

@ApiTags('auth')
@Controller('auth')
export class RegistrationController {
  constructor(private registrationService: RegistrationService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register/send-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发送注册验证码' })
  async sendCode(@Body() dto: SendCodeDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return this.registrationService.sendCode(dto.phone, ip);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '商户注册' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return this.registrationService.register({
      shopName: dto.shopName,
      phone: dto.phone,
      code: dto.code,
      password: dto.password,
      businessType: dto.businessType,
      employeeCount: dto.employeeCount,
      ip,
    });
  }
}
