import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { RequirePermissions } from '../common/decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '@car/shared';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private service: NotificationService) {}

  @Get()
  @RequirePermissions('tenant:report:view')
  @ApiOperation({ summary: '通知记录列表' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: { page?: number; pageSize?: number; scene?: string; status?: string },
  ) {
    return this.service.findAll(user.tenantId!, query);
  }

  @Get('unread')
  @ApiOperation({ summary: '未读通知列表' })
  async getUnread(@CurrentUser() user: JwtPayload) {
    const result = await this.service.findAll(user.tenantId!, {
      status: 'pending',
      pageSize: 50,
    });
    return result;
  }
}
