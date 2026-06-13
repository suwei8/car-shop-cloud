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

  async getTenantFlagsAsMap(tenantId: string): Promise<Record<string, boolean>> {
    const flags = await this.prisma.tenantFeatureFlag.findMany({
      where: { tenantId },
      include: { featureFlag: true },
    });
    const result: Record<string, boolean> = {};
    for (const f of flags) {
      result[f.featureFlag.code] = f.enabled;
    }
    return result;
  }

  async isFlagEnabled(tenantId: string, flagCode: string): Promise<boolean> {
    const flag = await this.prisma.tenantFeatureFlag.findFirst({
      where: {
        tenantId,
        featureFlag: { code: flagCode },
      },
    });
    return flag?.enabled ?? false;
  }
}
