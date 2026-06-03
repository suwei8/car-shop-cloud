import {
  Controller, Get, Post,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PackageCardService } from './package-card.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';
import { CreatePackageCardDto } from './dto/package-card.dto';

@ApiTags('package-cards')
@ApiBearerAuth()
@Controller('package-cards')
@TenantRequired()
export class PackageCardController {
  constructor(private service: PackageCardService) {}

  @Get()
  @RequirePermissions('tenant:member:view')
  @ApiOperation({ summary: '套餐卡列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; customerId?: string; status?: string }) {
    return this.service.findAll(user, query);
  }

  @Get('transactions')
  @RequirePermissions('tenant:member:view')
  @ApiOperation({ summary: '套餐核销流水' })
  getTransactions(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; cardId?: string }) {
    return this.service.getTransactions(user, query);
  }

  @Get(':id')
  @RequirePermissions('tenant:member:view')
  @ApiOperation({ summary: '套餐卡详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:member:manage')
  @ApiOperation({ summary: '售卡' })
  create(@Body() dto: CreatePackageCardDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Post(':id/consume')
  @RequirePermissions('tenant:member:manage')
  @ApiOperation({ summary: '核销' })
  consume(@Param('id') id: string, @Body() body: { serviceItemId: string; quantity: number; relatedType: string; relatedId: string }, @CurrentUser() user: JwtPayload) {
    return this.service.consume(id, body, user);
  }
}
