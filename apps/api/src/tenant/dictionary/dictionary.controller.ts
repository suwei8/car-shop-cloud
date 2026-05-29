import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DictionaryService } from './dictionary.service';
import { CurrentUser, TenantRequired } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('dictionaries')
@ApiBearerAuth()
@Controller('dictionaries')
@TenantRequired()
export class DictionaryController {
  constructor(private service: DictionaryService) {}

  @Get()
  @ApiOperation({ summary: '字典列表' })
  findAll(@CurrentUser() user: JwtPayload, @Query('type') type?: string) {
    return this.service.findAll(user, type);
  }

  @Post()
  @ApiOperation({ summary: '创建字典项' })
  create(@Body() body: { type: string; code: string; name: string; sort?: number }, @CurrentUser() user: JwtPayload) {
    return this.service.create(body, user);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑字典项' })
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, body, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除字典项' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }
}
