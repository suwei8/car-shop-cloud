# TASK-H-027 Analytics raw SQL 与聚合结果类型修复

## 背景

继续推进 TASK-H-020 的 API build 阻塞清理时，`AnalyticsService` 仍存在两类 strict TypeScript 错误：

- 当前 Prisma Client 生成状态下，`@prisma/client` 的 `Prisma.sql` / `Prisma.empty` 类型不可见；
- `workOrder.groupBy(...)` 的 status / orderType 聚合结果在 map 回调中被推导为隐式 `any`。

该服务包含营收趋势、工单状态分布、技师排行、客户增长和配件消耗等只读分析接口，是灰度验收中常见的数据看板路径。修复应保持 SQL 参数化和统计口径不变。

## 目标

- 改为从 Prisma runtime library 引入 raw SQL helper，避免 `Prisma.sql` / `Prisma.empty` namespace 类型不可见。
- 为工单状态与类型分布聚合结果增加最小结构类型。
- 保持所有 `$queryRaw` 参数化写法、租户过滤和返回结构不变。

## 范围

- `apps/api/src/tenant/analytics/analytics.service.ts`
- `docs/tasks-hardening/README.md`

## 非目标

- 不重写 analytics SQL。
- 不改变统计维度、默认日期范围和接口响应字段。
- 不处理 data-import、report、stock、work-order 等后续 build 错误。

## 验收命令

```bash
git diff --check -- apps/api/src/tenant/analytics/analytics.service.ts docs/tasks-hardening/TASK-H-027.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest src/tenant/analytics/analytics.service.spec.ts --runInBand
pnpm build:api
```

## 回执区域

- 修改文件清单：
  - `apps/api/src/tenant/analytics/analytics.service.ts`
  - `docs/tasks-hardening/TASK-H-027.md`
  - `docs/tasks-hardening/README.md`
- 实际执行的命令：
  - `git diff --check -- apps/api/src/tenant/analytics/analytics.service.ts docs/tasks-hardening/TASK-H-027.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest src/tenant/analytics/analytics.service.spec.ts --runInBand`
  - `pnpm build:api`
- 测试结果：`git diff --check` 通过；Analytics Jest 单测通过；`pnpm build:api` 的本任务相关 10 处 analytics 报错已消除，剩余 74 个错误属于其他历史 strict 类型债务。
- 已知限制：全量 API build 尚未通过。
- 未完成项：继续按 TASK-H-020 拆分清理 data-import、dispatch、report、stock、work-order 等剩余错误。

## 审核区域

- 状态：待审核
- 审核人：
- 审核意见：
