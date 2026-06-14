import {
  IsString, IsOptional, IsNumber, Min, Max, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ---------------------------------------------------------------------------
// 允许上传的 MIME 类型白名单。
//   - 图片类：常见 Web 图片
//   - PDF：合同/报告
//   - Excel / CSV：数据导入
// 不在白名单内的 MIME 类型会在 DTO 校验层直接拒绝（HTTP 400）。
// ---------------------------------------------------------------------------
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  // PDF
  'application/pdf',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // CSV (data-import)
  'text/csv',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** 单文件最大 10MB */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export class GetUploadUrlDto {
  @ApiProperty({ description: '原始文件名 (会被服务端消毒)' })
  @IsString()
  originalName: string;

  @ApiProperty({
    description: '文件 MIME 类型，仅允许图片 / PDF / Excel / CSV',
    enum: ALLOWED_MIME_TYPES,
  })
  @IsString()
  @IsIn([...ALLOWED_MIME_TYPES], {
    message: `不支持的文件类型，允许：${ALLOWED_MIME_TYPES.join(', ')}`,
  })
  mimeType: string;

  @ApiProperty({ description: `文件大小（字节），最大 ${MAX_FILE_SIZE_BYTES}` })
  @IsNumber()
  @Min(1, { message: '文件大小不能为 0' })
  @Max(MAX_FILE_SIZE_BYTES, { message: '文件大小不能超过 10MB' })
  size: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessId?: string;
}
