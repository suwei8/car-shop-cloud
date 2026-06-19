# TASK-H-035 储值卡 transaction 类型收口

## 背景

`TASK-H-034` 后，`pnpm build:api` 的首个剩余阻塞点推进到 `StoredValueCardService`：

- 售卡、充值、消费、退款四个 `$transaction` 回调参数缺少显式类型；
- 储值卡属于资金路径，所有余额变更必须同时写交易流水；
- 本任务只补 transaction client 类型，不改变余额拆分、消费扣减、退款限制或交易流水写入逻辑。

## 目标

1. 为储值卡服务引入 Prisma transaction 类型。
2. 为售卡、充值、消费、退款四个事务路径标注 `Prisma.TransactionClient`。
3. 保持本金/赠送余额拆分、余额校验、退款限制和交易流水写入语义不变。
4. 继续推进 API build 首个阻塞点，给 subscription/user/warranty/work-order 等后续模块让路。

## 范围

- `apps/api/src/tenant/stored-value-card/stored-value-card.service.ts`
- `docs/tasks-hardening/README.md`
- `docs/tasks-hardening/TASK-H-035.md`

## 非目标

- 不调整储值卡业务规则。
- 不改变金额计算或交易流水字段。
- 不处理 subscription/user/warranty/work-order 等后续 build 阻塞点。

## 验收命令

```bash
git diff --check -- apps/api/src/tenant/stored-value-card/stored-value-card.service.ts docs/tasks-hardening/TASK-H-035.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest src/tenant/stored-value-card/stored-value-card.service.spec.ts --runInBand
pnpm build:api
```

## 回执区域

- 修改文件：
  - `apps/api/src/tenant/stored-value-card/stored-value-card.service.ts`
  - `docs/tasks-hardening/README.md`
  - `docs/tasks-hardening/TASK-H-035.md`
- 实际执行命令：
  - `git diff --check -- apps/api/src/tenant/stored-value-card/stored-value-card.service.ts docs/tasks-hardening/TASK-H-035.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest src/tenant/stored-value-card/stored-value-card.service.spec.ts --runInBand`
  - `pnpm build:api`
- 测试结果：
  - `git diff --check -- ...` 通过，未发现 whitespace 问题。
  - `pnpm --filter @car/api exec jest src/tenant/stored-value-card/stored-value-card.service.spec.ts --runInBand` 通过（1 suite / 12 tests）。
  - `pnpm build:api` 仍失败，但 stored-value-card 相关 4 个错误已消除；剩余 13 个错误从 `subscription.service.ts` 等后续模块开始。
- 已知限制：
  - `pnpm build:api` 仍被 subscription/user/warranty/work-order 等后续历史严格模式错误阻塞，本任务已将首个阻塞点从 stored-value-card 推进到 subscription。
- 未完成项：
  - 继续按 build 输出处理 subscription/user/warranty/work-order 等后续模块。

## 审核区域

- 待审核。
