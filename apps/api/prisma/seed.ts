import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PERMISSIONS } from './seed-data/permissions';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. 平台管理员
  const platformAdminPassword = await bcrypt.hash('Car@Shop2026!Admin', 10);
  const platformAdmin = await prisma.user.upsert({
    where: { id: 'platform-admin' },
    update: {},
    create: {
      id: 'platform-admin',
      phone: '13800000000',
      passwordHash: platformAdminPassword,
      name: '平台管理员',
      isPlatform: true,
      status: 'active',
    },
  });
  console.log('Platform admin created:', platformAdmin.phone);

  // 2. 默认套餐
  const basicPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan-basic' },
    update: {},
    create: {
      id: 'plan-basic',
      name: '基础版',
      description: '适合小型门店',
      priceYearly: 2980,
      maxShops: 1,
      maxEmployees: 5,
      features: JSON.stringify({}),
    },
  });

  const proPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan-pro' },
    update: {},
    create: {
      id: 'plan-pro',
      name: '专业版',
      description: '适合连锁门店',
      priceYearly: 5980,
      maxShops: 5,
      maxEmployees: 20,
      features: JSON.stringify({}),
    },
  });

  const trialPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan-trial' },
    update: {},
    create: {
      id: 'plan-trial',
      name: '试用版',
      description: '新商户试用套餐',
      priceYearly: 0,
      maxShops: 1,
      maxEmployees: 5,
      features: JSON.stringify({}),
    },
  });
  console.log('Plans created:', basicPlan.name, proPlan.name, trialPlan.name);

  // 3. 默认权限（幂等 upsert）
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }
  console.log(`Created ${PERMISSIONS.length} permissions`);

  // 4. 平台管理员角色
  const platformAdminRole = await prisma.role.upsert({
    where: { id: 'role-platform-admin' },
    update: {},
    create: {
      id: 'role-platform-admin',
      name: '平台管理员',
      code: 'platform_admin',
      isBuiltIn: true,
    },
  });

  // 分配所有平台权限给平台管理员角色
  const platformPermissions = await prisma.permission.findMany({
    where: { code: { startsWith: 'platform:' } },
  });
  for (const perm of platformPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        id: `${platformAdminRole.id}-${perm.id}`,
      },
      update: {},
      create: {
        id: `${platformAdminRole.id}-${perm.id}`,
        roleId: platformAdminRole.id,
        permissionId: perm.id,
      },
    });
  }

  // 给平台管理员分配角色
  await prisma.userRole.upsert({
    where: { id: `ur-${platformAdmin.id}-${platformAdminRole.id}` },
    update: {},
    create: {
      id: `ur-${platformAdmin.id}-${platformAdminRole.id}`,
      userId: platformAdmin.id,
      roleId: platformAdminRole.id,
    },
  });
  console.log('Platform admin role assigned');

  // 5. 商户内置角色模板
  const tenantRoles = [
    { name: '商户管理员', code: 'tenant_admin', isBuiltIn: true },
    { name: '店长', code: 'shop_manager', isBuiltIn: true },
    { name: '服务顾问', code: 'service_advisor', isBuiltIn: true },
    { name: '技师', code: 'technician', isBuiltIn: true },
    { name: '收银员', code: 'cashier', isBuiltIn: true },
  ];

  for (const role of tenantRoles) {
    await prisma.role.upsert({
      where: { id: `role-${role.code}` },
      update: {},
      create: {
        id: `role-${role.code}`,
        name: role.name,
        code: role.code,
        isBuiltIn: role.isBuiltIn,
      },
    });
  }

  // 给商户管理员角色分配所有商户权限
  const tenantAdminRole = await prisma.role.findFirst({
    where: { code: 'tenant_admin', tenantId: null },
  });
  const tenantPermissions = await prisma.permission.findMany({
    where: { code: { startsWith: 'tenant:' } },
  });
  if (tenantAdminRole) {
    for (const perm of tenantPermissions) {
      await prisma.rolePermission.upsert({
        where: { id: `${tenantAdminRole.id}-${perm.id}` },
        update: {},
        create: { id: `${tenantAdminRole.id}-${perm.id}`, roleId: tenantAdminRole.id, permissionId: perm.id },
      });
    }
  }
  console.log('Tenant built-in roles created and permissions assigned');

  // 6. 示例租户 + 商户管理员
  const demoTenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant' },
    update: {},
    create: {
      id: 'demo-tenant',
      name: '演示汽修店',
      contactName: '张三',
      contactPhone: '13900000000',
      status: 'active',
    },
  });

  await prisma.tenantSubscription.upsert({
    where: { id: 'demo-sub' },
    update: {},
    create: {
      id: 'demo-sub',
      tenantId: demoTenant.id,
      planId: proPlan.id,
      startAt: new Date(),
      endAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: 'active',
    },
  });

  const demoAdminPassword = await bcrypt.hash('Car@Shop2026!Demo', 10);
  const demoAdmin = await prisma.user.upsert({
    where: { id: 'demo-admin' },
    update: {},
    create: {
      id: 'demo-admin',
      tenantId: demoTenant.id,
      phone: '13900000001',
      passwordHash: demoAdminPassword,
      name: '演示管理员',
      isPlatform: false,
      status: 'active',
    },
  });

  const demoTenantAdminRole = await prisma.role.findFirst({
    where: { code: 'tenant_admin', tenantId: null },
  });
  if (demoTenantAdminRole) {
    await prisma.userRole.upsert({
      where: { id: `ur-${demoAdmin.id}-${demoTenantAdminRole.id}` },
      update: {},
      create: {
        id: `ur-${demoAdmin.id}-${demoTenantAdminRole.id}`,
        userId: demoAdmin.id,
        roleId: demoTenantAdminRole.id,
      },
    });
  }
  console.log('Demo tenant and admin created');

  // 7. 预置 Feature Flags
  const simpleModeFlag = await prisma.featureFlag.upsert({
    where: { id: 'flag-simple-mode' },
    update: {},
    create: {
      id: 'flag-simple-mode',
      code: 'simple_mode',
      name: '简易模式',
      description: '面向小型门店隐藏派工/仓库/预检等高级功能，核心体验压缩为车牌→选项目→收钱',
    },
  });
  console.log('Feature flag created:', simpleModeFlag.code);

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
