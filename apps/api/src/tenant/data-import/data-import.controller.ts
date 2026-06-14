import {
  Controller, Get, Post, Body, UploadedFile, UseInterceptors,
  HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { DataImportService } from './data-import.service';
import { CurrentUser, RequirePermissions, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';
import { Response } from 'express';
import { Res } from '@nestjs/common';

@ApiTags('data-import')
@ApiBearerAuth()
@Controller('data-import')
@TenantRequired()
export class DataImportController {
  constructor(private readonly dataImportService: DataImportService) {}

  @Get('template')
  @RequirePermissions('tenant:customer:create')
  @ApiOperation({ summary: '下载导入模板' })
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.dataImportService.generateTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="data_import_template.xlsx"',
    });
    res.end(buffer);
  }

  @Post('preview')
  @RequirePermissions('tenant:customer:create')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '预览校验导入数据' })
  async preview(
    @UploadedFile() file: any,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('请上传Excel文件');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('文件大小不能超过5MB');
    }

    return this.dataImportService.preview(file.buffer, user);
  }

  @Post('execute')
  @RequirePermissions('tenant:customer:create')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '执行导入' })
  async execute(
    @UploadedFile() file: any,
    @Body('previewData') previewData: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('请上传Excel文件');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('文件大小不能超过5MB');
    }

    if (!previewData) {
      throw new BadRequestException('缺少预览数据，请先执行预览步骤');
    }

    let previewResult: any;
    try {
      previewResult = JSON.parse(previewData);
    } catch {
      throw new BadRequestException('预览数据格式错误');
    }

    const hasErrors =
      previewResult.customers.errors.length > 0 ||
      previewResult.vehicles.errors.length > 0 ||
      previewResult.storedValueCards.errors.length > 0;

    if (hasErrors) {
      throw new BadRequestException('数据中存在错误行，请修正后重新上传');
    }

    return this.dataImportService.execute(file.buffer, previewResult, user);
  }
}
