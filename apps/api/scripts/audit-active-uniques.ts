#!/usr/bin/env node

/**
 * Read-only audit script: scan active Customer.phone and Vehicle.plateNo for
 * per-tenant duplicates.
 *
 * Usage:
 *   pnpm audit:active-uniques
 *   pnpm audit:active-uniques -- --json .agent-bridge/active-uniques-audit.json
 *   pnpm audit:active-uniques -- --strict
 *
 * Exit codes:
 *   0 — no conflicts (or --strict not set)
 *   1 — conflicts found and --strict is set
 *   2 — script error
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

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

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function nowISO(): string {
  return new Date().toISOString();
}

function findRepoRoot(startDir: string): string {
  let current = startDir;
  while (true) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

function resolveOutputPath(outputPath: string): string {
  if (path.isAbsolute(outputPath)) return outputPath;
  return path.resolve(findRepoRoot(__dirname), outputPath);
}

interface ConflictRecord {
  id: string;
  value: string;
  tenantId: string;
}

interface ConflictGroup {
  tenantId: string;
  tenantName: string | null;
  value: string;
  records: { id: string; value: string }[];
}

interface AuditReport {
  summary: {
    totalActiveCustomers: number;
    totalActiveVehicles: number;
    customerPhoneConflicts: number;
    vehiclePlateConflicts: number;
  };
  customerPhoneConflicts: ConflictGroup[];
  vehiclePlateConflicts: ConflictGroup[];
  generatedAt: string;
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const [customers, vehicles, tenants] = await Promise.all([
      prisma.customer.findMany({
        where: { status: 'active' },
        select: { id: true, phone: true, tenantId: true },
      }),
      prisma.vehicle.findMany({
        where: { status: 'active' },
        select: { id: true, plateNo: true, tenantId: true },
      }),
      prisma.tenant.findMany({
        select: { id: true, name: true },
      }),
    ]);

    const tenantNameMap = new Map<string, string | null>();
    for (const t of tenants) tenantNameMap.set(t.id, t.name);

    function buildGroups(records: ConflictRecord[]): ConflictGroup[] {
      const map = new Map<string, ConflictRecord[]>();
      for (const r of records) {
        const key = `${r.tenantId}::${r.value}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
      }
      const groups: ConflictGroup[] = [];
      for (const [, recs] of map) {
        if (recs.length <= 1) continue;
        groups.push({
          tenantId: recs[0].tenantId,
          tenantName: tenantNameMap.get(recs[0].tenantId) ?? null,
          value: recs[0].value,
          records: recs.map((r) => ({ id: r.id, value: r.value })),
        });
      }
      return groups;
    }

    const customerGroups = buildGroups(
      customers.map((c) => ({ id: c.id, value: c.phone, tenantId: c.tenantId })),
    );

    const vehicleGroups = buildGroups(
      vehicles.map((v) => ({ id: v.id, value: v.plateNo.toUpperCase(), tenantId: v.tenantId })),
    );

    const report: AuditReport = {
      summary: {
        totalActiveCustomers: customers.length,
        totalActiveVehicles: vehicles.length,
        customerPhoneConflicts: customerGroups.length,
        vehiclePlateConflicts: vehicleGroups.length,
      },
      customerPhoneConflicts: customerGroups,
      vehiclePlateConflicts: vehicleGroups,
      generatedAt: nowISO(),
    };

    console.log('\n========================================');
    console.log('  Active Unique Audit Report');
    console.log('========================================\n');
    console.log(`生成时间: ${report.generatedAt}`);
    console.log(`活跃客户数: ${customers.length}`);
    console.log(`活跃车辆数: ${vehicles.length}`);
    console.log(`客户手机号冲突组: ${customerGroups.length}`);
    console.log(`车牌号冲突组: ${vehicleGroups.length}`);
    console.log('');

    if (customerGroups.length > 0) {
      console.log('──── 客户手机号冲突明细 ────\n');
      for (const g of customerGroups) {
        console.log(`租户: ${g.tenantName ?? g.tenantId}`);
        console.log(`手机号: ${maskPhone(g.value)} (${g.records.length} 条)`);
        for (const r of g.records) {
          console.log(`  - id=${r.id}`);
        }
        console.log('');
      }
    }

    if (vehicleGroups.length > 0) {
      console.log('──── 车牌号冲突明细 ────\n');
      for (const g of vehicleGroups) {
        console.log(`租户: ${g.tenantName ?? g.tenantId}`);
        console.log(`车牌号: ${g.value} (${g.records.length} 条)`);
        for (const r of g.records) {
          console.log(`  - id=${r.id}`);
        }
        console.log('');
      }
    }

    if (customerGroups.length === 0 && vehicleGroups.length === 0) {
      console.log('未发现同租户 active 记录重复。\n');
    }

    if (jsonPath) {
      const resolvedPath = resolveOutputPath(jsonPath);
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(resolvedPath, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`JSON 报告已写入: ${resolvedPath}\n`);
    }

    const totalConflicts = customerGroups.length + vehicleGroups.length;
    if (strict && totalConflicts > 0) {
      console.log(`[strict] 发现 ${totalConflicts} 个冲突组，退出码 1`);
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
