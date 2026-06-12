# TASK-005：数据权限 — 行级 shopId 隔离

> **优先级**：P1
> **状态**：待派发
> **依赖**：TASK-001（全局响应格式）
> **可并行**：TASK-002（状态机）

## 1. 任务目标

实现产品要求的数据范围权限控制：员工只能查看其权限范围内的数据（本人、所在门店、全部门店），在后端自动注入 `shopId` 过滤条件，不依赖前端传入。

## 2. 涉及文件

### 新建文件
- `apps/api/src/common/decorators/data-scope.decorator.ts` — 数据范围装饰器
- `apps/api/src/common/guards/data-scope.guard.ts` — 数据范围守卫（可选）
- `apps/api/src/common/utils/scope-where.ts` — 查询条件注入工具函数

### 修改文件
- `apps/api/src/common/decorators/index.ts` — 导出新装饰器
- 所有带 `shopId` 字段的业务 Service 的 `findAll` 方法

## 3. 详细要求

### 3.1 数据范围定义

在角色或员工级别定义数据范围：

```typescript
enum DataScope {
  SELF = 'self',           // 仅本人创建的数据
  SHOP = 'shop',           // 所在门店的数据
  ALL = 'all',             // 全部数据（跨门店）
}
```

### 3.2 JWT Payload 扩展

当前 JWT Payload 中已有 `shopId`（来自 employee），需要：

1. 在 `User` 或 `Employee` 模型中确定数据范围的存储位置
2. 建议在 `Employee` 模型中新增 `dataScope` 字段（String，默认 'shop'），或在 `Role` 中定义
3. **如果不想修改 schema**：可以在登录时根据角色推断数据范围（如：老板/店长角色 → 'all'，其他 → 'shop'）

**推荐方案（不改 schema）**：

```typescript
// 在 auth.service.ts 的 login 方法中，根据角色推断 dataScope
function inferDataScope(roles: string[]): DataScope {
  if (roles.some(r => ['admin', 'owner', 'manager'].includes(r))) {
    return DataScope.ALL;
  }
  return DataScope.SHOP;
}
```

将 `dataScope` 加入 JWT Payload（`JwtPayload` 接口）。

### 3.3 查询条件注入工具

```typescript
// scope-where.ts
import { JwtPayload } from '@car/shared';

/**
 * 根据用户数据范围生成查询 where 条件
 * @param user JWT 载荷
 * @param baseWhere 基础查询条件（已包含 tenantId）
 * @param scopeField 查询条件中的字段名（默认 'shopId'）
 * @param ownerField 数据所属人字段名（默认 'advisorId' 或 'operatorId'，用于 SELF 范围）
 */
export function applyDataScope(
  user: JwtPayload,
  baseWhere: Record<string, any>,
  scopeField = 'shopId',
  ownerField?: string,
): Record<string, any> {
  const scope = (user as any).dataScope || 'shop';

  switch (scope) {
    case 'all':
      return baseWhere; // 不额外过滤
    case 'shop':
      if (user.shopId) {
        return { ...baseWhere, [scopeField]: user.shopId };
      }
      return baseWhere;
    case 'self':
      if (ownerField && user.sub) {
        return { ...baseWhere, [ownerField]: user.sub };
      }
      return baseWhere;
    default:
      return baseWhere;
  }
}
```

### 3.4 应用到业务 Service

以下 Service 的 `findAll` 方法需要接入数据范围过滤：

| Service | scopeField | ownerField |
|---|---|---|
| `work-order.service.ts` | `shopId` | `advisorId` |
| `customer.service.ts` | 无 shopId，按 tenantId 即可 | 无 |
| `vehicle.service.ts` | 无 shopId，按 tenantId 即可 | 无 |
| `settlement.service.ts` | `shopId` | `operatorId` |
| `dispatch.service.ts` | `workOrder.shopId`（需 join） | `technicianId` |
| `stock.service.ts` | `shopId`（通过 warehouse） | `operatorId` |
| `stored-value-card.service.ts` | 无 shopId | 无 |
| `package-card.service.ts` | 无 shopId | 无 |

**使用示例**：

```typescript
// work-order.service.ts
import { applyDataScope } from '../../common/utils/scope-where';

async findAll(user: JwtPayload, query: { ... }) {
  const where: any = { tenantId: user.tenantId! };
  // ... 现有筛选条件 ...

  // 新增：应用数据范围过滤
  const scopedWhere = applyDataScope(user, where, 'shopId', 'advisorId');

  const [items, total] = await Promise.all([
    this.prisma.workOrder.findMany({ where: scopedWhere, ... }),
    this.prisma.workOrder.count({ where: scopedWhere }),
  ]);
  // ...
}
```

