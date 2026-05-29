import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FileService } from './file.service';
import { CurrentUser, TenantRequired } from '../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
@TenantRequired()
export class FileController {
  constructor(private service: FileService) {}

  @Post('upload-url')
  @ApiOperation({ summary: '获取文件上传预签名 URL' })
  getUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Body() body: { originalName: string; mimeType: string; size: number; source?: string; businessType?: string; businessId?: string },
  ) {
    return this.service.getUploadUrl(user, body);
  }

  @Get()
  @ApiOperation({ summary: '按业务对象查询文件' })
  findByBusiness(
    @CurrentUser() user: JwtPayload,
    @Query('businessType') businessType: string,
    @Query('businessId') businessId: string,
  ) {
    return this.service.findByBusiness(user.tenantId!, businessType, businessId);
  }
}
