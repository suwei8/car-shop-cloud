# TASK-H-024 灰度脚本与开户订阅路径类型补强

## 背景

继续推进 TASK-H-020 的 API build 阻塞清理时，当前最靠前的一组 strict TypeScript 错误集中在灰度/审计脚本与开户订阅路径：

- `audit-login-phones.ts` 中 Prisma 查询结果在 `filter` 回调处被推导为 `any`；
- `gray-seed.ts` 中权限列表映射回调缺少明确记录类型；
- `wechat-login.service.ts` 的开户 transaction 回调缺少 `Prisma.TransactionClient`；
- `subscription-plan.service.ts` 的订阅 transaction 回调缺少 `Prisma.TransactionClient`。

这些问题不改变业务行为，但会持续阻断 `pnpm build:api`，也会影响灰度初始化、登录审计和订阅开通路径的编译可信度。

## 目标

- 为灰度脚本和审计脚本补齐最小必要的结果类型声明。
- 为微信开户注册与平台订阅开通 transaction 回调补齐 Prisma transaction client 类型。
- 不改变查询条件、写库逻辑、审计输出格式和订阅业务流程。

## 范围

- `apps/api/scripts/audit-login-phones.ts`
- `apps/api/scripts/gray-seed.ts`
- `apps/api/src/auth/wechat-login.service.ts`
- `apps/api/src/platform/subscription-plan/subscription-plan.service.ts`
- `docs/tasks-hardening/README.md`

## 非目标

- 不连接真实数据库执行写入型灰度 seed。
- 不调整微信登录/绑定业务规则。
- 不处理 tenant-stats、tenant.service、analytics、report、stock 等后续 build 错误。

## 验收命令

```bash
git diff --check -- apps/api/scripts/audit-login-phones.ts apps/api/scripts/gray-seed.ts apps/api/src/auth/wechat-login.service.ts apps/api/src/platform/subscription-plan/subscription-plan.service.ts docs/tasks-hardening/TASK-H-024.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest src/auth/wechat-login.service.spec.ts --runInBand
pnpm build:api
```

## 回执区域

- 修改文件清单：
  - `apps/api/scripts/audit-login-phones.ts`
  - `apps/api/scripts/gray-seed.ts`
  - `apps/api/src/auth/wechat-login.service.ts`
  - `apps/api/src/platform/subscription-plan/subscription-plan.service.ts`
  - `docs/tasks-hardening/TASK-H-024.md`
  - `docs/tasks-hardening/README.md`
- 实际执行的命令：
  - `git diff --check -- apps/api/scripts/audit-login-phones.ts apps/api/scripts/gray-seed.ts apps/api/src/auth/wechat-login.service.ts apps/api/src/platform/subscription-plan/subscription-plan.service.ts docs/tasks-hardening/TASK-H-024.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest src/auth/wechat-login.service.spec.ts --runInBand`
  - `pnpm build:api`
- 测试结果：`git diff --check` 通过；微信登录单测通过；`pnpm build:api` 的本任务相关 4 处报错已消除，剩余 98 个错误属于其他历史 strict 类型债务。
- 已知限制：未执行真实数据库 gray seed 写入；全量 API build 尚未通过。
- 未完成项：继续按 TASK-H-020 拆分清理剩余 strict TypeScript errors。

## 审核区域

- 状态：待审核
- 审核人：
- 审核意见：
