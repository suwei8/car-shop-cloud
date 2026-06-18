#!/usr/bin/env node

/**
 * Read-only audit script: scan User.phone for duplicates.
 * Classifies risk levels and outputs a human-readable summary.
 *
 * Usage:
 *   pnpm --filter @car/api exec ts-node scripts/audit-login-phones.ts
 *   pnpm --filter @car/api exec ts-node scripts/audit-login-phones.ts -- --json report.json
 *   pnpm --filter @car/api exec ts-node scripts/audit-login-phones.ts -- --strict
 *
 * Exit codes:
 *   0 — no high-risk duplicates (or --strict not set)
 *   1 — high-risk duplicates found and --strict is set
 *   2 — script error
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// ── CLI args ──

const args = process.argv.slice(2);

function readOptionValue(flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    console.error(`ERROR: ${flag} requires a file path.`);
    process.exit(2);
  }
  return value;
}

const jsonPath = readOptionValue('--json');
const strict = args.includes('--strict');

// ── Helpers ──

function maskPhone(phone: string | null): string {
  if (!phone || phone.length < 7) return phone ?? '(null)';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

function nowISO(): string {
  return new Date().toISOString();
}

function findRepoRoot(startDir: string): string {
  let current = startDir;
  while (true) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

function resolveOutputPath(outputPath: string): string {
  if (path.isAbsolute(outputPath)) return outputPath;
  return path.resolve(findRepoRoot(__dirname), outputPath);
}

// ── Main ──

interface UserRecord {
  id: string;
  tenantId: string | null;
  phone: string;
  name: string;
  status: string;
  isPlatform: boolean;
  createdAt: Date;
  updatedAt: Date;
  tenant: { id: string; name: string } | null;
}

interface DuplicateGroup {
  phone: string;
  risk: 'high' | 'medium';
  reason: string;
  users: {
    id: string;
    tenantId: string | null;
    tenantName: string | null;
    name: string;
    phone: string;
    status: string;
    isPlatform: boolean;
    createdAt: Date;
    updatedAt: Date;
  }[];
}

interface AbnormalPhone {
  userId: string;
  tenantId: string | null;
  name: string;
  phone: string;
  status: string;
  reason: string;
}

interface AuditReport {
  summary: {
    totalUsers: number;
    usersWithPhone: number;
    duplicateGroups: number;
    highRiskGroups: number;
    mediumRiskGroups: number;
    abnormalPhoneCount: number;
  };
  groups: DuplicateGroup[];
  abnormals: AbnormalPhone[];
  generatedAt: string;
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const allUsers = (await prisma.user.findMany({
      select: {
        id: true,
        tenantId: true,
        phone: true,
        name: true,
        status: true,
        isPlatform: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })) as UserRecord[];

    const totalUsers = allUsers.length;

    // Separate by phone validity
    const validPhoneUsers: UserRecord[] = [];
    const abnormals: AbnormalPhone[] = [];

    for (const u of allUsers) {
      if (!u.phone || u.phone.trim() === '') {
        abnormals.push({
          userId: u.id,
          tenantId: u.tenantId,
          name: u.name,
          phone: u.phone ?? '',
          status: u.status,
          reason: '空手机号',
        });
      } else if (!isValidPhone(u.phone)) {
        abnormals.push({
          userId: u.id,
          tenantId: u.tenantId,
          name: u.name,
          phone: u.phone,
          status: u.status,
          reason: '手机号格式异常',
        });
      } else {
        validPhoneUsers.push(u as UserRecord);
      }
    }

    const usersWithPhone = allUsers.filter((u) => u.phone && u.phone.trim() !== '').length;

    // Group by phone
    const phoneMap = new Map<string, UserRecord[]>();
    for (const u of validPhoneUsers) {
      const key = u.phone;
      if (!phoneMap.has(key)) phoneMap.set(key, []);
      phoneMap.get(key)!.push(u);
    }

    // Find duplicates and classify risk
    const groups: DuplicateGroup[] = [];
    let highRiskGroups = 0;
    let mediumRiskGroups = 0;

    for (const [phone, users] of phoneMap) {
      if (users.length <= 1) continue;

      const activeUsers = users.filter((u) => u.status === 'active');
      const disabledUsers = users.filter((u) => u.status !== 'active');
      const hasPlatform = users.some((u) => u.isPlatform);
      const hasTenant = users.some((u) => !u.isPlatform);

      let risk: 'high' | 'medium';
      let reason: string;

      if (activeUsers.length > 1) {
        risk = 'high';
        reason = `${activeUsers.length} 个 active 用户使用同一手机号`;
      } else if (hasPlatform && hasTenant) {
        risk = 'high';
        reason = '平台账号与商户账号使用同一手机号';
      } else {
        risk = 'medium';
        reason = disabledUsers.length > 0
          ? '包含 disabled 用户重复，当前 active 用户不超过 1，需人工确认'
          : '重复手机号需人工确认';
      }

      if (risk === 'high') highRiskGroups++;
      else mediumRiskGroups++;

      groups.push({
        phone,
        risk,
        reason,
        users: users.map((u) => ({
          id: u.id,
          tenantId: u.tenantId,
          tenantName: u.tenant?.name ?? null,
          name: u.name,
          phone: u.phone,
          status: u.status,
          isPlatform: u.isPlatform,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        })),
      });
    }

    groups.sort((a, b) => {
      if (a.risk === 'high' && b.risk !== 'high') return -1;
      if (a.risk !== 'high' && b.risk === 'high') return 1;
      return b.users.length - a.users.length;
    });

    const report: AuditReport = {
      summary: {
        totalUsers,
        usersWithPhone,
        duplicateGroups: groups.length,
        highRiskGroups,
        mediumRiskGroups,
        abnormalPhoneCount: abnormals.length,
      },
      groups,
      abnormals,
      generatedAt: nowISO(),
    };

    // ── Console output ──

    console.log('\n========================================');
    console.log('  登录手机号审计报告 (Phone Audit)');
    console.log('========================================\n');

    console.log(`生成时间: ${report.generatedAt}`);
    console.log(`总用户数: ${totalUsers}`);
    console.log(`有手机号用户: ${usersWithPhone}`);
    console.log(`重复手机号组数: ${groups.length}`);
    console.log(`  - 高风险组: ${highRiskGroups}`);
    console.log(`  - 中风险组: ${mediumRiskGroups}`);
    console.log(`异常手机号数量: ${abnormals.length}`);
    console.log('');

    if (groups.length > 0) {
      console.log('──── 重复手机号明细 ────\n');
      for (const g of groups) {
        const tag = g.risk === 'high' ? '[HIGH]' : '[MEDIUM]';
        console.log(`${tag} ${maskPhone(g.phone)} (${g.users.length} 人)`);
        console.log(`  原因: ${g.reason}`);
        for (const u of g.users) {
          const statusTag = u.isPlatform ? '平台' : (u.tenantName ?? '未知租户');
          console.log(`    - ${u.name} (${maskPhone(u.phone)}) [${u.status}] ${statusTag} id=${u.id}`);
        }
        console.log('');
      }
    } else {
      console.log('未发现重复手机号。\n');
    }

    if (abnormals.length > 0) {
      console.log('──── 异常手机号明细 ────\n');
      for (const a of abnormals) {
        console.log(`  ${a.name} (${maskPhone(a.phone)}) [${a.status}] ${a.reason} id=${a.userId}`);
      }
      console.log('');
    }

    // ── JSON output ──

    if (jsonPath) {
      const resolvedPath = resolveOutputPath(jsonPath);
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(resolvedPath, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`JSON 报告已写入: ${resolvedPath}\n`);
    }

    // ── Exit code ──

    if (strict && highRiskGroups > 0) {
      console.log(`[strict] 发现 ${highRiskGroups} 个高风险组，退出码 1`);
      process.exit(1);
    }

    console.log('审计完成，退出码 0');
    process.exit(0);
  } catch (err) {
    console.error('审计脚本运行失败:', err);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

main();
