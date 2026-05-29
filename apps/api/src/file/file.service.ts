import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '@car/shared';

@Injectable()
export class FileService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

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
    const bucket = this.config.get('S3_BUCKET', 'car-shop');
    const endpoint = this.config.get('S3_ENDPOINT', 'http://localhost:9000');
    const url = `${endpoint}/${bucket}/${fileName}`;

    const file = await this.prisma.file.create({
      data: {
        tenantId: user.tenantId!,
        uploadedBy: user.sub,
        originalName: data.originalName,
        fileName,
        mimeType: data.mimeType,
        size: data.size,
        url,
        source: data.source,
        businessType: data.businessType,
        businessId: data.businessId,
      },
    });

    return {
      fileId: file.id,
      uploadUrl: url,
      fileUrl: url,
    };
  }

  async findByBusiness(tenantId: string, businessType: string, businessId: string) {
    return this.prisma.file.findMany({
      where: { tenantId, businessType, businessId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
