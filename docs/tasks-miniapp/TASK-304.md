# TASK-304 — 单店版数据正确性补齐（工单作废回滚库存 + 质保追溯 + 首页欠款）

> 优先级：P0　依赖：无（可与 301/302 并行）
> 关联方案：`docs/08-miniprogram-first-product-plan.md` 第 6.1/6.3/9 节

## 1. 背景（来自代码核查的确认缺口）

1. **工单作废不回滚库存**：状态机允许任意状态转 `cancelled`，但 `work-order.service.ts` 的 `updateStatus()` 作废时**未回滚已扣减库存**，导致库存越用越不准。
2. **质保追溯不完整**：`Part.warrantyMonths` 存在（schema 第 635 行），但 `WorkOrderItem`（schema 第 553-579 行附近）**未快照供应商/质保截止**，无法回答「上次换的件还在保吗」。
3. **首页缺欠款统计**：`Settlement` 有 `debtAmount`，但 `dashboard.service.ts` 的 `getOverview()` 未计算欠款总额。

参考文件：
- `apps/api/src/tenant/work-order/work-order.service.ts`（扣库存约 124-138；`updateStatus`）
- `apps/api/src/tenant/work-order/work-order.state-machine.ts`
- `apps/api/src/tenant/stock/stock.service.ts`（出库约 186-275，已有「防重复扣减」检查 `relatedType='work_order'`）
- `apps/api/prisma/schema.prisma`（`Part` 627-655、`WorkOrderItem` 553-579、`Settlement`）
- `apps/api/src/tenant/dashboard/dashboard.service.ts`（`getOverview` 9-66）

## 2. 详细要求

### 2.1 工单作废回滚库存
- 工单转 `cancelled` 时，查找该工单已生成的出库流水（`relatedType='work_order'`、`relatedId=工单id`），生成**反向入库流水**回滚库存；
- 必须写库存流水（符合硬约束，可追溯）；
- 幂等：重复作废/已回滚不得重复回滚；
- 已结算（`settled`）工单的处理遵循现有终态规则，不得绕过「已结算不可直接改」约束；若作废与结算冲突，按现有业务规则处理并在回执说明。

### 2.2 质保追溯补全
- `WorkOrderItem` 增加快照字段：`supplierId`（快照）、`warrantyMonths`（快照）、`warrantyUntil`（按完工日期 + 质保月数计算的截止日期）；
- 工单使用配件并完工/扣库存时写入上述快照（以「当时」的供应商与质保为准，后续改配件档案不影响历史）；
- 提供查询：按车辆/客户列出已换配件及其质保截止与「是否在保」（供小程序客户页 TASK-303 使用）；
- 生成迁移（本机/测试库执行）。

### 2.3 首页欠款统计
- `dashboard.service.ts` 的 `getOverview()` 增加：客户欠款总额（`Settlement.debtAmount` 聚合）、欠款笔数；
- 租户隔离与数据权限沿用现有 `applyDataScope`。

## 3. 约束
- 严守租户隔离、金额 Decimal、库存/资金写流水；
- 迁移仅在本机/测试库执行，严禁生产库；
- 不破坏现有结算/扣库存测试。

## 4. 验收标准
- [ ] 作废工单后库存被正确回滚且写流水；重复作废不重复回滚（附测试）；
- [ ] `WorkOrderItem` 新增质保快照字段并在用料时写入；可查询车辆/客户的在保情况；
- [ ] Dashboard `getOverview` 返回欠款总额与笔数；
- [ ] 新增迁移仅涉及相关表；`prisma validate` 通过；
- [ ] `pnpm build:api` 与测试通过；
- [ ] **必填验证**：构造「开单用料→完工扣库存→作废→库存回滚」与「完工后查询该车配件在保状态」两条用例，过程写入回执。

### 验证命令
```bash
cd /home/sw/dev_root/car
pnpm build:api
pnpm --filter @car/api test
```

## 5. 回执区域（执行 Agent 填写）
### 5.1 执行摘要
- 执行人 / 时间 / 结论：
### 5.2 修改文件清单
| 文件 | 操作 | 说明 |
|------|------|------|
| | | |
### 5.3 验收结果
| 检查项 | 结果 | 证据 |
|--------|------|------|
| 作废回滚库存(+幂等) | | |
| 质保快照与查询 | | |
| 首页欠款统计 | | |
| 迁移 | | |
| build/test | | |
| 端到端两用例(必填) | | |
### 5.4 遗留问题
-

## 6. 派发词
```text
你是车店云管家项目的执行 Agent。请完成 TASK-304（单店版数据正确性补齐）。
工作目录：/home/sw/dev_root/car　任务书：docs/tasks-miniapp/TASK-304.md
1. 先读 AGENTS.md。本任务修三处缺口：①工单作废回滚库存(写流水+幂等)；②WorkOrderItem 增加供应商/质保月数/质保截止快照并在用料时写入，提供按车辆/客户的在保查询；③Dashboard getOverview 增加欠款总额与笔数。
2. 严守租户隔离/金额Decimal/库存资金写流水/已结算不可直接改；迁移只在本机库执行。
3. 构造「用料→完工扣库存→作废→回滚」与「在保查询」用例并写入回执(必填)。确保 build:api 与测试通过。
4. 回执填入任务书第 5 节，勿改其他章节。完成后停止等待审核。
```
