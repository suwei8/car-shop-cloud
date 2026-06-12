import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FileService } from './file.service';
import { CurrentUser, TenantRequired } from '../common/decorators';
import { JwtPayload } from '@car/shared';
import { GetUploadUrlDto } from './dto/file.dto';

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
    @Body() dto: GetUploadUrlDto,
  ) {
    return this.service.getUploadUrl(user, dto);
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
