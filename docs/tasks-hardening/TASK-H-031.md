# TASK-H-031 提醒任务与列表映射类型收口

## 背景

`TASK-H-030` 后，`pnpm build:api` 的首个剩余阻塞点推进到 reminder 模块：

- `ReminderTaskService` 中套餐卡/储值卡提醒生成的 `cards.map(...)`、`customers.map(...)`、`items.reduce(...)` 参数被推断为隐式 `any`；
- `ReminderService` 中提醒列表的 `items.map(...)`、车辆查询结果 `vehicles.map(...)` 参数被推断为隐式 `any`；
- 提醒任务是每日经营提醒生成链路，列表接口也受数据范围过滤影响，本任务只做类型收口，不改变提醒生成和展示逻辑。

## 目标

1. 为提醒任务中的客户、套餐卡、储值卡查询结果补齐最小本地接口。
2. 为套餐卡剩余次数汇总和客户映射补齐 callback 参数类型。
3. 为提醒列表中的提醒项与车辆车牌查询结果补齐最小本地接口。
4. 保持提醒生成条件、内容文案、upsert 行为和列表返回结构不变。

## 范围

- `apps/api/src/tenant/reminder/reminder-task.service.ts`
- `apps/api/src/tenant/reminder/reminder.service.ts`
- `docs/tasks-hardening/README.md`
- `docs/tasks-hardening/TASK-H-031.md`

## 非目标

- 不调整提醒阈值、Cron 时间或提醒类型。
- 不改变 `applyDataScope(...)` 的调用方式。
- 不处理 report/stock 等后续 build 阻塞点。

## 验收命令

```bash
git diff --check -- apps/api/src/tenant/reminder/reminder-task.service.ts apps/api/src/tenant/reminder/reminder.service.ts docs/tasks-hardening/TASK-H-031.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest src/tenant/reminder/reminder-task.service.spec.ts --runInBand
pnpm build:api
```

## 回执区域

- 修改文件：
  - `apps/api/src/tenant/reminder/reminder-task.service.ts`
  - `apps/api/src/tenant/reminder/reminder.service.ts`
  - `docs/tasks-hardening/README.md`
  - `docs/tasks-hardening/TASK-H-031.md`
- 实际执行命令：
  - `git diff --check -- apps/api/src/tenant/reminder/reminder-task.service.ts apps/api/src/tenant/reminder/reminder.service.ts docs/tasks-hardening/TASK-H-031.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest src/tenant/reminder/reminder-task.service.spec.ts --runInBand`
  - `pnpm build:api`
- 测试结果：
  - `git diff --check -- ...` 通过，未发现 whitespace 问题。
  - `pnpm --filter @car/api exec jest src/tenant/reminder/reminder-task.service.spec.ts --runInBand` 通过（1 suite / 13 tests）。
  - `pnpm build:api` 仍失败，但 reminder 相关 9 个错误已消除；剩余 53 个错误从 `report.service.ts` 等后续模块开始。
- 已知限制：
  - `pnpm build:api` 仍被 report/stock 等后续历史严格模式错误阻塞，本任务已将首个阻塞点从 reminder 推进到 report。
- 未完成项：
  - 继续按 build 输出处理 report/stock/role 等后续模块。

## 审核区域

- 待审核。
