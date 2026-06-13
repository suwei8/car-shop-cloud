/**
 * 一次性补救脚本：对已存在但缺少初始化数据的租户补齐
 * 幂等：已有同名角色/项目则跳过
 *
 * 用法: cd apps/api && npx ts-node prisma/init-existing-tenants.ts
 */
import { PrismaClient } from '@prisma/client';
import { BUILT_IN_ROLES } from '@car/shared';
import { SERVICE_ITEMS } from './seed-data/service-items';
import { DICTIONARIES } from './seed-data/dictionaries';

const prisma = new PrismaClient();

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  [BUILT_IN_ROLES.TENANT_ADMIN]: [
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
  [BUILT_IN_ROLES.SHOP_MANAGER]: [
    'tenant:shop:view', 'tenant:shop:create', 'tenant:shop:update',
    'tenant:customer:view', 'tenant:customer:create', 'tenant:customer:update',
    'tenant:vehicle:view', 'tenant:vehicle:create', 'tenant:vehicle:update',
    'tenant:workorder:view', 'tenant:workorder:create', 'tenant:workorder:update',
    'tenant:inventory:view', 'tenant:inventory:manage',
    'tenant:settlement:view', 'tenant:settlement:manage',
    'tenant:member:view', 'tenant:member:manage',
    'tenant:report:view',
  ],
  [BUILT_IN_ROLES.SERVICE_ADVISOR]: [
    'tenant:customer:view', 'tenant:customer:create', 'tenant:customer:update',
    'tenant:vehicle:view', 'tenant:vehicle:create', 'tenant:vehicle:update',
    'tenant:workorder:view', 'tenant:workorder:create',
    'tenant:settlement:view',
    'tenant:shop:view',
  ],
  [BUILT_IN_ROLES.TECHNICIAN]: [
    'tenant:workorder:view', 'tenant:workorder:update',
  ],
  [BUILT_IN_ROLES.CASHIER]: [
    'tenant:settlement:view', 'tenant:settlement:manage',
    'tenant:member:view', 'tenant:member:manage',
  ],
};

const ROLE_NAMES: Record<string, string> = {
  [BUILT_IN_ROLES.TENANT_ADMIN]: '商户管理员',
  [BUILT_IN_ROLES.SHOP_MANAGER]: '店长',
  [BUILT_IN_ROLES.SERVICE_ADVISOR]: '服务顾问',
  [BUILT_IN_ROLES.TECHNICIAN]: '技师',
  [BUILT_IN_ROLES.CASHIER]: '收银员',
};

async function main() {
  console.log('=== 初始化存量租户 ===');

  const tenants = await prisma.tenant.findMany({ where: { status: 'active' } });
  console.log(`找到 ${tenants.length} 个活跃租户`);

  const allPermissions = await prisma.permission.findMany();
  const permMap = new Map(allPermissions.map(p => [p.code, p.id]));

  for (const tenant of tenants) {
    console.log(`\n处理租户: ${tenant.id} (${tenant.name})`);

    // 1. 检查是否有门店
    const shopCount = await prisma.shop.count({ where: { tenantId: tenant.id } });
    if (shopCount === 0) {
      const shop = await prisma.shop.create({
        data: { tenantId: tenant.id, name: `${tenant.name}（总店）`, status: 'active' },
      });
      console.log(`  + 创建默认门店: ${shop.id}`);

      // 创建默认仓库
      const warehouseCount = await prisma.warehouse.count({ where: { tenantId: tenant.id } });
      if (warehouseCount === 0) {
        await prisma.warehouse.create({
          data: { tenantId: tenant.id, shopId: shop.id, name: '默认仓库', isDefault: true, status: 'active' },
        });
        console.log(`  + 创建默认仓库`);
      }
    }

    // 2. 检查是否有内置角色
    const existingRoles = await prisma.role.findMany({ where: { tenantId: tenant.id, isBuiltIn: true } });
    const existingRoleCodes = new Set(existingRoles.map(r => r.code));

    for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSION_MAP)) {
      if (existingRoleCodes.has(roleCode)) continue;

      const role = await prisma.role.create({
        data: { tenantId: tenant.id, name: ROLE_NAMES[roleCode] || roleCode, code: roleCode, isBuiltIn: true },
      });

      for (const permCode of permCodes) {
        const permId = permMap.get(permCode);
        if (permId) {
          await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permId } });
        }
      }
      console.log(`  + 创建角色: ${roleCode}`);
    }

    // 3. 检查是否有服务项目
    const itemCount = await prisma.serviceItem.count({ where: { tenantId: tenant.id } });
    if (itemCount === 0) {
      for (const item of SERVICE_ITEMS) {
        await prisma.serviceItem.create({
          data: { tenantId: tenant.id, name: item.name, category: item.category, unit: item.unit, unitPrice: item.unitPrice, description: item.description, status: 'active' },
        });
      }
      console.log(`  + 创建 ${SERVICE_ITEMS.length} 条服务项目`);
    }

    // 4. 检查是否有字典
    const dictCount = await prisma.dictionary.count({ where: { tenantId: tenant.id } });
    if (dictCount === 0) {
      for (const dict of DICTIONARIES) {
        await prisma.dictionary.create({
          data: { tenantId: tenant.id, type: dict.type, code: dict.code, name: dict.name, sort: dict.sort, status: 'active' },
        });
      }
      console.log(`  + 创建 ${DICTIONARIES.length} 条字典`);
    }
  }

  console.log('\n=== 存量租户初始化完成 ===');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
