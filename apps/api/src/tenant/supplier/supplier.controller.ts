import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupplierService } from './supplier.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('suppliers')
@TenantRequired()
export class SupplierController {
  constructor(private service: SupplierService) {}

  @Get()
  @RequirePermissions('tenant:inventory:view')
  @ApiOperation({ summary: '供货商列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query('keyword') keyword?: string) {
    return this.service.findAll(user, { keyword });
  }

  @Get(':id')
  @RequirePermissions('tenant:inventory:view')
  @ApiOperation({ summary: '供货商详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:inventory:manage')
  @ApiOperation({ summary: '创建供货商' })
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @RequirePermissions('tenant:inventory:manage')
  @ApiOperation({ summary: '编辑供货商' })
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('tenant:inventory:manage')
  @ApiOperation({ summary: '删除供货商' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }
}
