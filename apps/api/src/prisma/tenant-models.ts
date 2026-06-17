/**
 * Tenant model metadata — explicit list of which Prisma models
 * require tenant scoping, which are platform/global, and which
 * are allowed to be unscoped.
 */

/** Prisma models that MUST carry tenantId — business tables scoped to a tenant */
export const TENANT_SCOPED_MODELS = [
  'shop',
  'user',
  'employee',
  'role',
  'dictionary',
  'systemParameter',
  'file',
  'auditLog',
  'appDevice',
  'tenantSubscription',
  'tenantFeatureFlag',
  'subscriptionOrder',
  'customer',
  'vehicle',
  'appointment',
  'reception',
  'serviceItem',
  'workOrder',
  'workOrderItem',
  'inspectionRecord',
  'dispatchTask',
  'part',
  'supplier',
  'warehouse',
  'stockBalance',
  'stockBill',
  'stockBillItem',
  'stockMovement',
  'settlement',
  'payment',
  'paymentRefund',
  'storedValueCard',
  'storedValueTransaction',
  'packageCard',
  'packageCardItem',
  'packageCardTransaction',
  'sequence',
  'notification',
  'reminder',
  'coupon',
  'couponClaim',
] as const;

/** Subset of tenant-scoped models that also commonly carry shopId */
export const SHOP_SCOPED_MODELS = [
  'employee',
  'warehouse',
  'stockBill',
  'settlement',
  'workOrder',
  'appointment',
  'reception',
  'notification',
  'reminder',
] as const;

/** Platform-level models — accessed by super-admin, no tenant scoping */
export const PLATFORM_MODELS = [
  'tenant',
  'subscriptionPlan',
  'featureFlag',
  'permission',
] as const;

/** Explicitly allowed to skip tenant scope (junction / lookup tables without tenantId) */
export const ALLOW_UNSCOPED_MODELS = [
  'refreshToken',
  'userRole',
  'rolePermission',
] as const;

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];
export type ShopScopedModel = (typeof SHOP_SCOPED_MODELS)[number];
export type PlatformModel = (typeof PLATFORM_MODELS)[number];
export type UnscopedModel = (typeof ALLOW_UNSCOPED_MODELS)[number];
