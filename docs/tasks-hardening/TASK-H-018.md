# TASK-H-018 老板首页指标数据范围收口

## 背景

当前产品方向把“老板看账”列为核心价值点：老板需要在工作台看到今日收入、今日工单、施工中工单、欠款、库存预警和提醒待办。

`DashboardService.getOverview()` 已返回这些指标，但除欠款统计外，多数查询只按 `tenantId` 过滤。对于多门店租户或 `dataScope='shop'/'self'` 用户，这会导致小程序首页展示超出当前用户数据范围的经营指标。

## 目标

让老板首页相关接口遵守统一数据范围：

- `dataScope='all'`：可看全租户；
- `dataScope='shop'`：只看当前 `shopId`；
- `dataScope='self'`：工单/派工/欠款等尽量按负责人或操作人过滤；
- 平台管理员仍走平台概览逻辑。

## 修改说明

### 1. 工作台概览补齐数据范围

对以下指标补齐范围过滤：

- 今日工单；
- 今日收入；
- 施工中工单；
- 今日预约；
- 待派工；
- 库存预警；
- 今日提醒；
- 欠款统计。

其中：

- 工单指标使用 `shopId` / `advisorId`；
- 预约和提醒使用 `shopId`；
- 派工使用关联工单的 `shopId` 或 `technicianId`；
- 库存预警使用仓库关联门店；
- 收入通过支付关联结算单的 `shopId` / `operatorId` 过滤。

### 2. 最近工单与今日预约补齐数据范围

- `getRecentOrders()` 改为使用 `applyDataScope(user, ..., 'shopId', 'advisorId')`；
- `getTodayAppointments()` 改为使用 `applyDataScope(user, ..., 'shopId')`。

### 3. 单测覆盖

补充 dashboard service 单测，断言：

- 门店级用户的今日工单、施工中工单、收入和库存预警查询都带上门店范围；
- 最近工单和今日预约接口也带上门店范围。

## 修改范围

- `apps/api/src/tenant/dashboard/dashboard.service.ts`
- `apps/api/src/tenant/dashboard/dashboard.service.spec.ts`
- `docs/tasks-hardening/TASK-H-018.md`
- `docs/tasks-hardening/README.md`

## 验收命令

```bash
pnpm --filter @car/api exec jest src/tenant/dashboard/dashboard.service.spec.ts --runInBand
pnpm build:api
git diff --check
```

## 回执区域

- 2026-06-17：已补齐老板首页 dashboard 指标的数据范围过滤，并补充对应单测。
