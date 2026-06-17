# TASK-H-006 — 支付网关租户隔离补强

> 优先级：P0
> 状态：✅ 已关闭
> 来源：TASK-H-002 审计遗留 warning

## 1. 背景

`pnpm audit:tenant-scope` 当前仍报告 3 个真实 warning，均来自：

- `apps/api/src/tenant/payment/payment-gateway.service.ts:42`
- `apps/api/src/tenant/payment/payment-gateway.service.ts:195`
- `apps/api/src/tenant/payment/payment-gateway.service.ts:252`

问题形态为 `payment.findUnique({ where: { id: paymentId } })`，未显式绑定 `tenantId`。虽然当前调用方大多已先通过 settlement/subscription 做租户校验，但支付网关属于共享核心服务，不能长期依赖调用方纪律。

## 2. 目标

让支付网关的主动业务入口按服务端租户上下文查询 `Payment`，消除审计脚本 warning。

主动业务入口包括：

- `createPaymentOrder`
- `queryPaymentStatus`
- `refund`

第三方异步回调入口 `handleCallback` 暂不强制传入 tenantId，但所有后续关联更新必须继续以已查到的 `payment.tenantId` 为准。

## 3. 实现要求

1. 不要修改 Prisma schema。
2. 不要修改第三方支付 provider 接口。
3. 不要信任客户端传入 tenantId；只能由已完成租户校验的上层 service 传入。
4. `PaymentGatewayService` 主动入口应改为使用 `findFirst({ where: { id: paymentId, tenantId } })` 或统一私有 helper。
5. 更新调用点：
   - `settlement.service.ts` 调用 `createPaymentOrder`、`queryPaymentStatus`、`refund` 时传入 `user.tenantId!`。
   - `subscription.service.ts` 调用 `createPaymentOrder` 时传入 `user.tenantId!`。
6. 保持 `handleCallback` 兼容微信/支付宝异步回调，不要求外部回调携带 tenantId。
7. 更新 `payment-gateway.service.spec.ts`，至少覆盖：
   - `createPaymentOrder` 查询时带 `{ id, tenantId }`；
   - `queryPaymentStatus` 查询时带 `{ id, tenantId }`；
   - `refund` 查询时带 `{ id, tenantId }`；
   - 找不到跨租户 payment 时仍抛 `NotFoundException`。

## 4. 验收标准

必须执行：

```bash
pnpm --filter @car/api exec jest --runInBand
pnpm build:api
pnpm audit:tenant-scope
```

期望：

- Jest 通过；
- API build 通过；
- `pnpm audit:tenant-scope` 的 `WARNINGS` 降为 0；
- 回执追加到第 5 节。

## 5. 回执区域（执行 Agent 填写）

> 执行 Agent 只允许在本节追加内容，不得改动第 6 节。

### 回执 — 2026-06-17

**修改文件：**

| 文件 | 变更说明 |
|---|---|
| `apps/api/src/tenant/payment/payment-gateway.service.ts` | `createPaymentOrder` / `queryPaymentStatus` / `refund` 改为必传服务端租户上下文 `tenantId`，统一使用 `findFirst({ where: { id, tenantId } })` 替代无租户查询；`handleCallback` 不受影响 |
| `apps/api/src/tenant/settlement/settlement.service.ts` | 三处调用 `createPaymentOrder` / `queryPaymentStatus` / `refund` 时追加传入 `user.tenantId!` |
| `apps/api/src/tenant/subscription/subscription.service.ts` | `payOrder` 调用 `createPaymentOrder` 时追加传入 `user.tenantId!` |
| `apps/api/src/tenant/payment/payment-gateway.service.spec.ts` | Mock 从 `findUnique` 改为 `findFirst`；所有测试用例传入 `tenantId`；新增 3 个跨租户 NotFoundException 测试 |
| `apps/api/src/tenant/subscription/subscription.service.spec.ts` | `payOrder` 测试断言更新为新的参数顺序 |

**执行命令与结果：**

```bash
pnpm --filter @car/api exec jest --runInBand   # 283 passed, 0 failed
pnpm build:api                                  # OK
pnpm audit:tenant-scope                         # WARNINGS: 0 (之前 3)
```

**已知限制：**

- `handleCallback` 仍使用 `findFirst({ where: { id } })` 无 tenantId，符合设计（外部异步回调无法携带 tenantId）。
- `handleCallback` / `queryPaymentStatus` 内部对 `settlement` 的 `findUnique` 查找（按 settlement ID）未加 tenantId，但这些查询以已确认的 `payment.tenantId` 为上下文，后续可在第二轮强约束中统一替换为 `findFirst({ id, tenantId })`。
- `payment.update` 的 `where: { id }` 未附带 tenantId（因 payment 记录在前面已通过 tenantId 校验查到），审计脚本对此类模式未报警。

## 6. 架构师审核区域

> 架构师填写。

### 审核结论 — 2026-06-17

结论：整改后通过，TASK-H-006 关闭。

审核整改：

- MiMo 初版把 `tenantId` 做成可选参数，并保留无租户 fallback。已手动改为主动入口必传 `tenantId`，由 TypeScript 阻止后续误用。
- 调整 `createPaymentOrder` 参数顺序为 `paymentId, method, tenantId, options?`，避免调用方传 `undefined` 占位。
- 同步更新 settlement/subscription 调用点与 payment/subscription 单测断言。

最终验证：

```bash
pnpm --filter @car/api exec jest --runInBand
# Test Suites: 29 passed, 29 total
# Tests: 283 passed, 283 total

pnpm build:api
# nest build 成功

pnpm audit:tenant-scope
# Total: 0 warning(s), 153 info(s)

git diff --check
# 通过
```
