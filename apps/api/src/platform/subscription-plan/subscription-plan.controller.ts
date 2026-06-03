import {
  Controller, Get, Post, Put,
  Body, Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionPlanService } from './subscription-plan.service';
import { Roles, RequirePermissions } from '../../common/decorators';
import { CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from './dto/subscription-plan.dto';

@ApiTags('platform/subscription-plans')
@ApiBearerAuth()
@Controller('platform/subscription-plans')
@Roles('platform_admin')
export class SubscriptionPlanController {
  constructor(private service: SubscriptionPlanService) {}

  @Get()
  @RequirePermissions('platform:plan:view')
  @ApiOperation({ summary: '套餐列表' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermissions('platform:plan:view')
  @ApiOperation({ summary: '套餐详情' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('platform:plan:manage')
  @ApiOperation({ summary: '创建套餐' })
  create(@Body() dto: CreateSubscriptionPlanDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions('platform:plan:manage')
  @ApiOperation({ summary: '编辑套餐' })
  update(@Param('id') id: string, @Body() dto: UpdateSubscriptionPlanDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/subscribe/:tenantId')
  @RequirePermissions('platform:plan:manage')
  @ApiOperation({ summary: '为商户开通套餐' })
  subscribe(@Param('id') id: string, @Param('tenantId') tenantId: string) {
    return this.service.subscribe(tenantId, id);
  }
}
