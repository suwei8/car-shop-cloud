import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  async check() {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }

    return {
      status: db ? 'ok' : 'degraded',
      db,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
