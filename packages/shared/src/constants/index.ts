/** 平台权限命名空间前缀 */
export const PLATFORM_PERMISSION_PREFIX = 'platform:';

/** 商户权限命名空间前缀 */
export const TENANT_PERMISSION_PREFIX = 'tenant:';

/** 默认分页大小 */
export const DEFAULT_PAGE_SIZE = 20;

/** 最大分页大小 */
export const MAX_PAGE_SIZE = 100;

/** 平台管理员角色标识 */
export const PLATFORM_ADMIN_ROLE = 'platform_admin';

/** 商户管理员角色标识 */
export const TENANT_ADMIN_ROLE = 'tenant_admin';

/** 预置角色标识 */
export const BUILT_IN_ROLES = {
  PLATFORM_ADMIN: 'platform_admin',
  TENANT_ADMIN: 'tenant_admin',
  SHOP_MANAGER: 'shop_manager',
  SERVICE_ADVISOR: 'service_advisor',
  TECHNICIAN: 'technician',
  CASHIER: 'cashier',
} as const;

/** 审计日志操作类型 */
export const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
} as const;
