import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceItemService } from './service-item.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';
import { CreateServiceItemDto, UpdateServiceItemDto } from './dto/service-item.dto';

@ApiTags('service-items')
@ApiBearerAuth()
@Controller('service-items')
@TenantRequired()
export class ServiceItemController {
  constructor(private service: ServiceItemService) {}

  @Get()
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '服务项目列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: { category?: string; keyword?: string }) {
    return this.service.findAll(user, query);
  }

  @Get(':id')
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '服务项目详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:workorder:create')
  @ApiOperation({ summary: '创建服务项目' })
  create(@Body() dto: CreateServiceItemDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '编辑服务项目' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceItemDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '删除服务项目' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }
}