### 3.5 JwtPayload 类型更新

更新 `packages/shared/src/types.ts`（或 `types/index.ts`）中的 `JwtPayload` 接口：

```typescript
export interface JwtPayload {
  sub: string;
  tenantId: string | null;
  shopId: string | null;
  isPlatform: boolean;
  roles: string[];
  permissions: string[];
  dataScope?: 'self' | 'shop' | 'all';  // 新增
}
```

### 3.6 登录时写入 dataScope

修改 `auth.service.ts` 的 `login` 和 `refresh` 方法，在生成 JWT Payload 时加入 `dataScope`。

## 4. 验收标准

- [ ] JWT Payload 中包含 `dataScope` 字段
- [ ] 数据范围为 `shop` 的用户，查询工单只返回其门店数据
- [ ] 数据范围为 `all` 的用户（如老板/店长），可查看所有门店数据
- [ ] 数据范围为 `self` 的用户，只返回自己创建/负责的数据
- [ ] 所有带 `shopId` 的业务 Service 都已接入 `applyDataScope`
- [ ] 前端传入的 `shopId` 参数不再覆盖数据范围（后端优先）
- [ ] `nest build` 编译通过

## 5. 注意事项

- 如果现有角色代码（Role.code）不包含 'admin'/'owner'/'manager'，需要先查看 seed 数据确定实际角色代码
- 不要修改 Prisma schema（数据范围通过角色推断，不新增字段）
- 平台用户（`isPlatform: true`）不受数据范围限制
- 保持向后兼容：如果 `dataScope` 不在 JWT 中（旧 token），默认按 'shop' 处理

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下内容追加到本文件末尾：**

### 回执

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `packages/shared/src/types/index.ts`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/tenant/work-order/work-order.service.ts`, `apps/api/src/tenant/settlement/settlement.service.ts`, `apps/api/src/tenant/dispatch/dispatch.service.ts`, `apps/api/src/tenant/stock/stock.service.ts` |
| 新建的文件列表 | `apps/api/src/common/utils/scope-where.ts` |
| 构建是否通过 (nest build) | 通过 |
| dataScope 推断规则 | `tenant_admin`、`shop_manager` → `'all'`；其他角色 → `'shop'`；平台用户不设置 |
| 接入数据范围控制的 Service 清单 | `WorkOrderService.findAll`（shopId/advisorId）、`SettlementService.findAll`（shopId/operatorId）、`DispatchService.findAll`（workOrder.shopId/technicianId）、`StockService.getBalances`（warehouse.shopId）、`StockService.getMovements`（warehouse.shopId）、`StockService.getBills`（shopId/operatorId） |
| 已知限制或遗留问题 | 无 |
| 执行耗时 | ~5min |

### 二次审核整改记录

| 项目 | 内容 |
|------|------|
| 问题描述 | `applyDataScope` 用于 Prisma 关系字段时，将 scopeField 设为字符串值（如 `where.workOrder = user.shopId`），但 Prisma 关系过滤期望对象格式（如 `where.workOrder = { shopId: user.shopId }`） |
| 修复方案 | 移除 `applyDataScope` 调用，改为手动判断 `dataScope` 并设置正确格式 |
| 修复的文件 | `apps/api/src/tenant/dispatch/dispatch.service.ts`、`apps/api/src/tenant/stock/stock.service.ts` |
| 构建是否通过 | 通过 |

---

## 7. 架构师审核区域

> **架构师审核后填写：**

```markdown
### 审核结果

- **审核时间**：2026-06-11
- **审核结论**：✅ 通过（整改完成）
- **初次审核问题**：`dispatch.service.ts` 和 `stock.service.ts` 使用 `applyDataScope` 处理关系字段时格式错误
- **整改确认**（二次审核）：
  - `dispatch.service.ts` ✅ 移除 `applyDataScope`，手动设置 `where.workOrder = { shopId: user.shopId }`
  - `stock.service.ts` ✅ `getBalances`/`getMovements` 使用 `where.warehouse = { shopId: ... }`，`getBills` 使用直接列 `shopId`
  - nest build 编译通过
- **TASK-005 状态**：已关闭 ✅
```
