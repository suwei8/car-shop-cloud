import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

  // 3. 默认权限
  const permissions = [
    // 平台权限
    { code: 'platform:tenant:view', name: '查看商户', module: 'platform' },
    { code: 'platform:tenant:create', name: '创建商户', module: 'platform' },
    { code: 'platform:tenant:update', name: '编辑商户', module: 'platform' },
    { code: 'platform:tenant:delete', name: '删除商户', module: 'platform' },
    { code: 'platform:plan:view', name: '查看套餐', module: 'platform' },
    { code: 'platform:plan:manage', name: '管理套餐', module: 'platform' },
    { code: 'platform:feature:manage', name: '管理功能开关', module: 'platform' },
    { code: 'platform:tenant:manage', name: '管理商户订阅', module: 'platform' },
    // 商户权限
    { code: 'tenant:shop:view', name: '查看门店', module: 'shop' },
    { code: 'tenant:shop:create', name: '创建门店', module: 'shop' },
    { code: 'tenant:shop:update', name: '编辑门店', module: 'shop' },
    { code: 'tenant:shop:delete', name: '删除门店', module: 'shop' },
    { code: 'tenant:user:view', name: '查看员工', module: 'user' },
    { code: 'tenant:user:create', name: '创建员工', module: 'user' },
    { code: 'tenant:user:update', name: '编辑员工', module: 'user' },
    { code: 'tenant:user:delete', name: '删除员工', module: 'user' },
    { code: 'tenant:role:view', name: '查看角色', module: 'role' },
    { code: 'tenant:role:manage', name: '管理角色', module: 'role' },
    { code: 'tenant:customer:view', name: '查看客户', module: 'customer' },
    { code: 'tenant:customer:create', name: '创建客户', module: 'customer' },
    { code: 'tenant:customer:update', name: '编辑客户', module: 'customer' },
    { code: 'tenant:vehicle:view', name: '查看车辆', module: 'vehicle' },
    { code: 'tenant:vehicle:create', name: '创建车辆', module: 'vehicle' },
    { code: 'tenant:vehicle:update', name: '编辑车辆', module: 'vehicle' },
    { code: 'tenant:workorder:view', name: '查看工单', module: 'workorder' },
    { code: 'tenant:workorder:create', name: '创建工单', module: 'workorder' },
    { code: 'tenant:workorder:update', name: '编辑工单', module: 'workorder' },
    { code: 'tenant:inventory:view', name: '查看库存', module: 'inventory' },
    { code: 'tenant:inventory:manage', name: '管理库存', module: 'inventory' },
    { code: 'tenant:settlement:view', name: '查看结算', module: 'settlement' },
    { code: 'tenant:settlement:manage', name: '管理结算', module: 'settlement' },
    { code: 'tenant:member:view', name: '查看会员', module: 'member' },
    { code: 'tenant:member:manage', name: '管理会员', module: 'member' },
    { code: 'tenant:report:view', name: '查看报表', module: 'report' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }
  console.log(`Created ${permissions.length} permissions`);

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
