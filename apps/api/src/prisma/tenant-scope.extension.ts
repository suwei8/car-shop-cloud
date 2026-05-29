import { Prisma } from '@prisma/client';

/**
 * 为 Prisma Client 添加租户自动过滤的扩展。
 * 使用方式：在需要租户隔离的查询中，通过 $extends 参数传入 tenantId。
 *
 * 示例：
 *   const scoped = prisma.withTenant(tenantId);
 *   const users = await scoped.user.findMany();
 */
export function createTenantExtension(tenantId: string) {
  const tenantModels = [
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
  ];

  const modelExtensions: Record<string, any> = {};

  for (const model of tenantModels) {
    modelExtensions[model] = {
      findMany: (args: any = {}) => {
        args.where = { ...args.where, tenantId };
        return args;
      },
      findFirst: (args: any = {}) => {
        args.where = { ...args.where, tenantId };
        return args;
      },
      findUnique: (args: any = {}) => {
        // findUnique 需要特殊处理，不直接加 where
        return args;
      },
      create: (args: any = {}) => {
        args.data = { ...args.data, tenantId };
        return args;
      },
      createMany: (args: any = {}) => {
        if (Array.isArray(args.data)) {
          args.data = args.data.map((d: any) => ({ ...d, tenantId }));
        } else {
          args.data = { ...args.data, tenantId };
        }
        return args;
      },
      update: (args: any = {}) => {
        args.where = { ...args.where, tenantId };
        return args;
      },
      updateMany: (args: any = {}) => {
        args.where = { ...args.where, tenantId };
        return args;
      },
      delete: (args: any = {}) => {
        args.where = { ...args.where, tenantId };
        return args;
      },
      deleteMany: (args: any = {}) => {
        args.where = { ...args.where, tenantId };
        return args;
      },
      count: (args: any = {}) => {
        args.where = { ...args.where, tenantId };
        return args;
      },
      aggregate: (args: any = {}) => {
        args.where = { ...args.where, tenantId };
        return args;
      },
    };
  }

  return modelExtensions;
}
