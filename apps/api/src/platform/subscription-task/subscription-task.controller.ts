import { Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionTaskService } from './subscription-task.service';
import { Roles, RequirePermissions } from '../../common/decorators';

@ApiTags('platform/subscription-tasks')
@ApiBearerAuth()
@Controller('platform/subscription-tasks')
@Roles('platform_admin')
export class SubscriptionTaskController {
  constructor(private service: SubscriptionTaskService) {}

  @Post('run')
  @RequirePermissions('platform:tenant:manage')
  @ApiOperation({ summary: '手动触发订阅状态扫描' })
  run() {
    return this.service.manualRun();
  }
}
