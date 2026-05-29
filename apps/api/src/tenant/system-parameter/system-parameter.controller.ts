import { Controller, Get, Put, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemParameterService } from './system-parameter.service';
import { CurrentUser, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('system-parameters')
@ApiBearerAuth()
@Controller('system-parameters')
@TenantRequired()
export class SystemParameterController {
  constructor(private service: SystemParameterService) {}

  @Get()
  @ApiOperation({ summary: '系统参数列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query('group') group?: string) {
    return this.service.findAll(user, group);
  }

  @Put()
  @ApiOperation({ summary: '更新系统参数' })
  upsert(@Body() body: { group: string; key: string; value: string; remark?: string }, @CurrentUser() user: JwtPayload) {
    return this.service.upsert(body, user);
  }
}
