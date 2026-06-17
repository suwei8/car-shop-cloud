# TASK-H-019 欠款与收款记录数据范围收口

## 背景

核心闭环要求小店能完成“完工 → 收款/欠款 → 老板看账”。`TASK-H-018` 已把老板首页指标按数据范围收口，但结算详情、收款记录、退款和结算入口自身也必须遵守同一套 `dataScope` 规则。

当前 `SettlementService.findAll()` 已对结算单列表应用 `applyDataScope()`，但以下路径仍只按 `tenantId` 查询：

- 结算单详情；
- 工单结算前的工单读取；
- 收款记录列表；
- 查询支付状态；
- 退款前结算单校验。

这些路径在多门店租户下可能造成跨门店查看、结算或退款风险。

## 目标

补齐结算/收款链路的数据范围约束：

- `dataScope='all'`：可访问全租户结算数据；
- `dataScope='shop'`：只能访问当前门店结算/收款数据；
- `dataScope='self'`：按操作人或负责人尽量收口；
- 平台管理员逻辑不在租户业务链路中放宽。

## 修改说明

### 1. 结算入口补齐工单范围校验

`settle()` 在读取待结算工单时改为使用：

```ts
applyDataScope(user, { id: data.workOrderId, tenantId }, 'shopId', 'advisorId')
```

避免用户结算不属于自己数据范围的工单。

### 2. 结算单详情/支付状态/退款补齐范围校验

以下方法读取结算单时统一应用：

```ts
applyDataScope(user, { id, tenantId }, 'shopId', 'operatorId')
```

覆盖：

- `findOne()`；
- `getPaymentStatus()`；
- `refundPayment()`。

### 3. 收款记录通过结算单范围过滤

`getPayments()` 查询 `Payment` 时增加结算单关联过滤：

```ts
settlement: { is: applyDataScope(user, { tenantId }, 'shopId', 'operatorId') }
```

确保收款记录与结算单门店/操作人范围一致。

### 4. 单测覆盖

补充 `SettlementService` 单测，断言：

- 结算入口按工单门店范围读取；
- 结算单列表/详情按门店范围读取；
- 收款记录通过结算单门店范围过滤；
- 退款前按门店范围校验结算单归属。

## 修改范围

- `apps/api/src/tenant/settlement/settlement.service.ts`
- `apps/api/src/tenant/settlement/settlement.service.spec.ts`
- `apps/api/src/tenant/package-card/package-card.service.ts`（补齐 settlement spec 依赖编译所需的显式 callback 类型）
- `apps/api/src/tenant/payment/payment-gateway.service.ts`（补齐 settlement spec 依赖编译所需的显式 callback 类型）
- `apps/api/src/tenant/marketing/marketing.service.ts`（补齐 settlement spec 依赖编译所需的显式 callback 类型）
- `docs/tasks-hardening/TASK-H-019.md`
- `docs/tasks-hardening/README.md`

## 验收命令

```bash
pnpm --filter @car/api exec jest src/tenant/settlement/settlement.service.spec.ts --runInBand
git diff --check
# 可选全量构建（当前仓库仍有多处历史 noImplicitAny/Prisma 类型问题需另开任务收口）
pnpm build:api
```

## 已知限制

- 本任务已通过结算服务单测验证数据范围收口。
- `pnpm build:api` 当前仍会暴露仓库内多处历史 TypeScript 严格模式问题，建议另开 `TASK-H-020` 专项收口，不与本业务链路修正混做。

## 回执区域

- 2026-06-17：已补齐结算、欠款、收款记录和退款入口的数据范围过滤，并补充对应单测。
