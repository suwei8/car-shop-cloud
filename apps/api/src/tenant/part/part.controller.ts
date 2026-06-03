import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PartService } from './part.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';
import { CreatePartDto, UpdatePartDto } from './dto/part.dto';

@ApiTags('parts')
@ApiBearerAuth()
@Controller('parts')
@TenantRequired()
export class PartController {
  constructor(private service: PartService) {}

  @Get()
  @RequirePermissions('tenant:inventory:view')
  @ApiOperation({ summary: '配件列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; keyword?: string; category?: string }) {
    return this.service.findAll(user, query);
  }

  @Get(':id')
  @RequirePermissions('tenant:inventory:view')
  @ApiOperation({ summary: '配件详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:inventory:manage')
  @ApiOperation({ summary: '创建配件' })
  create(@Body() dto: CreatePartDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @RequirePermissions('tenant:inventory:manage')
  @ApiOperation({ summary: '编辑配件' })
  update(@Param('id') id: string, @Body() dto: UpdatePartDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('tenant:inventory:manage')
  @ApiOperation({ summary: '删除配件' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }
}
