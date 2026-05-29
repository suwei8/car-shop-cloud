import {
  Controller, Get, Post, Put,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VehicleService } from './vehicle.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('vehicles')
@ApiBearerAuth()
@Controller('vehicles')
@TenantRequired()
export class VehicleController {
  constructor(private service: VehicleService) {}

  @Get()
  @RequirePermissions('tenant:vehicle:view')
  @ApiOperation({ summary: '车辆列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; keyword?: string; customerId?: string }) {
    return this.service.findAll(user, query);
  }

  @Get('search')
  @RequirePermissions('tenant:vehicle:view')
  @ApiOperation({ summary: '车辆搜索（车牌/VIN/客户手机号）' })
  search(@CurrentUser() user: JwtPayload, @Query('keyword') keyword: string) {
    return this.service.search(user, keyword);
  }

  @Get('model-library')
  @RequirePermissions('tenant:vehicle:view')
  @ApiOperation({ summary: '车型库（品牌/车系/年份/车型选项）' })
  getModelLibrary(@CurrentUser() user: JwtPayload) {
    return this.service.getModelLibrary(user);
  }

  @Get(':id')
  @RequirePermissions('tenant:vehicle:view')
  @ApiOperation({ summary: '车辆详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:vehicle:create')
  @ApiOperation({ summary: '创建车辆' })
  create(@Body() body: any, @CurrentUser() user: JwtPayload) {
    return this.service.create(body, user);
  }

  @Put(':id')
  @RequirePermissions('tenant:vehicle:update')
  @ApiOperation({ summary: '编辑车辆' })
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, body, user);
  }
}
