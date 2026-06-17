# TASK-H-002 — 租户隔离强约束设计与第一阶段落地

> 优先级：P0
> 状态：✅ 已关闭
> 目标：把当前主要依赖 service 手写 `tenantId` 的隔离方式，收口为可审计、可复用、可测试的后端强约束，降低后续新增业务模块漏加租户条件的风险。

## 1. 背景

当前后端已经在大多数 service 中手写 `tenantId: user.tenantId!`，并通过 `TenantGuard` 确保商户用户必须带租户信息。但这仍依赖开发者纪律。

项目里存在 `apps/api/src/prisma/tenant-scope.extension.ts`，但当前没有接入 `PrismaService`，且模型列表不完整，不能作为实际保护边界。

开户主要来自商户端小程序自助注册：老板注册后自动创建租户、默认门店、默认仓库、管理员账号和试用订阅。因此租户隔离必须默认可靠，不能要求前端传入 `tenantId`。

## 2. 设计原则

1. **JWT 是租户来源**：业务请求的 `tenantId` 只能来自 JWT，不可信任 body/query/path 中的 `tenantId`。
2. **业务 service 不直接接受客户端 tenantId**：DTO 中如出现 `tenantId` 应删除或忽略。
3. **租户模型清单显式化**：哪些 Prisma model 必须 tenant scope，哪些是 platform/global model，必须有代码级清单。
4. **平台模块例外明确化**：平台管理员访问 `platform/*` 时可以跨租户，但必须在 platform service 内显式查询。
5. **渐进落地**：先建立统一 helper 和测试护栏，再逐步迁移高风险 service，避免一次性重写全业务。

## 3. 推荐架构

### 3.1 新增租户模型元数据

新增文件：

```text
apps/api/src/prisma/tenant-models.ts
```

内容包含：

- `TENANT_SCOPED_MODELS`：必须带 `tenantId` 的业务模型；
- `SHOP_SCOPED_MODELS`：除 `tenantId` 外还常带 `shopId` 的模型；
- `PLATFORM_MODELS`：平台全局模型，如 `Tenant`、`SubscriptionPlan`、`FeatureFlag`、`Permission`；
- `ALLOW_UNSCOPED_MODELS`：明确允许不走租户 scope 的技术模型或平台查询。

### 3.2 新增统一查询 helper

新增文件：

```text
apps/api/src/common/utils/tenant-where.ts
```

提供：

```ts
tenantWhere(user, where?)
tenantCreate(user, data?)
assertTenantUser(user)
assertSameTenantId(user, tenantIdFromData)
```

要求：

- `tenantWhere(user, where)` 返回 `{ ...where, tenantId: user.tenantId! }`，若 `where` 中已有不同 `tenantId`，抛 `ForbiddenException`。
- `tenantCreate(user, data)` 强制写入 `tenantId: user.tenantId!`，并拒绝客户端传入不一致 `tenantId`。
- `assertTenantUser(user)` 用于 service 层显式保护。

### 3.3 第一阶段迁移范围

第一阶段只迁移高风险、核心业务 service：

- `work-order.service.ts`
- `settlement.service.ts`
- `stock.service.ts`
- `customer.service.ts`
- `vehicle.service.ts`
- `stored-value-card.service.ts`
- `package-card.service.ts`

不要一次性迁移所有 service。

### 3.4 测试要求

新增测试覆盖：

- `tenantWhere` 正常合并 where；
- 客户端传入相同 `tenantId` 时不报错；
- 客户端传入不同 `tenantId` 时抛 `ForbiddenException`；
- `tenantCreate` 覆盖/拒绝客户端不一致 `tenantId`；
- 至少一个核心 service 验证不会使用 DTO 中的 `tenantId`。

### 3.5 审计脚本

新增只读脚本或 npm 脚本：

```bash
pnpm audit:tenant-scope
```

第一阶段可以简单实现为 Node/TS 脚本或 shell 脚本，扫描：

- tenant service 中的 `findUnique({ where: { id`；
- `update({ where: { id`；
- DTO 中的 `tenantId`;
- `data: { ...dto }` 这类可能把客户端 tenantId 写入数据库的代码。

脚本不要求零误报，但必须输出可读清单，方便后续人工审查。

## 4. 非目标

