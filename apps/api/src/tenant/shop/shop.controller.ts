import {
  Controller, Get, Post, Put,
  Body, Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShopService } from './shop.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';
import { UpdateShopDto } from './dto/shop.dto';

@ApiTags('shops')
@ApiBearerAuth()
@Controller('shops')
@TenantRequired()
export class ShopController {
  constructor(private service: ShopService) {}

  @Get()
  @RequirePermissions('tenant:shop:view')
  @ApiOperation({ summary: '门店列表' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @RequirePermissions('tenant:shop:view')
  @ApiOperation({ summary: '门店详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:shop:create')
  @ApiOperation({ summary: '创建门店' })
  create(@Body() body: { name: string; address?: string; phone?: string }, @CurrentUser() user: JwtPayload) {
    return this.service.create(body, user);
  }

  @Put(':id')
  @RequirePermissions('tenant:shop:update')
  @ApiOperation({ summary: '编辑门店' })
  update(@Param('id') id: string, @Body() dto: UpdateShopDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }
}
