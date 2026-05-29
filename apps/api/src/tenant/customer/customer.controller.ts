import {
  Controller, Get, Post, Put,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
@TenantRequired()
export class CustomerController {
  constructor(private service: CustomerService) {}

  @Get()
  @RequirePermissions('tenant:customer:view')
  @ApiOperation({ summary: '客户列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; keyword?: string }) {
    return this.service.findAll(user, query);
  }

  @Get('search')
  @RequirePermissions('tenant:customer:view')
  @ApiOperation({ summary: '客户搜索（手机号/车牌/姓名）' })
  search(@CurrentUser() user: JwtPayload, @Query('keyword') keyword: string) {
    return this.service.search(user, keyword);
  }

  @Get(':id')
  @RequirePermissions('tenant:customer:view')
  @ApiOperation({ summary: '客户详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:customer:create')
  @ApiOperation({ summary: '创建客户' })
  create(@Body() body: { name: string; phone: string; gender?: string; email?: string; address?: string; remark?: string }, @CurrentUser() user: JwtPayload) {
    return this.service.create(body, user);
  }

  @Put(':id')
  @RequirePermissions('tenant:customer:update')
  @ApiOperation({ summary: '编辑客户' })
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, body, user);
  }
}