- 不要在本任务中重写全部 service。
- 不要修改 Prisma schema。
- 不要引入数据库 RLS；RLS 可作为后续生产强化议题，但当前先做应用层强约束。
- 不要影响平台运营后台跨租户查询能力。

## 5. 验收标准

必须执行：

```bash
pnpm --filter @car/api exec jest --runInBand
pnpm build:api
pnpm audit:tenant-scope
```

并在回执中写入：

- 新增模型清单；
- 第一阶段迁移了哪些 service；
- 审计脚本输出的风险项摘要；
- 未迁移 service 清单；
- 是否存在必须架构师判断的例外。

## 6. 回执区域（执行 Agent 填写）

> 执行 Agent 只允许在本节追加内容，不得改动第 7 节。

### 执行回执 — 2026-06-17

#### 新增模型清单

文件 `apps/api/src/prisma/tenant-models.ts`：

| 分类 | 模型 |
|------|------|
| **TENANT_SCOPED_MODELS** (42) | shop, user, employee, role, dictionary, systemParameter, file, auditLog, appDevice, tenantSubscription, tenantFeatureFlag, subscriptionOrder, customer, vehicle, appointment, reception, serviceItem, workOrder, workOrderItem, inspectionRecord, dispatchTask, part, supplier, warehouse, stockBalance, stockBill, stockBillItem, stockMovement, settlement, payment, paymentRefund, storedValueCard, storedValueTransaction, packageCard, packageCardItem, packageCardTransaction, sequence, notification, reminder, coupon, couponClaim |
| **SHOP_SCOPED_MODELS** (9) | employee, warehouse, stockBill, settlement, workOrder, appointment, reception, notification, reminder |
| **PLATFORM_MODELS** (4) | tenant, subscriptionPlan, featureFlag, permission |
| **ALLOW_UNSCOPED_MODELS** (3) | refreshToken, userRole, rolePermission |

#### 新增统一查询 Helper

文件 `apps/api/src/common/utils/tenant-where.ts`：

| 函数 | 作用 |
|------|------|
| `assertTenantUser(user)` | 断言用户有 tenantId，否则抛 ForbiddenException |
| `tenantWhere(user, where?)` | 合并 where 并强制注入 `tenantId`；若客户端传入不一致 tenantId 则拒绝 |
| `tenantCreate(user, data?)` | 合并 data 并强制注入 `tenantId`；若客户端传入不一致 tenantId 则拒绝 |
| `assertSameTenantId(user, tenantIdFromData, context?)` | 校验记录 tenantId 与 JWT 一致 |

#### 第一阶段迁移的 Service（7 个）

| Service | 迁移内容 |
|---------|----------|
| `work-order.service.ts` | findAll 用 `tenantWhere`；create 用 `tenantCreate` |
| `settlement.service.ts` | findAll/getPayments 用 `tenantWhere`；settle 用 `tenantCreate` |
| `stock.service.ts` | getBalances/getMovements/getBills 用 `tenantWhere`；stockIn 用 `tenantCreate` |
| `customer.service.ts` | findAll 用 `tenantWhere`；create 用 `tenantCreate` |
| `vehicle.service.ts` | findAll 用 `tenantWhere`；create 用 `tenantCreate` |
| `stored-value-card.service.ts` | findAll/getTransactions 用 `tenantWhere`；create 用 `tenantCreate` |
| `package-card.service.ts` | findAll/getTransactions 用 `tenantWhere`；create 用 `tenantCreate` |

#### 验收命令执行结果

```bash
# pnpm --filter @car/api exec jest --runInBand
Test Suites: 29 passed, 29 total
Tests:       280 passed, 280 total

# pnpm build:api
✓ nest build — 成功

# pnpm audit:tenant-scope
WARNINGS (3):
  - payment-gateway.service.ts:42,195,252 — findUnique({ where: { id } }) 无 tenantId
INFO (153): informational / already mitigated，其中 subscription.service.ts:298 为 Tenant 平台模型查询
```

#### 审计脚本输出的风险项摘要

3 个 WARN 均在非第一阶段迁移范围的 service 中：

1. **`payment-gateway.service.ts:42,195,252`** — 3 处 `payment.findUnique({ where: { id: paymentId } })` 未带 tenantId。这些是支付回调/查询场景，paymentId 由内部生成（非客户端输入），风险可控，但建议后续迁移时加 tenantId 约束。
2. **`subscription.service.ts:298`** — `tx.tenant.findUnique({ where: { id: order.tenantId } })`。这是查询 Tenant 平台模型，已由架构师复核后在审计脚本中降级为 INFO。

