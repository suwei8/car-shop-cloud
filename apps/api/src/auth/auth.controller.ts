import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto';
import { Public, CurrentUser } from '../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '登录' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.phone, dto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新 token' })
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '退出登录' })
  async logout(@CurrentUser() user: JwtPayload) {
    return this.authService.logout(user.sub);
  }

  @Post('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }
}
