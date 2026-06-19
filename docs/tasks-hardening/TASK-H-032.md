# TASK-H-032 报表服务聚合与映射类型收口

## 背景

`TASK-H-031` 后，`pnpm build:api` 的首个剩余阻塞点推进到 `ReportService`：

- 营业日报中工单/收款 groupBy 结果的 `map/reduce` callback 参数被推断为隐式 `any`；
- 技师产值、库存预警、客户统计、储值余额、套餐核销报表中多处 `map/filter/sort/reduce` callback 参数被推断为隐式 `any`；
- 报表服务属于只读统计与导出路径，必须保持统计口径、金额转换和导出字段不变，仅做最小类型收口。

## 目标

1. 为日报 groupBy 结果、技师、任务、金额记录补齐最小本地接口。
2. 为库存预警、客户排行、储值卡余额和套餐卡核销流水补齐最小查询结果类型。
3. 为所有 build 报错的 `map/filter/sort/reduce` callback 参数补齐显式类型。
4. 保持所有报表返回结构、排序方式、金额 `Number(...)` 转换和 Excel 导出逻辑不变。

## 范围

- `apps/api/src/tenant/report/report.service.ts`
- `docs/tasks-hardening/README.md`
- `docs/tasks-hardening/TASK-H-032.md`

## 非目标

- 不调整报表统计口径。
- 不新增报表接口或导出字段。
- 不处理 role/stock/stored-value-card 等后续 build 阻塞点。

## 验收命令

```bash
git diff --check -- apps/api/src/tenant/report/report.service.ts docs/tasks-hardening/TASK-H-032.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest src/tenant/report/report-export.service.spec.ts --runInBand
pnpm build:api
```

## 回执区域

- 修改文件：
  - `apps/api/src/tenant/report/report.service.ts`
  - `docs/tasks-hardening/README.md`
  - `docs/tasks-hardening/TASK-H-032.md`
- 实际执行命令：
  - `git diff --check -- apps/api/src/tenant/report/report.service.ts docs/tasks-hardening/TASK-H-032.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest src/tenant/report/report-export.service.spec.ts --runInBand`
  - `pnpm build:api`
- 测试结果：
  - `git diff --check -- ...` 通过，未发现 whitespace 问题。
  - `pnpm --filter @car/api exec jest src/tenant/report/report-export.service.spec.ts --runInBand` 通过（1 suite / 4 tests）。
  - `pnpm build:api` 仍失败，但 report 相关 26 个错误已消除；剩余 27 个错误从 `role.service.ts`、`stock.service.ts` 等后续模块开始。
- 已知限制：
  - `pnpm build:api` 仍被 role/stock/stored-value-card 等后续历史严格模式错误阻塞，本任务已将首个阻塞点从 report 推进到 role。
- 未完成项：
  - 继续按 build 输出处理 role/stock/stored-value-card/subscription/user/warranty/work-order 等后续模块。

## 审核区域

- 待审核。
