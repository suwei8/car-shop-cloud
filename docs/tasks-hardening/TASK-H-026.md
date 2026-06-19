# TASK-H-026 平台租户管理类型收口

## 背景

继续推进 TASK-H-020 的 API build 阻塞清理时，`PlatformTenantService` 是当前最靠前的一组错误来源：

- `create` / `renew` / `extend` 的 transaction 回调缺少 `Prisma.TransactionClient`；
- `impersonate` 中管理员账号的 roles / permissions 提取重复实现，并在严格模式下触发隐式 `any` 和 `unknown[]`；
- 该路径与 H022 已收口的员工端 JWT payload 构造逻辑重叠，应复用统一工具避免再次分叉。

## 目标

- 为平台租户创建、续费、延期 transaction 回调补齐 Prisma transaction client 类型。
- 复用 `buildEmployeeJwtPayload(...)` 构建 impersonate 员工端 JWT payload。
- 保持 impersonate 的 `impersonatedBy` 审计字段、30 分钟 token 有效期和现有审计日志行为不变。

## 范围

- `apps/api/src/platform/tenant/tenant.service.ts`
- `docs/tasks-hardening/README.md`

## 非目标

- 不改变平台租户创建、续费、延期、停用、恢复的业务流程。
- 不调整 JWT 签名有效期或审计日志字段。
- 不处理 analytics、data-import、report、stock、work-order 等后续 build 错误。

## 验收命令

```bash
git diff --check -- apps/api/src/platform/tenant/tenant.service.ts docs/tasks-hardening/TASK-H-026.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest src/platform/tenant/tenant.service.spec.ts --runInBand
pnpm build:api
```

## 回执区域

- 修改文件清单：
  - `apps/api/src/platform/tenant/tenant.service.ts`
  - `docs/tasks-hardening/TASK-H-026.md`
  - `docs/tasks-hardening/README.md`
- 实际执行的命令：
  - `git diff --check -- apps/api/src/platform/tenant/tenant.service.ts docs/tasks-hardening/TASK-H-026.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest src/platform/tenant/tenant.service.spec.ts --runInBand`
  - `pnpm build:api`
- 测试结果：`git diff --check` 通过；平台租户管理 Jest 单测通过；`pnpm build:api` 的本任务相关 8 处 platform tenant 报错已消除，剩余 84 个错误属于其他历史 strict 类型债务。
- 已知限制：全量 API build 尚未通过。
- 未完成项：继续按 TASK-H-020 拆分清理 analytics、data-import、report、stock、work-order 等剩余错误。

## 审核区域

- 状态：待审核
- 审核人：
- 审核意见：
