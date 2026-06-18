# TASK-H-028 数据导入 preview/execute 类型收口

## 背景

`pnpm build:api` 的下一组阻塞点集中在 `DataImportService`：

- preview 阶段把 Prisma 查询结果直接传入 `new Set(...)`，在严格模式下被推断为 `Set<unknown>`，无法传给需要 `Set<string>` 的解析函数；
- execute 阶段 `$transaction` 回调参数缺少显式类型，触发隐式 `any`；
- 数据导入会批量创建客户、车辆、储值卡和储值交易记录，属于上线前必须保持行为稳定的高风险路径。

本任务只做最小类型收口，不改变导入校验、跳过、创建、交易流水和审计行为。

## 目标

1. 为 preview 阶段客户手机号和车辆车牌查询结果补齐最小本地类型。
2. 明确构造 `Set<string>`，保持客户手机号和大写车牌去重逻辑不变。
3. 为 execute 阶段 Prisma transaction callback 标注 `Prisma.TransactionClient`。
4. 为 execute 阶段已有客户查询结果补齐 `id/phone` 最小类型，稳定 `phoneToIdMap` 构造。
5. 继续降低 `pnpm build:api` 历史严格模式错误数量，并把剩余错误留给后续窄任务处理。

## 范围

- `apps/api/src/tenant/data-import/data-import.service.ts`
- `docs/tasks-hardening/README.md`
- `docs/tasks-hardening/TASK-H-028.md`

## 非目标

- 不修改 Excel 模板字段、行级校验规则或错误文案。
- 不调整储值卡金额计算、交易流水写入或导入事务边界。
- 不修复 data-import 之外的 dispatch/print/reminder/report/stock 等 build 阻塞点。

## 验收命令

```bash
git diff --check -- apps/api/src/tenant/data-import/data-import.service.ts docs/tasks-hardening/TASK-H-028.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest src/tenant/data-import/data-import.service.spec.ts src/tenant/data-import/data-import.controller.spec.ts --runInBand
pnpm build:api
```

## 回执区域

- 修改文件：
  - `apps/api/src/tenant/data-import/data-import.service.ts`
  - `docs/tasks-hardening/README.md`
  - `docs/tasks-hardening/TASK-H-028.md`
- 实际执行命令：
  - `git diff --check -- apps/api/src/tenant/data-import/data-import.service.ts docs/tasks-hardening/TASK-H-028.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest src/tenant/data-import/data-import.service.spec.ts src/tenant/data-import/data-import.controller.spec.ts --runInBand`
  - `pnpm build:api`
- 测试结果：
  - `git diff --check -- ...` 通过，未发现 whitespace 问题。
  - `pnpm --filter @car/api exec jest src/tenant/data-import/data-import.service.spec.ts src/tenant/data-import/data-import.controller.spec.ts --runInBand` 通过（2 suites / 16 tests）。
  - `pnpm build:api` 仍失败，但 data-import 相关错误已消除；剩余 70 个错误从 `dispatch.service.ts` 等后续模块开始。
- 已知限制：
  - `pnpm build:api` 仍被后续历史严格模式错误阻塞，本任务已将首个阻塞点从 data-import 推进到 dispatch。
- 未完成项：
  - 继续按 build 输出拆分后续模块级类型收口任务。

## 审核区域

- 待审核。
