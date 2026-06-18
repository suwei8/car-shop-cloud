# TASK-H-025 平台租户概览统计类型收口

## 背景

继续推进 TASK-H-020 的 API build 阻塞清理时，`TenantStatsService.getAllTenantsOverview()` 中多组 Prisma 聚合结果在 `map` 回调里被推导为隐式 `any`。该服务用于平台侧查看租户活跃度、近 30 日工单/结算、用户和客户规模等关键概览指标，属于灰度验收和运营后台常用路径。

## 目标

- 为租户概览查询结果和聚合结果定义最小必要类型。
- 在构建 map 前将 Prisma 返回值收口到明确结构，消除隐式 `any`。
- 保持现有统计口径和返回字段不变。

## 范围

- `apps/api/src/platform/tenant-stats/tenant-stats.service.ts`
- `docs/tasks-hardening/README.md`

## 非目标

- 不改变平台租户统计的查询条件和聚合维度。
- 不新增接口字段或分页逻辑。
- 不处理平台租户管理、tenant analytics、report 等后续 build 错误。

## 验收命令

```bash
git diff --check -- apps/api/src/platform/tenant-stats/tenant-stats.service.ts docs/tasks-hardening/TASK-H-025.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest src/platform/tenant-stats/tenant-stats.service.spec.ts --runInBand
pnpm build:api
```

## 回执区域

- 修改文件清单：
  - `apps/api/src/platform/tenant-stats/tenant-stats.service.ts`
  - `docs/tasks-hardening/TASK-H-025.md`
  - `docs/tasks-hardening/README.md`
- 实际执行的命令：
  - `git diff --check -- apps/api/src/platform/tenant-stats/tenant-stats.service.ts docs/tasks-hardening/TASK-H-025.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest src/platform/tenant-stats/tenant-stats.service.spec.ts --runInBand`
  - `pnpm build:api`
- 测试结果：`git diff --check` 通过；平台租户统计 Jest 单测通过；`pnpm build:api` 的本任务相关 6 处 tenant-stats 隐式 any 报错已消除，剩余 92 个错误属于其他历史 strict 类型债务。
- 已知限制：全量 API build 尚未通过。
- 未完成项：继续按 TASK-H-020 拆分清理剩余 strict TypeScript errors。

## 审核区域

- 状态：待审核
- 审核人：
- 审核意见：
