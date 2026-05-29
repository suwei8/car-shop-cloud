import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import { RequirePermissions } from '../../common/decorators';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionController {
  constructor(private service: PermissionService) {}

  @Get()
  @RequirePermissions('tenant:role:view')
  @ApiOperation({ summary: '权限列表' })
  findAll(@Query('module') module?: string) {
    return this.service.findAll(module);
  }

  @Get('grouped')
  @RequirePermissions('tenant:role:view')
  @ApiOperation({ summary: '按模块分组的权限列表' })
  findByModules() {
    return this.service.findByModules();
  }
}
