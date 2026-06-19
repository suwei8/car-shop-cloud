# TASK-H-034 库存服务 transaction 与出入库明细类型收口

## 背景

`TASK-H-033` 后，`pnpm build:api` 的首个剩余阻塞点推进到 `StockService`：

- 库存余额低库存过滤、工单配件项目筛选、出入库明细 `map(...)` callback 参数被推断为隐式 `any`；
- `stockIn`、`stockOutForWorkOrder` 的 `$transaction` callback 参数缺少显式类型；
- 库存是小程序核心闭环的一部分，且必须写库存流水，本任务必须只做最小类型收口，不改变库存扣减、回滚或流水写入逻辑。

## 目标

1. 为库存余额、工单配件行、库存单据明细补齐最小本地接口。
2. 为 `stockIn` 与 `stockOutForWorkOrder` transaction callback 标注 `Prisma.TransactionClient`。
3. 为低库存过滤、工单扣库存、事务内扣库存、作废回滚入库中的 `filter/map` callback 补齐显式类型。
4. 保持库存单据、库存余额、库存流水、负库存标记和工单作废回滚逻辑不变。

## 范围

- `apps/api/src/tenant/stock/stock.service.ts`
- `docs/tasks-hardening/README.md`
- `docs/tasks-hardening/TASK-H-034.md`

## 非目标

- 不调整库存业务规则。
- 不改变库存流水或审计写入语义。
- 不处理 stored-value-card/subscription/user/warranty/work-order 等后续 build 阻塞点。

## 验收命令

```bash
git diff --check -- apps/api/src/tenant/stock/stock.service.ts docs/tasks-hardening/TASK-H-034.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest src/tenant/stock/stock.service.spec.ts --runInBand
pnpm build:api
```

## 回执区域

- 修改文件：
  - `apps/api/src/tenant/stock/stock.service.ts`
  - `docs/tasks-hardening/README.md`
  - `docs/tasks-hardening/TASK-H-034.md`
- 实际执行命令：
  - `git diff --check -- apps/api/src/tenant/stock/stock.service.ts docs/tasks-hardening/TASK-H-034.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest src/tenant/stock/stock.service.spec.ts --runInBand`
  - `pnpm build:api`
- 测试结果：
  - `git diff --check -- ...` 通过，未发现 whitespace 问题。
  - `pnpm --filter @car/api exec jest src/tenant/stock/stock.service.spec.ts --runInBand` 通过（1 suite / 13 tests）。
  - `pnpm build:api` 仍失败，但 stock 相关 8 个错误已消除；剩余 17 个错误从 `stored-value-card.service.ts` 等后续模块开始。
- 已知限制：
  - `pnpm build:api` 仍被 stored-value-card/subscription/user/warranty/work-order 等后续历史严格模式错误阻塞，本任务已将首个阻塞点从 stock 推进到 stored-value-card。
- 未完成项：
  - 继续按 build 输出处理 stored-value-card/subscription/user/warranty/work-order 等后续模块。

## 审核区域

- 待审核。
