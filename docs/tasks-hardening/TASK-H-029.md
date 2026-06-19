# TASK-H-029 派工 transaction 与任务状态类型收口

## 背景

`TASK-H-028` 后，`pnpm build:api` 的首个剩余阻塞点推进到 `DispatchService`：

- `create/start/complete` 中 `$transaction` 回调参数缺少显式类型；
- `complete` 中用于判断同工单任务是否全部完成的 `allTasks.every(...)` 回调参数被推断为隐式 `any`；
- 派工会联动工单状态，属于小程序维修闭环主路径，必须只做最小类型补强，不改变状态流转语义。

## 目标

1. 为派工服务引入 Prisma transaction 类型。
2. 为派工任务完成判断补齐最小 `id/status` 查询结果类型。
3. 在 `create/start/complete` 三个事务路径标注 `Prisma.TransactionClient`。
4. 保持派工创建、开工、暂停、完工和工单状态联动逻辑不变。

## 范围

- `apps/api/src/tenant/dispatch/dispatch.service.ts`
- `docs/tasks-hardening/README.md`
- `docs/tasks-hardening/TASK-H-029.md`

## 非目标

- 不调整派工状态机或工单状态枚举。
- 不新增派工业务规则。
- 不处理 `print/reminder/report/stock` 等后续 build 阻塞点。

## 验收命令

```bash
git diff --check -- apps/api/src/tenant/dispatch/dispatch.service.ts docs/tasks-hardening/TASK-H-029.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest --listTests | rg 'dispatch'
pnpm build:api
```

## 回执区域

- 修改文件：
  - `apps/api/src/tenant/dispatch/dispatch.service.ts`
  - `docs/tasks-hardening/README.md`
  - `docs/tasks-hardening/TASK-H-029.md`
- 实际执行命令：
  - `git diff --check -- apps/api/src/tenant/dispatch/dispatch.service.ts docs/tasks-hardening/TASK-H-029.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest --listTests | rg 'dispatch'`
  - `pnpm build:api`
- 测试结果：
  - `git diff --check -- ...` 通过，未发现 whitespace 问题。
  - `pnpm --filter @car/api exec jest --listTests | rg 'dispatch'` 未找到 dispatch 专属 Jest spec（命令退出 1，无输出）。
  - `pnpm build:api` 仍失败，但 dispatch 相关 4 个错误已消除；剩余 66 个错误从 `print.service.ts` 等后续模块开始。
- 已知限制：
  - 当前仓库未发现 dispatch 专属 Jest spec；本任务已通过 build 输出确认 dispatch 错误消除。
- 未完成项：
  - 继续按 build 输出处理 print/reminder/report 等后续模块。

## 审核区域

- 待审核。
