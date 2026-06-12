import {
  Controller, Get, Post, Put,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';
import { CreateDispatchDto, UploadPhotoDto } from './dto/dispatch.dto';

@ApiTags('dispatch')
@ApiBearerAuth()
@Controller('dispatch')
@TenantRequired()
export class DispatchController {
  constructor(private service: DispatchService) {}

  @Get()
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '派工任务列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: { page?: number; pageSize?: number; status?: string; technicianId?: string; workOrderId?: string }) {
    return this.service.findAll(user, query);
  }

  @Get('my-tasks')
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '我的任务（技师）' })
  getMyTasks(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.service.getMyTasks(user, { status });
  }

  @Get(':id')
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '派工任务详情' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '创建派工' })
  create(@Body() dto: CreateDispatchDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Put(':id/start')
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '开工' })
  start(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.start(id, user);
  }

  @Put(':id/pause')
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '暂停' })
  pause(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.pause(id, user);
  }

  @Put(':id/complete')
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '完工' })
  complete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.complete(id, user);
  }

  @Post(':id/photos')
  @RequirePermissions('tenant:workorder:update')
  @ApiOperation({ summary: '上传施工照片并联动车间状态' })
  uploadPhoto(
    @Param('id') id: string,
    @Body() dto: UploadPhotoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.uploadPhoto(id, dto, user);
  }
}
