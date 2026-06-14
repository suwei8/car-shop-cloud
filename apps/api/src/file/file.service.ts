import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '@car/shared';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from './dto/file.dto';

@Injectable()
export class FileService {
  private s3Client: S3Client;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const region = this.config.get<string>('S3_REGION');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>('S3_SECRET_KEY');

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
      forcePathStyle: true,
    });
  }

  // ---------------------------------------------------------------------------
  // Filename sanitization — strips path traversal, control chars, and any
  // non-alphanumeric / non-CJK punctuation. Exported as a static so unit tests
  // can exercise it without instantiating the full service.
  // ---------------------------------------------------------------------------
  static sanitizeFileName(name: string): string {
    if (typeof name !== 'string') return 'unnamed';
    // Strip any path separators (defeat ../../../etc/passwd style traversal).
    let sanitized = name.replace(/[\/\\]/g, '');
    // Keep: ASCII letters, digits, CJK unified ideographs, underscore, hyphen, dot.
    sanitized = sanitized.replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '');
    // Collapse leading dots (hidden-file tricks) and fall back to a safe name.
    sanitized = sanitized.replace(/^\.+/, '');
    if (!sanitized) return 'unnamed';
    // Cap length (preserve extension if possible).
    if (sanitized.length > 200) {
      const dotIdx = sanitized.lastIndexOf('.');
      const ext = dotIdx > 0 ? sanitized.slice(dotIdx) : '';
      sanitized = sanitized.slice(0, 200 - ext.length) + ext;
    }
    return sanitized;
  }

  async getUploadUrl(user: JwtPayload, data: {
    originalName: string;
    mimeType: string;
    size: number;
    source?: string;
    businessType?: string;
    businessId?: string;
  }) {
    // Defense-in-depth: DTO already validates, but re-check here so any
    // future caller (service-to-service, queue, etc.) cannot bypass.
    if (!ALLOWED_MIME_TYPES.includes(data.mimeType as any)) {
      throw new BadRequestException(
        `不支持的文件类型：${data.mimeType}，允许：${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }
    if (!Number.isInteger(data.size) || data.size <= 0) {
      throw new BadRequestException('文件大小无效');
    }
    if (data.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('文件大小不能超过 10MB');
    }

    const safeName = FileService.sanitizeFileName(data.originalName);
    const ext = safeName.includes('.') ? safeName.split('.').pop() : '';
    const fileName = `${user.tenantId}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`;
    const bucket = this.config.get('S3_BUCKET', 'batam');

    // 生成 OCI 预签名直传链接 (PUT)
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      ContentType: data.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });

    const endpoint = this.config.get<string>('S3_ENDPOINT') || '';
    const region = this.config.get<string>('S3_REGION', 'ap-batam-1');
    let namespace = 'axl6ozaw08tj';
    const match = endpoint.match(/https?:\/\/([^.]+)\.compat/);
    if (match) {
      namespace = match[1];
    }

    const fileUrl = `https://objectstorage.${region}.oraclecloud.com/n/${namespace}/b/${bucket}/o/${fileName}`;

    const file = await this.prisma.file.create({
      data: {
        tenantId: user.tenantId!,
        uploadedBy: user.sub,
        originalName: safeName,
        fileName,
        mimeType: data.mimeType,
        size: data.size,
        url: fileUrl,
        source: data.source,
        businessType: data.businessType,
        businessId: data.businessId,
      },
    });

    return {
      fileId: file.id,
      uploadUrl,
      fileUrl,
    };
  }

  async findByBusiness(tenantId: string, businessType: string, businessId: string) {
    return this.prisma.file.findMany({
      where: { tenantId, businessType, businessId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
