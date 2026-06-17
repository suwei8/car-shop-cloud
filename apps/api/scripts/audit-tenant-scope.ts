#!/usr/bin/env node

/**
 * Tenant-scope audit script - scans tenant services for potential
 * tenant isolation gaps. Reports are best-effort and may contain
 * false positives; use as a review aid, not a hard gate.
 *
 * Usage: npx ts-node scripts/audit-tenant-scope.ts
 *   or: pnpm audit:tenant-scope
 */

import * as fs from 'fs';
import * as path from 'path';

const TENANT_DIR = path.resolve(__dirname, '../src/tenant');
interface Finding {
  file: string;
  line: number;
  pattern: string;
  code: string;
  severity: 'warn' | 'info';
}

const findings: Finding[] = [];

function classifyFinding(label: string, line: string, severity: 'warn' | 'info') {
  if (label === 'findUnique without tenantId' && line.includes('.tenant.findUnique')) {
    return {
      label: 'Platform model lookup without tenantId',
      severity: 'info' as const,
    };
  }

  return { label, severity };
}

function scanDir(
  dir: string,
  pattern: RegExp,
  label: string,
  severity: 'warn' | 'info',
  options?: { dtoOnly?: boolean },
) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, pattern, label, severity, options);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      if (options?.dtoOnly && !entry.name.endsWith('.dto.ts')) continue;
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      const relPath = path.relative(path.resolve(__dirname, '..'), fullPath);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (pattern.test(line)) {
          const classified = classifyFinding(label, line, severity);
          findings.push({
            file: relPath,
            line: i + 1,
            pattern: classified.label,
            code: line.trim().slice(0, 120),
            severity: classified.severity,
          });
        }
      }
    }
  }
}

// 1. findUnique({ where: { id without tenantId - may access cross-tenant records
scanDir(
  TENANT_DIR,
  /findUnique\(\s*\{\s*where:\s*\{\s*id[^,}]*\}\s*\}/,
  'findUnique without tenantId',
  'warn',
);

// 2. update({ where: { id without tenantId - may update cross-tenant records
scanDir(
  TENANT_DIR,
  /update\(\s*\{\s*where:\s*\{\s*id[^,}]*\}\s*,\s*data:/,
  'update where-id without tenantId',
  'warn',
);

// 3. DTO files containing tenantId - client should not supply tenantId
scanDir(
  TENANT_DIR,
  /tenantId[?!]?\s*[:@]/,
  'DTO contains tenantId field',
  'info',
  { dtoOnly: true },
);

// 4. data: { ...spread } that might include client tenantId in service create calls
scanDir(
  TENANT_DIR,
  /\{\s*\.\.\.dto\s*\}/,
  'Spread DTO into create data (potential tenantId leak)',
  'warn',
);

// 5. Manual tenantId in service without tenantWhere helper
scanDir(
  TENANT_DIR,
  /tenantId:\s*user\.tenantId!/,
  'Manual tenantId (consider using tenantWhere/tenantCreate)',
  'info',
);

// ---- Report ----

const warns = findings.filter((f) => f.severity === 'warn');
const infos = findings.filter((f) => f.severity === 'info');

console.log('\n========================================');
console.log('  Tenant Scope Audit Report');
console.log('========================================\n');

if (warns.length > 0) {
  console.log(`WARNINGS (${warns.length}) - please review:\n`);
  for (const f of warns) {
    console.log(`  [${f.file}:${f.line}] ${f.pattern}`);
    console.log(`    ${f.code}\n`);
  }
} else {
  console.log('No warnings.\n');
}

if (infos.length > 0) {
  console.log(`INFO (${infos.length}) - informational / already mitigated:\n`);
  for (const f of infos) {
    console.log(`  [${f.file}:${f.line}] ${f.pattern}`);
    console.log(`    ${f.code}\n`);
  }
}

console.log('----------------------------------------');
console.log(`Total: ${warns.length} warning(s), ${infos.length} info(s)`);
console.log('');
