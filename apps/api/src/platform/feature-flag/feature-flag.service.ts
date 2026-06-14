import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);
  private redis: Redis | null = null;
  private readonly CACHE_TTL = 60;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    try {
      const redisUrl = this.config.get<string>('API_REDIS_URL')
        || this.config.get<string>('REDIS_URL')
        || 'redis://localhost:6379';
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      this.redis.connect().catch((err) => {
        this.logger.warn(`Redis connection failed, falling back to DB: ${err.message}`);
        this.redis = null;
      });
      this.redis.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
      });
    } catch (err) {
      this.logger.warn('Redis initialization failed, using DB only');
      this.redis = null;
    }
  }

  async findAll() {
    return this.prisma.featureFlag.findMany();
  }

  async create(data: { code: string; name: string; description?: string }) {
    return this.prisma.featureFlag.create({ data });
  }

  async isFlagEnabled(tenantId: string, flagCode: string): Promise<boolean> {
    const cacheKey = `ff:${tenantId}:${flagCode}`;

    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached !== null) {
          return cached === '1';
        }
      } catch (err) {
        this.logger.warn(`Redis get failed for ${cacheKey}: ${err.message}`);
      }
    }

    const flag = await this.prisma.tenantFeatureFlag.findFirst({
      where: {
        tenantId,
        featureFlag: { code: flagCode },
      },
    });
    const enabled = flag?.enabled ?? false;

    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, this.CACHE_TTL, enabled ? '1' : '0');
      } catch (err) {
        this.logger.warn(`Redis setex failed for ${cacheKey}: ${err.message}`);
      }
    }

    return enabled;
  }

  async getTenantFlagsAsMap(tenantId: string): Promise<Record<string, boolean>> {
    const cacheKey = `ff:map:${tenantId}`;

    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached !== null) {
          return JSON.parse(cached);
        }
      } catch (err) {
        this.logger.warn(`Redis get failed for ${cacheKey}: ${err.message}`);
      }
    }

    const flags = await this.prisma.tenantFeatureFlag.findMany({
      where: { tenantId },
      include: { featureFlag: true },
    });
    const result: Record<string, boolean> = {};
    for (const f of flags) {
      result[f.featureFlag.code] = f.enabled;
    }

    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
      } catch (err) {
        this.logger.warn(`Redis setex failed for ${cacheKey}: ${err.message}`);
      }
    }

    return result;
  }

  async getTenantFlags(tenantId: string) {
    return this.prisma.tenantFeatureFlag.findMany({
      where: { tenantId },
      include: { featureFlag: true },
    });
  }

  async setTenantFlag(tenantId: string, featureFlagId: string, enabled: boolean) {
    const result = await this.prisma.tenantFeatureFlag.upsert({
      where: { tenantId_featureFlagId: { tenantId, featureFlagId } },
      update: { enabled },
      create: { tenantId, featureFlagId, enabled },
    });

    const flag = await this.prisma.featureFlag.findUnique({ where: { id: featureFlagId } });
    await this.invalidateCache(tenantId, flag?.code);

    return result;
  }

  async invalidateCache(tenantId: string, flagCode?: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(`ff:map:${tenantId}`);
      if (flagCode) {
        await this.redis.del(`ff:${tenantId}:${flagCode}`);
      } else {
        const pattern = `ff:${tenantId}:*`;
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } while (cursor !== '0');
      }
    } catch (err) {
      this.logger.warn(`Redis invalidate failed for tenant ${tenantId}: ${err.message}`);
    }
  }
}
