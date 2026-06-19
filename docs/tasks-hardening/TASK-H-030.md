# TASK-H-030 打印数据映射类型收口

## 背景

`TASK-H-029` 后，`pnpm build:api` 的首个剩余阻塞点推进到 `PrintService`：

- 工单打印数据中 `order.items.map(...)` 和 `order.inspections.map(...)` 回调参数被推断为隐式 `any`；
- 结算单打印数据中 `workOrder.items.map(...)` 和 `settlement.payments.map(...)` 回调参数被推断为隐式 `any`；
- 打印服务属于只读展示路径，适合通过最小本地接口收口类型，不改变返回结构和金额展示逻辑。

## 目标

1. 为打印用工单项目、检查项、支付记录补齐最小本地接口。
2. 为工单打印和结算单打印的 map callback 参数补齐显式类型。
3. 保持打印接口返回字段、金额 `Number(...)` 转换和支付方式文案映射不变。
4. 继续推进 API build 首个阻塞点，给后续 reminder/report/stock 类型收口让路。

## 范围

- `apps/api/src/tenant/print/print.service.ts`
- `docs/tasks-hardening/README.md`
- `docs/tasks-hardening/TASK-H-030.md`

## 非目标

- 不调整打印模板字段。
- 不新增打印接口或权限逻辑。
- 不处理 reminder/report/stock 等后续 build 阻塞点。

## 验收命令

```bash
git diff --check -- apps/api/src/tenant/print/print.service.ts docs/tasks-hardening/TASK-H-030.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest --listTests | rg 'print'
pnpm build:api
```

## 回执区域

- 修改文件：
  - `apps/api/src/tenant/print/print.service.ts`
  - `docs/tasks-hardening/README.md`
  - `docs/tasks-hardening/TASK-H-030.md`
- 实际执行命令：
  - `git diff --check -- apps/api/src/tenant/print/print.service.ts docs/tasks-hardening/TASK-H-030.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest --listTests | rg 'print'`
  - `pnpm build:api`
- 测试结果：
  - `git diff --check -- ...` 通过，未发现 whitespace 问题。
  - `pnpm --filter @car/api exec jest --listTests | rg 'print'` 未找到 print 专属 Jest spec（命令退出 1，无输出）。
  - `pnpm build:api` 仍失败，但 print 相关 4 个错误已消除；剩余 62 个错误从 `reminder-task.service.ts` 等后续模块开始。
- 已知限制：
  - 当前仓库未发现 print 专属 Jest spec；本任务已通过 build 输出确认 print 错误消除。
- 未完成项：
  - 继续按 build 输出处理 reminder/report/stock 等后续模块。

## 审核区域

- 待审核。
