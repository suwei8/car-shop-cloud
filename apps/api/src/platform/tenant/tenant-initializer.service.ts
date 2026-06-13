import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SERVICE_ITEMS } from '../../../prisma/seed-data/service-items';
import { DICTIONARIES } from '../../../prisma/seed-data/dictionaries';

const BUILT_IN_ROLES = {
  TENANT_ADMIN: 'tenant_admin',
  SHOP_MANAGER: 'shop_manager',
  SERVICE_ADVISOR: 'service_advisor',
  TECHNICIAN: 'technician',
  CASHIER: 'cashier',
};

/** 权限码 → 角色分配映射 */
const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  [BUILT_IN_ROLES.TENANT_ADMIN]: [
    // 全部 tenant: 权限
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
    // 除角色/员工管理外的全部
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
    // 客户/车辆/预约(工单)/结算的查看与创建
    'tenant:customer:view', 'tenant:customer:create', 'tenant:customer:update',
    'tenant:vehicle:view', 'tenant:vehicle:create', 'tenant:vehicle:update',
    'tenant:workorder:view', 'tenant:workorder:create',
    'tenant:settlement:view',
    'tenant:shop:view',
  ],
  [BUILT_IN_ROLES.TECHNICIAN]: [
    // 工单查看、派工任务操作
    'tenant:workorder:view', 'tenant:workorder:update',
  ],
  [BUILT_IN_ROLES.CASHIER]: [
    // 结算、储值卡、套餐卡（member 覆盖储值卡和套餐卡）
    'tenant:settlement:view', 'tenant:settlement:manage',
    'tenant:member:view', 'tenant:member:manage',
  ],
};

/** 角色 code → 中文名 */
const ROLE_NAMES: Record<string, string> = {
  [BUILT_IN_ROLES.TENANT_ADMIN]: '商户管理员',
  [BUILT_IN_ROLES.SHOP_MANAGER]: '店长',
  [BUILT_IN_ROLES.SERVICE_ADVISOR]: '服务顾问',
  [BUILT_IN_ROLES.TECHNICIAN]: '技师',
  [BUILT_IN_ROLES.CASHIER]: '收银员',
};

export interface InitializeResult {
  tenantId: string;
  shopId: string;
  warehouseId: string;
  userId: string;
  adminPassword: string;
  roleCount: number;
  serviceItemCount: number;
  dictionaryCount: number;
}

@Injectable()
export class TenantInitializerService {
  private readonly logger = new Logger(TenantInitializerService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 为新租户初始化全套基础数据
   * 在调用方的事务中执行（tx 由外部传入）
   */
  async initialize(
    tx: any,
    tenantId: string,
    tenantName: string,
    adminPhone: string,
    adminPasswordHash: string,
    adminName: string,
  ): Promise<InitializeResult> {
    this.logger.log(`Initializing tenant: ${tenantId} (${tenantName})`);

    // 1. 默认门店
    const shop = await tx.shop.create({
      data: {
        tenantId,
        name: `${tenantName}（总店）`,
        status: 'active',
      },
    });
    this.logger.log(`  Created shop: ${shop.id}`);

    // 2. 默认仓库
    const warehouse = await tx.warehouse.create({
      data: {
        tenantId,
        shopId: shop.id,
        name: '默认仓库',
        isDefault: true,
        status: 'active',
      },
    });
    this.logger.log(`  Created warehouse: ${warehouse.id}`);

    // 3. 内置角色 + 权限绑定
    const allPermissions = await tx.permission.findMany();
    const permMap = new Map(allPermissions.map((p: any) => [p.code, p.id]));

    let roleCount = 0;
    for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSION_MAP)) {
      const role = await tx.role.create({
        data: {
          tenantId,
          name: ROLE_NAMES[roleCode] || roleCode,
          code: roleCode,
          isBuiltIn: true,
        },
      });

      for (const permCode of permCodes) {
        const permId = permMap.get(permCode);
        if (permId) {
          await tx.rolePermission.create({
            data: { roleId: role.id, permissionId: permId },
          });
        }
      }
      roleCount++;
    }
    this.logger.log(`  Created ${roleCount} roles with permissions`);

    // 4. 管理员账号
    const adminUser = await tx.user.create({
      data: {
        tenantId,
        phone: adminPhone,
        name: adminName,
        passwordHash: adminPasswordHash,
        isPlatform: false,
        status: 'active',
      },
    });

    // 绑定 tenant_admin 角色
    const adminRole = await tx.role.findFirst({
      where: { code: BUILT_IN_ROLES.TENANT_ADMIN, tenantId },
    });
    if (adminRole) {
      await tx.userRole.create({
        data: { userId: adminUser.id, roleId: adminRole.id },
      });
    }
    this.logger.log(`  Created admin user: ${adminUser.id}`);

    // 5. 预置服务项目
    let serviceItemCount = 0;
    for (const item of SERVICE_ITEMS) {
      await tx.serviceItem.create({
        data: {
          tenantId,
          name: item.name,
          category: item.category,
          unit: item.unit,
          unitPrice: item.unitPrice,
          description: item.description,
          status: 'active',
        },
      });
      serviceItemCount++;
    }
    this.logger.log(`  Created ${serviceItemCount} service items`);

    // 6. 预置字典
    let dictionaryCount = 0;
    for (const dict of DICTIONARIES) {
      await tx.dictionary.create({
        data: {
          tenantId,
          type: dict.type,
          code: dict.code,
          name: dict.name,
          sort: dict.sort,
          status: 'active',
        },
      });
      dictionaryCount++;
    }
    this.logger.log(`  Created ${dictionaryCount} dictionary entries`);

    return {
      tenantId,
      shopId: shop.id,
      warehouseId: warehouse.id,
      userId: adminUser.id,
      adminPassword: '',
      roleCount,
      serviceItemCount,
      dictionaryCount,
    };
  }
}
