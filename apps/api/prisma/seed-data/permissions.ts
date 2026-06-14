/**
 * 权限定义清单（全量）
 * 基于代码中所有 @RequirePermissions() 扫描结果
 */
export const PERMISSIONS = [
  // 平台权限
  { code: 'platform:tenant:view', name: '查看商户', module: 'platform' },
  { code: 'platform:tenant:create', name: '创建商户', module: 'platform' },
  { code: 'platform:tenant:update', name: '编辑商户', module: 'platform' },
  { code: 'platform:tenant:delete', name: '删除商户', module: 'platform' },
  { code: 'platform:tenant:impersonate', name: '代登录商户', module: 'platform' },
  { code: 'platform:tenant:manage', name: '管理商户订阅', module: 'platform' },
  { code: 'platform:plan:view', name: '查看套餐', module: 'platform' },
  { code: 'platform:plan:manage', name: '管理套餐', module: 'platform' },
  { code: 'platform:feature:manage', name: '管理功能开关', module: 'platform' },
  // 商户权限 - 门店
  { code: 'tenant:shop:view', name: '查看门店', module: 'shop' },
  { code: 'tenant:shop:create', name: '创建门店', module: 'shop' },
  { code: 'tenant:shop:update', name: '编辑门店', module: 'shop' },
  // 商户权限 - 员工
  { code: 'tenant:user:view', name: '查看员工', module: 'user' },
  { code: 'tenant:user:create', name: '创建员工', module: 'user' },
  { code: 'tenant:user:update', name: '编辑员工', module: 'user' },
  // 商户权限 - 角色
  { code: 'tenant:role:view', name: '查看角色', module: 'role' },
  { code: 'tenant:role:manage', name: '管理角色', module: 'role' },
  // 商户权限 - 客户
  { code: 'tenant:customer:view', name: '查看客户', module: 'customer' },
  { code: 'tenant:customer:create', name: '创建客户', module: 'customer' },
  { code: 'tenant:customer:update', name: '编辑客户', module: 'customer' },
  // 商户权限 - 车辆
  { code: 'tenant:vehicle:view', name: '查看车辆', module: 'vehicle' },
  { code: 'tenant:vehicle:create', name: '创建车辆', module: 'vehicle' },
  { code: 'tenant:vehicle:update', name: '编辑车辆', module: 'vehicle' },
  // 商户权限 - 工单
  { code: 'tenant:workorder:view', name: '查看工单', module: 'workorder' },
  { code: 'tenant:workorder:create', name: '创建工单', module: 'workorder' },
  { code: 'tenant:workorder:update', name: '编辑工单', module: 'workorder' },
  // 商户权限 - 库存
  { code: 'tenant:inventory:view', name: '查看库存', module: 'inventory' },
  { code: 'tenant:inventory:manage', name: '管理库存', module: 'inventory' },
  // 商户权限 - 结算
  { code: 'tenant:settlement:view', name: '查看结算', module: 'settlement' },
  { code: 'tenant:settlement:manage', name: '管理结算', module: 'settlement' },
  // 商户权限 - 会员
  { code: 'tenant:member:view', name: '查看会员', module: 'member' },
  { code: 'tenant:member:manage', name: '管理会员', module: 'member' },
  // 商户权限 - 报表
  { code: 'tenant:report:view', name: '查看报表', module: 'report' },
  // 商户权限 - 营销
  { code: 'tenant:marketing:manage', name: '管理营销活动', module: 'marketing' },
] as const;

export type PermissionData = (typeof PERMISSIONS)[number];
