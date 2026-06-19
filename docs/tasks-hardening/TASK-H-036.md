# TASK-H-036 订阅套餐与订单类型收口

## 背景

`TASK-H-035` 后，`pnpm build:api` 的首个剩余阻塞点推进到 `SubscriptionService`：

- 套餐列表 `plans.map(...)` 和订单历史 `items.map(...)` callback 参数被推断为隐式 `any`；
- 支付回调中的 `$transaction` callback 参数缺少显式类型；
- 订阅续费是 SaaS 收费闭环，本任务只补类型，不改变套餐折扣、订单历史格式、支付回调幂等和租户订阅激活逻辑。

## 目标

1. 为套餐列表和订阅订单历史补齐最小本地接口。
2. 为套餐价格/折扣展示和订单金额字符串化的 map callback 补齐显式类型。
3. 为订阅支付回调 transaction 标注 `Prisma.TransactionClient`。
4. 保持订单创建、支付、回调验额、订阅激活和审计日志逻辑不变。

## 范围

- `apps/api/src/tenant/subscription/subscription.service.ts`
- `docs/tasks-hardening/README.md`
- `docs/tasks-hardening/TASK-H-036.md`

## 非目标

- 不调整套餐折扣或续费规则。
- 不改变支付网关或回调幂等语义。
- 不处理 user/warranty/work-order 等后续 build 阻塞点。

## 验收命令

```bash
git diff --check -- apps/api/src/tenant/subscription/subscription.service.ts docs/tasks-hardening/TASK-H-036.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest src/tenant/subscription/subscription.service.spec.ts --runInBand
pnpm build:api
```

## 回执区域

- 修改文件：
  - `apps/api/src/tenant/subscription/subscription.service.ts`
  - `docs/tasks-hardening/README.md`
  - `docs/tasks-hardening/TASK-H-036.md`
- 实际执行命令：
  - `git diff --check -- apps/api/src/tenant/subscription/subscription.service.ts docs/tasks-hardening/TASK-H-036.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest src/tenant/subscription/subscription.service.spec.ts --runInBand`
  - `pnpm build:api`
- 测试结果：
  - `git diff --check -- ...` 通过，未发现 whitespace 问题。
  - `pnpm --filter @car/api exec jest src/tenant/subscription/subscription.service.spec.ts --runInBand` 通过（1 suite / 15 tests）。
  - `pnpm build:api` 仍失败，但 subscription 相关 3 个错误已消除；剩余 10 个错误从 `user.service.ts` 等后续模块开始。
- 已知限制：
  - `pnpm build:api` 仍被 user/warranty/work-order 等后续历史严格模式错误阻塞，本任务已将首个阻塞点从 subscription 推进到 user。
- 未完成项：
  - 继续按 build 输出处理 user/warranty/work-order 等后续模块。

## 审核区域

- 待审核。
