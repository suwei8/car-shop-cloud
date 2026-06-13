import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReminderService } from './reminder.service';
import { ReminderTaskService } from './reminder-task.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('reminders')
@ApiBearerAuth()
@Controller('reminders')
@TenantRequired()
export class ReminderController {
  constructor(
    private service: ReminderService,
    private taskService: ReminderTaskService,
  ) {}

  @Get()
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '提醒列表' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: { status?: string; type?: string; dueDate?: string; page?: number; pageSize?: number },
  ) {
    return this.service.findAll(user, query);
  }

  @Post(':id/handle')
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '标记提醒已处理' })
  handle(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { status: 'done' | 'ignored'; remark?: string },
  ) {
    return this.service.handle(user, id, body);
  }

  @Post('generate')
  @RequirePermissions('tenant:workorder:view')
  @ApiOperation({ summary: '手动触发生成提醒' })
  async generate(@CurrentUser() user: JwtPayload) {
    await this.taskService.generateForTenant(user.tenantId!);
    return { message: '生成完毕' };
  }
}
