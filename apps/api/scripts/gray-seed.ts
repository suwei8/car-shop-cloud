#!/usr/bin/env node

/**
 * Gray-test tenant initialization script.
 *
 * Idempotent: safe to run repeatedly. Creates or patches the gray-smoke
 * tenant, admin account, shop, warehouse, roles, service items, dictionaries,
 * subscription, and feature flags.
 *
 * Usage:
 *   pnpm --filter @car/api seed:gray
 *   GRAY_SEED_ALLOW_WRITE=1 pnpm --filter @car/api seed:gray
 *
 * Required env:
 *   GRAY_SEED_ALLOW_WRITE=1   Must be set to allow any database writes.
 *   DATABASE_URL              PostgreSQL connection string.
 *
 * Optional env:
 *   SMOKE_PHONE         Admin phone (default: 18800000001)
 *   SMOKE_PASSWORD      Admin password (default: Test123456)
 *   SMOKE_SHOP_NAME     Shop / tenant name (default: 灰度验收门店)
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PERMISSIONS } from '../prisma/seed-data/permissions';
import { SERVICE_ITEMS } from '../prisma/seed-data/service-items';
import { DICTIONARIES } from '../prisma/seed-data/dictionaries';

const TENANT_ID = 'gray-smoke-tenant';
const SHOP_ID = 'gray-smoke-shop';
const WAREHOUSE_ID = 'gray-smoke-warehouse';
const ADMIN_USER_ID = 'gray-smoke-admin';
const ADMIN_ROLE_ID = 'gray-role-tenant-admin';
const SUB_ID = 'gray-smoke-sub';
const PLAN_ID = 'plan-trial';
const FEATURE_FLAG_ID = 'flag-simple-mode';
const TRIAL_DAYS = 30;

interface PermissionRecord {
  id: string;
  code: string;
}

const BUILT_IN_ROLES: Record<string, { name: string; perms: string[] }> = {
  tenant_admin: {
    name: '商户管理员',
    perms: [
      'tenant:shop:view', 'tenant:shop:create', 'tenant:shop:update',
      'tenant:user:view', 'tenant:user:create', 'tenant:user:update',
      'tenant:role:view', 'tenant:role:manage',
      'tenant:customer:view', 'tenant:customer:create', 'tenant:customer:update',
      'tenant:vehicle:view', 'tenant:vehicle:create', 'tenant:vehicle:update',
      'tenant:workorder:view', 'tenant:workorder:create', 'tenant:workorder:update',
      'tenant:inventory:view', 'tenant:inventory:manage',
      'tenant:settlement:view', 'tenant:settlement:manage',
      'tenant:member:view', 'tenant:member:manage',
      'tenant:report:view',
    ],
  },
  shop_manager: {
    name: '店长',
    perms: [
      'tenant:shop:view', 'tenant:shop:create', 'tenant:shop:update',
      'tenant:customer:view', 'tenant:customer:create', 'tenant:customer:update',
      'tenant:vehicle:view', 'tenant:vehicle:create', 'tenant:vehicle:update',
      'tenant:workorder:view', 'tenant:workorder:create', 'tenant:workorder:update',
      'tenant:inventory:view', 'tenant:inventory:manage',
      'tenant:settlement:view', 'tenant:settlement:manage',
      'tenant:member:view', 'tenant:member:manage',
      'tenant:report:view',
    ],
  },
  service_advisor: {
    name: '服务顾问',
    perms: [
      'tenant:customer:view', 'tenant:customer:create', 'tenant:customer:update',
      'tenant:vehicle:view', 'tenant:vehicle:create', 'tenant:vehicle:update',
      'tenant:workorder:view', 'tenant:workorder:create',
      'tenant:settlement:view',
      'tenant:shop:view',
    ],
  },
  technician: {
    name: '技师',
    perms: ['tenant:workorder:view', 'tenant:workorder:update'],
  },
  cashier: {
    name: '收银员',
    perms: [
      'tenant:settlement:view', 'tenant:settlement:manage',
      'tenant:member:view', 'tenant:member:manage',
    ],
  },
};


function log(msg: string) {
  console.log(msg);
}

function die(msg: string): never {
  console.error(`\n  FATAL: ${msg}\n`);
  process.exit(1);
}

// ─── Guards ──────────────────────────────────────────────────────────────────

function checkGuards() {
  if (process.env.GRAY_SEED_ALLOW_WRITE !== '1') {
    die(
      'GRAY_SEED_ALLOW_WRITE is not "1".\n' +
      '  This script is READ-ONLY by default.\n' +
      '  Set GRAY_SEED_ALLOW_WRITE=1 to allow database writes.',
    );
  }

  if (process.env.NODE_ENV === 'production' && process.env.GRAY_SEED_ALLOW_PRODUCTION !== '1') {
    die(
      'NODE_ENV=production and GRAY_SEED_ALLOW_PRODUCTION is not "1".\n' +
      '  Refusing to seed production database.\n' +
      '  Set GRAY_SEED_ALLOW_PRODUCTION=1 to override (not recommended).',
    );
  }

  if (!process.env.DATABASE_URL) {
    die('DATABASE_URL is not set. Cannot connect to database.');
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  checkGuards();

  const phone = process.env.SMOKE_PHONE || '18800000001';
  const password = process.env.SMOKE_PASSWORD || 'Test123456';
  const shopName = process.env.SMOKE_SHOP_NAME || '灰度验收门店';

  log('');
  log('═══════════════════════════════════════════════');
  log('  Gray Smoke Tenant Initialization');
  log(`  Tenant: ${TENANT_ID}`);
  log(`  Phone:  ${phone}`);
  log(`  Shop:   ${shopName}`);
  log('═══════════════════════════════════════════════\n');

  const prisma = new PrismaClient();

  try {
    // ── 1. Check phone uniqueness across ALL tenants + platform ──
    log('Step 1: Checking phone uniqueness...');
    const existingUsers = await prisma.user.findMany({
      where: { phone },
      select: { id: true, tenantId: true, isPlatform: true },
    });

    for (const existingUser of existingUsers) {
      if (existingUser.id === ADMIN_USER_ID && existingUser.tenantId === TENANT_ID && !existingUser.isPlatform) {
        continue;
      }
      if (existingUser.isPlatform) {
        die(
          `Phone ${phone} is already registered as a platform account ` +
          `(id: ${existingUser.id}). Cannot reuse for gray-smoke tenant.`,
        );
      }
      if (existingUser.tenantId && existingUser.tenantId !== TENANT_ID) {
        die(
          `Phone ${phone} already belongs to tenant "${existingUser.tenantId}" ` +
          `(user id: ${existingUser.id}). Cannot reuse for gray-smoke tenant.`,
        );
      }
      die(
        `Phone ${phone} is already registered by user "${existingUser.id}" ` +
        'without the expected gray-smoke tenant ownership.',
      );
    }
    log('  Phone is available or already belongs to gray-smoke tenant.');

    // ── 2. Ensure platform data exists ──
    log('\nStep 2: Ensuring platform data (permissions, plans, feature flags)...');

    for (const perm of PERMISSIONS) {
      await prisma.permission.upsert({
        where: { code: perm.code },
        update: {},
        create: perm,
      });
    }
    log(`  Permissions: ${PERMISSIONS.length} ensured`);

    await prisma.subscriptionPlan.upsert({
      where: { id: PLAN_ID },
      update: {},
      create: {
        id: PLAN_ID,
        name: '试用版',
        priceYearly: 0,
        maxShops: 1,
        maxEmployees: 5,
      },
    });
    log('  Trial plan ensured');

    await prisma.featureFlag.upsert({
      where: { id: FEATURE_FLAG_ID },
      update: {},
      create: {
        id: FEATURE_FLAG_ID,
        code: 'simple_mode',
        name: '简易模式',
      },
    });
    log('  Feature flag simple_mode ensured');

    // ── 3. Create or update gray tenant ──
    log('\nStep 3: Creating gray-smoke tenant...');
    const now = new Date();
    const subscriptionEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const existingTenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });

    if (!existingTenant) {
      await prisma.tenant.create({
        data: {
          id: TENANT_ID,
          name: shopName,
          status: 'active',
          subscriptionStatus: 'trial',
          subscriptionEndAt: subscriptionEnd,
        },
      });
      log('  Tenant created (new)');
    } else {
      await prisma.tenant.update({
        where: { id: TENANT_ID },
        data: {
          name: shopName,
          status: 'active',
          subscriptionStatus: 'trial',
          subscriptionEndAt: subscriptionEnd,
        },
      });
      log('  Tenant updated (existing)');
    }

    // ── 4. Ensure subscription ──
    log('\nStep 4: Ensuring subscription...');
    const existingSub = await prisma.tenantSubscription.findUnique({ where: { id: SUB_ID } });
    if (!existingSub) {
      await prisma.tenantSubscription.create({
        data: {
          id: SUB_ID,
          tenantId: TENANT_ID,
          planId: PLAN_ID,
          startAt: now,
          endAt: subscriptionEnd,
          status: 'active',
        },
      });
      log('  Subscription created');
    } else {
      await prisma.tenantSubscription.update({
        where: { id: SUB_ID },
        data: {
          endAt: subscriptionEnd,
          status: 'active',
        },
      });
      log('  Subscription updated');
    }

    // ── 5. Ensure feature flag enabled for tenant ──
    log('\nStep 5: Enabling simple_mode feature flag for tenant...');
    await prisma.tenantFeatureFlag.upsert({
      where: {
        tenantId_featureFlagId: { tenantId: TENANT_ID, featureFlagId: FEATURE_FLAG_ID },
      },
      update: { enabled: true },
      create: {
        tenantId: TENANT_ID,
        featureFlagId: FEATURE_FLAG_ID,
        enabled: true,
      },
    });
    log('  Feature flag enabled');

    // ── 6. Ensure shop ──
    log('\nStep 6: Ensuring default shop...');
    const shopDisplayName = `${shopName}（总店）`;
    const existingShop = await prisma.shop.findUnique({ where: { id: SHOP_ID } });
    if (!existingShop) {
      await prisma.shop.create({
        data: {
          id: SHOP_ID,
          tenantId: TENANT_ID,
          name: shopDisplayName,
          status: 'active',
        },
      });
      log('  Shop created');
    } else {
      await prisma.shop.update({
        where: { id: SHOP_ID },
        data: { tenantId: TENANT_ID, name: shopDisplayName, status: 'active' },
      });
      log('  Shop updated (existing)');
    }

    // ── 7. Ensure warehouse ──
    log('\nStep 7: Ensuring default warehouse...');
    const existingWarehouse = await prisma.warehouse.findUnique({ where: { id: WAREHOUSE_ID } });
    if (!existingWarehouse) {
      await prisma.warehouse.create({
        data: {
          id: WAREHOUSE_ID,
          tenantId: TENANT_ID,
          shopId: SHOP_ID,
          name: '默认仓库',
          isDefault: true,
          status: 'active',
        },
      });
      log('  Warehouse created');
    } else {
      await prisma.warehouse.update({
        where: { id: WAREHOUSE_ID },
        data: { tenantId: TENANT_ID, shopId: SHOP_ID, name: '默认仓库', isDefault: true, status: 'active' },
      });
      log('  Warehouse updated (existing)');
    }

    // ── 8. Ensure roles + permissions ──
    log('\nStep 8: Ensuring built-in roles and permissions...');
    const allPermissions = (await prisma.permission.findMany()) as PermissionRecord[];
    const permMap = new Map(allPermissions.map((p) => [p.code, p.id]));

    let rolesCreated = 0;
    let rolePermissionsCreated = 0;
    for (const [roleCode, { name: roleName, perms }] of Object.entries(BUILT_IN_ROLES)) {
      const roleId = roleCode === 'tenant_admin' ? ADMIN_ROLE_ID : `${TENANT_ID}-role-${roleCode}`;
      const existingRole = await prisma.role.findUnique({ where: { id: roleId } });

      if (!existingRole) {
        await prisma.role.create({
          data: {
            id: roleId,
            tenantId: TENANT_ID,
            name: roleName,
            code: roleCode,
            isBuiltIn: true,
          },
        });
        rolesCreated++;
      } else {
        await prisma.role.update({
          where: { id: roleId },
          data: { tenantId: TENANT_ID, name: roleName, code: roleCode, isBuiltIn: true },
        });
      }

      for (const permCode of perms) {
        const permId = permMap.get(permCode);
        if (!permId) continue;
        const existingRolePermission = await prisma.rolePermission.findFirst({
          where: { roleId, permissionId: permId },
        });
        if (!existingRolePermission) {
          await prisma.rolePermission.create({
            data: { roleId, permissionId: permId },
          });
          rolePermissionsCreated++;
        }
      }
    }
    log(`  Roles ensured (created ${rolesCreated} new, ${rolePermissionsCreated} permission bindings added)`);

    // ── 9. Ensure admin user ──
    log('\nStep 9: Ensuring admin user...');
    const passwordHash = await bcrypt.hash(password, 10);
    const existingAdmin = await prisma.user.findUnique({ where: { id: ADMIN_USER_ID } });

    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          id: ADMIN_USER_ID,
          tenantId: TENANT_ID,
          phone,
          passwordHash,
          name: '灰度管理员',
          isPlatform: false,
          status: 'active',
        },
      });
      log('  Admin user created');
    } else {
      await prisma.user.update({
        where: { id: ADMIN_USER_ID },
        data: {
          passwordHash,
          phone,
          name: '灰度管理员',
          status: 'active',
          tenantId: TENANT_ID,
          isPlatform: false,
        },
      });
      log('  Admin user updated (password & status reset)');
    }

    // Bind tenant_admin role
    const existingUserRole = await prisma.userRole.findFirst({
      where: { userId: ADMIN_USER_ID, roleId: ADMIN_ROLE_ID },
    });
    if (!existingUserRole) {
      await prisma.userRole.create({
        data: { userId: ADMIN_USER_ID, roleId: ADMIN_ROLE_ID },
      });
      log('  Admin role binding created');
    }

    // Ensure employee record
    const existingEmployee = await prisma.employee.findUnique({ where: { userId: ADMIN_USER_ID } });
    if (!existingEmployee) {
      await prisma.employee.create({
        data: {
          userId: ADMIN_USER_ID,
          tenantId: TENANT_ID,
          shopId: SHOP_ID,
          position: '管理员',
          status: 'active',
        },
      });
      log('  Employee record created');
    } else {
      await prisma.employee.update({
        where: { userId: ADMIN_USER_ID },
        data: { tenantId: TENANT_ID, shopId: SHOP_ID, position: '管理员', status: 'active' },
      });
      log('  Employee record updated');
    }

    // ── 10. Ensure service items (idempotent by tenantId+name) ──
    log('\nStep 10: Ensuring service items...');
    let serviceItemsCreated = 0;
    let serviceItemsUpdated = 0;
    for (const item of SERVICE_ITEMS) {
      const existingServiceItem = await prisma.serviceItem.findFirst({
        where: { tenantId: TENANT_ID, name: item.name },
      });
      if (!existingServiceItem) {
        await prisma.serviceItem.create({
          data: {
            tenantId: TENANT_ID,
            name: item.name,
            category: item.category,
            unit: item.unit,
            unitPrice: item.unitPrice,
            description: item.description,
            status: 'active',
          },
        });
        serviceItemsCreated++;
      } else {
        await prisma.serviceItem.update({
          where: { id: existingServiceItem.id },
          data: {
            category: item.category,
            unit: item.unit,
            unitPrice: item.unitPrice,
            description: item.description,
            status: 'active',
          },
        });
        serviceItemsUpdated++;
      }
    }
    log(`  Service items ensured (${serviceItemsCreated} created, ${serviceItemsUpdated} updated)`);

    // ── 11. Ensure dictionaries (idempotent by tenantId+type+code) ──
    log('\nStep 11: Ensuring dictionaries...');
    let dictionariesCreated = 0;
    let dictionariesUpdated = 0;
    for (const dict of DICTIONARIES) {
      const existingDictionary = await prisma.dictionary.findFirst({
        where: { tenantId: TENANT_ID, type: dict.type, code: dict.code },
      });
      if (!existingDictionary) {
        await prisma.dictionary.create({
          data: {
            tenantId: TENANT_ID,
            type: dict.type,
            code: dict.code,
            name: dict.name,
            sort: dict.sort,
            status: 'active',
          },
        });
        dictionariesCreated++;
      } else {
        await prisma.dictionary.update({
          where: { id: existingDictionary.id },
          data: { name: dict.name, sort: dict.sort, status: 'active' },
        });
        dictionariesUpdated++;
      }
    }
    log(`  Dictionaries ensured (${dictionariesCreated} created, ${dictionariesUpdated} updated)`);

    // ── Done ──
    log('\n═══════════════════════════════════════════════');
    log('  Gray-smoke tenant initialization complete!');
    log('═══════════════════════════════════════════════\n');
    log('  To run the gray smoke test:');
    log('');
    log('    API_BASE_URL=http://127.0.0.1:3000/api \\');
    log('    SMOKE_ALLOW_WRITE=1 \\');
    log(`    SMOKE_PHONE=${phone} \\`);
    log('    SMOKE_PASSWORD="${SMOKE_PASSWORD:-Test123456}" \\');
    log('    pnpm smoke:gray');
    log('');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('\n  FATAL:', e.message);
  process.exit(1);
});
