import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeatureFlagService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.featureFlag.findMany();
  }

  async create(data: { code: string; name: string; description?: string }) {
    return this.prisma.featureFlag.create({ data });
  }

  async setTenantFlag(tenantId: string, featureFlagId: string, enabled: boolean) {
    return this.prisma.tenantFeatureFlag.upsert({
      where: { tenantId_featureFlagId: { tenantId, featureFlagId } },
      update: { enabled },
      create: { tenantId, featureFlagId, enabled },
    });
  }

  async getTenantFlags(tenantId: string) {
    return this.prisma.tenantFeatureFlag.findMany({
      where: { tenantId },
      include: { featureFlag: true },
    });
  }
}