#### 未迁移 Service 清单

以下 tenant service 未在第一阶段迁移，审计脚本仍报告 `Manual tenantId` 信息项：

- `appointment.service.ts`
- `dashboard.service.ts`
- `data-import.service.ts`
- `dictionary.service.ts`
- `dispatch.service.ts`
- `inspection.service.ts`
- `marketing.service.ts`
- `part.service.ts`
- `payment/payment-gateway.service.ts`（另有 3 个 WARN）
- `print.service.ts`
- `reminder.service.ts` / `reminder-task.service.ts`
- `role.service.ts`
- `service-item.service.ts`
- `shop.service.ts`
- `supplier.service.ts`
- `subscription.service.ts`
- `system-parameter.service.ts`
- `user.service.ts`
- `warranty.service.ts`
- `report/report-export.service.ts`（仅 spec 中出现）

#### 需要架构师判断的例外

1. **`payment-gateway.service.ts` 的 `findUnique` 无 tenantId**：支付回调由第三方触发，paymentId 由系统内部生成。若后续有共享 payment 表的可能（跨租户对账），需评估是否加 tenantId。当前建议：在第二阶段迁移时一并修复。
2. **`tenantWhere`/`tenantCreate` 对 `findFirst({ where: { id, tenantId } })` 模式的覆盖**：findOne 类方法保留了手动 `{ id, tenantId: user.tenantId! }` 写法，未强制改用 `tenantWhere`。原因：findOne 的 id 来自路径参数（非 DTO），且 tenantId 已正确绑定。若需更强约束（如改用 `assertSameTenantId` + 不含 tenantId 的 where），需架构师确认。
3. **`Sequence` 模型归类**：任务书初稿示例曾把 `Sequence` 列入平台模型，但当前 schema 中 `Sequence.tenantId` 为必填，实际用于租户内编号，因此最终归为 `TENANT_SCOPED_MODELS`。

#### 新增文件清单

- `apps/api/src/prisma/tenant-models.ts` — 租户模型元数据
- `apps/api/src/common/utils/tenant-where.ts` — 统一查询 helper
- `apps/api/src/common/utils/tenant-where.spec.ts` — helper 单元测试
- `apps/api/scripts/audit-tenant-scope.ts` — 审计脚本

#### 修改文件清单

- `apps/api/src/tenant/work-order/work-order.service.ts`
- `apps/api/src/tenant/settlement/settlement.service.ts`
- `apps/api/src/tenant/stock/stock.service.ts`
- `apps/api/src/tenant/customer/customer.service.ts`
- `apps/api/src/tenant/vehicle/vehicle.service.ts`
- `apps/api/src/tenant/stored-value-card/stored-value-card.service.ts`
- `apps/api/src/tenant/package-card/package-card.service.ts`
- `apps/api/package.json` — 新增 `audit:tenant-scope` 脚本
- `package.json`（根目录）— 新增 `audit:tenant-scope` 脚本

## 7. 架构师审核区域

> 架构师填写。

### 审核结论 — 2026-06-17

结论：整改后通过，TASK-H-002 关闭。

审核整改：

- 删除 MiMo 生成的空洞 service 安全测试，改为 `work-order.service.spec.ts` 中真实断言：运行时即使传入 `tenantId: tenant-evil`，最终写入仍使用 JWT 的 `tenant-1`。
- 修正审计脚本：DTO 检查只扫描 `*.dto.ts`，平台 `Tenant` 查询降级为 INFO，warning 不再导致脚本退出失败。
- 移除 `work-order.service.ts` 未使用的 `assertSameTenantId` import。
- 修正任务书中 `Sequence` 的模型归类说明，避免与 Prisma schema 冲突。

最终验证：

```bash
pnpm --filter @car/api exec jest --runInBand
# Test Suites: 29 passed, 29 total
# Tests: 280 passed, 280 total

pnpm build:api
# nest build 成功

pnpm audit:tenant-scope
# WARNINGS (3): payment-gateway.service.ts:42,195,252
# INFO (153): 含 subscription.service.ts:298 平台 Tenant 查询

git diff --check
# 通过
```

后续进入 TASK-H-006：支付网关租户隔离补强，处理 `payment-gateway.service.ts` 三处 `findUnique({ id })`。
