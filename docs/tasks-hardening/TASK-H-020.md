# TASK-H-020 API build 阻塞审计

## 背景

`TASK-H-019` 的结算链路单测已通过，但执行 `pnpm build:api` 时暴露出仓库内更大范围的 TypeScript 严格模式问题。该问题不应混入单个业务链路修正中，否则会扩大变更风险。

本任务先对当前 API 全量构建失败做审计，形成后续可拆分执行的修复清单。

## 审计命令

```bash
pnpm build:api
```

当前结果：失败，TypeScript 共报告 `129` 个错误，涉及 `24` 个文件。

## 主要错误类型

### 1. Prisma 查询结果在测试/构建上下文中退化为 `any` 或 `unknown`

表现为：

- callback 参数隐式 `any`；
- `new Set(...)` 推导成 `Set<unknown>`；
- 数组展开后不能赋值给 `string[]`。

典型文件：

- `src/auth/auth.service.ts`
- `src/auth/registration.service.ts`
- `src/platform/tenant/tenant.service.ts`
- `src/tenant/report/report.service.ts`
- `src/tenant/reminder/reminder-task.service.ts`
- `src/tenant/stock/stock.service.ts`
- `src/tenant/work-order/work-order.service.ts`

### 2. Prisma namespace 类型不匹配

表现为：

- `Prisma.sql` / `Prisma.empty` 类型不可见；
- `Prisma.PrismaClientKnownRequestError` 类型不可见；
- exception narrowing 后仍被 TypeScript 视为 `unknown`。

典型文件：

- `src/common/filters/http-exception.filter.ts`
- `src/tenant/analytics/analytics.service.ts`

### 3. 事务回调未显式标注

表现为：

```text
Parameter 'tx' implicitly has an 'any' type.
```

典型文件：

- `src/auth/registration.service.ts`
- `src/auth/wechat-login.service.ts`
- `src/platform/subscription-plan/subscription-plan.service.ts`
- `src/platform/tenant/tenant.service.ts`
- `src/tenant/role/role.service.ts`
- `src/tenant/user/user.service.ts`
- `src/tenant/stored-value-card/stored-value-card.service.ts`

## 当前错误文件分布

| 文件 | 错误数 |
| --- | ---: |
| `src/tenant/report/report.service.ts` | 26 |
| `src/auth/auth.service.ts` | 15 |
| `src/tenant/analytics/analytics.service.ts` | 10 |
| `src/platform/tenant/tenant.service.ts` | 8 |
| `src/tenant/stock/stock.service.ts` | 8 |
| `src/auth/registration.service.ts` | 6 |
| `src/common/filters/http-exception.filter.ts` | 6 |
| `src/platform/tenant-stats/tenant-stats.service.ts` | 6 |
| `src/tenant/reminder/reminder-task.service.ts` | 6 |
| `src/tenant/work-order/work-order.service.ts` | 6 |
| 其他 14 个文件 | 32 |

## 推荐拆分

不要一次性用大范围 `any` 消除所有错误。建议拆成以下任务：

1. `TASK-H-021`：Prisma error / raw SQL 类型修正
   - 修复 `http-exception.filter.ts`；
   - 修复 `analytics.service.ts` 中 `Prisma.sql` / `Prisma.empty` 类型问题。
2. `TASK-H-022`：认证与开户 JWT payload 类型修正
   - 修复 `auth.service.ts`；
   - 修复 `registration.service.ts`；
   - 修复 `wechat-login.service.ts`；
   - 避免 `roles` / `permissions` 推导为 `unknown[]`。
3. `TASK-H-023`：平台租户与租户统计类型修正
   - 修复 `platform/tenant`；
   - 修复 `tenant-stats`；
   - 明确 groupBy / map 结果类型。
4. `TASK-H-024`：业务报表、提醒、库存、工单类型修正
   - 修复 `report`、`reminder`、`stock`、`work-order` 等高错误数模块。
5. `TASK-H-025`：恢复 `pnpm build:api` 为灰度硬门禁
   - 所有类型错误清零后，把 `pnpm build:api` 保持为 `check:gray-ready` 必过项。

## 修改范围

- `docs/tasks-hardening/TASK-H-020.md`
- `docs/tasks-hardening/README.md`

## 验收命令

```bash
pnpm build:api
```

预期：当前仍失败，但错误已被本任务归档并拆分为后续可执行任务。

## 回执区域

- 2026-06-17：已完成 API build 阻塞审计，确认当前失败不是单一业务链路问题，而是仓库级 TypeScript 严格模式收口任务。
