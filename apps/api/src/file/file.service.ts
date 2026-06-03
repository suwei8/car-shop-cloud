import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '@car/shared';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

  async getUploadUrl(user: JwtPayload, data: {
    originalName: string;
    mimeType: string;
    size: number;
    source?: string;
    businessType?: string;
    businessId?: string;
  }) {
    const ext = data.originalName.split('.').pop();
    const fileName = `${user.tenantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const bucket = this.config.get('S3_BUCKET', 'batam');
    
    // 生成 OCI 预签名直传链接 (PUT)
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      ContentType: data.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });

    // OCI 的原生公共只读只链格式：
    // https://objectstorage.ap-batam-1.oraclecloud.com/n/AXL6OZAW08TJ/b/batam/o/{fileName}
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
        originalName: data.originalName,
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

