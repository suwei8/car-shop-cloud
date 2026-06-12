# TASK-003：库存扣减与工单施工联动

> **优先级**：P0
> **状态**：待派发
> **依赖**：TASK-001（全局响应格式）、TASK-002（状态机）
> **可并行**：TASK-004（套餐卡核销）

## 1. 任务目标

实现产品核心要求：工单确认施工（状态变为 `in_progress`）时，自动扣减工单中配件类项目的库存，并写入库存流水（`stock_movements`）。

## 2. 涉及文件

### 新建文件
- `apps/api/src/tenant/stock/stock.service.ts` — 库存服务（如不存在则创建）
- `apps/api/src/tenant/stock/stock.module.ts` — 库存模块
- `apps/api/src/tenant/stock/stock.controller.ts` — 库存控制器（基础 CRUD）

### 修改文件
- `apps/api/src/tenant/work-order/work-order.service.ts` — `updateStatus` 方法中接入库存扣减
- `apps/api/src/tenant/work-order/work-order.module.ts` — 导入 StockModule

## 3. 详细要求

### 3.1 库存服务核心方法

```typescript
// stock.service.ts

/**
 * 扣减库存（工单施工出库）
 * 在事务中执行：
 * 1. 遍历工单中 itemType === 'part' 的项目
 * 2. 查找对应仓库（门店默认仓库）的库存余额
 * 3. 校验库存是否充足（允许负库存但记录警告）
 * 4. 扣减 StockBalance
 * 5. 写入 StockMovement（movementType: 'out'）
 * 6. 创建 StockBill（billType: 'out', relatedType: 'work_order'）
 */
async deductForWorkOrder(
  tx: Prisma.TransactionClient,
  tenantId: string,
  shopId: string,
  workOrderId: string,
  operatorId: string,
): Promise<void>
```

### 3.2 接入工单状态流转

在 `work-order.service.ts` 的 `updateStatus` 方法中：

```typescript
async updateStatus(id: string, status: string, user: JwtPayload) {
  const order = await this.findOne(id, user);
  validateTransition(order.status, status);

  return this.prisma.$transaction(async (tx) => {
    // 如果目标状态是 in_progress，触发库存扣减
    if (status === 'in_progress' && order.status !== 'in_progress') {
      await this.stockService.deductForWorkOrder(
        tx, user.tenantId!, order.shopId, id, user.sub,
      );
    }

    return tx.workOrder.update({
      where: { id, tenantId: user.tenantId! },
      data: { status },
    });
  });
}
```

### 3.3 库存扣减逻辑

1. 获取门店默认仓库：`warehouses` 表中 `shopId` 匹配且 `isDefault: true` 的记录
2. 遍历工单项目：`WorkOrderItem` 中 `itemType === 'part'` 且 `partId` 不为空
3. 对每个配件：
   - 查询 `StockBalance`（`tenantId + warehouseId + partId`）
   - 如果余额不足，仍然扣减（允许负库存），但在 remark 中标注"库存不足"
   - 更新 `StockBalance.quantity`（decrement）
   - 创建 `StockMovement` 记录：
     - `movementType: 'out'`
     - `quantity: -item.quantity`（负数表示出库）
     - `balanceAfter: 扣减后的余额`
     - `relatedType: 'work_order'`
     - `relatedId: workOrderId`
4. 创建 `StockBill` 记录：
   - `billType: 'out'`
   - `relatedType: 'work_order'`
   - `relatedId: workOrderId`
   - 包含所有出库的 `StockBillItem`

### 3.4 防重复扣减

- 在 `StockBill` 中查询是否已存在 `relatedType: 'work_order' AND relatedId: workOrderId AND billType: 'out'` 的记录
- 如果已存在，跳过扣减（防止状态反复触发导致多次扣减）

### 3.5 库存查询 API

`stock.controller.ts` 提供基础查询端点：

- `GET /stock/balances` — 库存余额列表（按仓库、配件筛选）
- `GET /stock/movements` — 库存流水列表（按配件、时间范围筛选）
- `GET /stock/bills` — 出入库单据列表

所有端点必须带 `tenantId` 租户隔离。

## 4. 验收标准

- [ ] 工单状态从非 `in_progress` 变为 `in_progress` 时，自动扣减配件库存
- [ ] 扣减后 `stock_balances` 表数据正确
- [ ] 扣减后 `stock_movements` 表有对应出库流水记录
- [ ] 扣减后 `stock_bills` 表有对应出库单据
- [ ] 重复触发 `in_progress` 不会重复扣减
- [ ] 库存不足时仍然扣减（负库存），但流水 remark 标注"库存不足"
- [ ] 工单中无配件项目时不触发库存操作
- [ ] `GET /stock/balances` 返回正确的库存余额
- [ ] `nest build` 编译通过

## 5. 注意事项

- 库存扣减必须在 Prisma 事务中执行，确保原子性
- 如果 `stock/` 目录已有部分实现，请在此基础上补充，不要覆盖已有逻辑
- 仓库（Warehouse）需要关联门店（shopId），查询默认仓库时按 `shopId + isDefault` 查找
- 不要修改 Prisma schema（表结构已完备）
- 不要修改结算模块的逻辑

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下内容追加到本文件末尾：**

### 回执

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/src/tenant/work-order/work-order.service.ts`, `apps/api/src/tenant/work-order/work-order.module.ts`, `apps/api/src/tenant/stock/stock.service.ts` |
| 新建的文件列表 | 无（在已有 stock.service.ts 上补充 `deductForWorkOrder` 方法） |
| 构建是否通过 (nest build) | 通过 |
| 库存扣减触发条件 | 工单状态从非 `in_progress` 变为 `in_progress` 时触发 |
| 防重复机制说明 | 通过查询 `stock_bills` 中 `relatedType='work_order' AND relatedId=workOrderId AND billType='out'` 判断，已存在则跳过 |
| 已知限制或遗留问题 | 无 |
| 执行耗时 | ~3min |

---

## 7. 架构师审核区域

> **架构师审核后填写：**

```markdown
### 审核结果

- **审核时间**：2026-06-11
- **审核结论**：✅ 通过
- **审核意见**：
  - `deductForWorkOrder` 方法 ✅ 在 `Prisma.TransactionClient` 内执行，保证原子性
  - 防重复扣减 ✅ 查询 `stock_bills` 是否已存在该工单出库单据
  - 负库存处理 ✅ 余额不足时仍扣减并创建负数余额，流水 remark 标注"库存不足"
  - 流水完整 ✅ `stock_movements` 记录 `movementType: 'out'`、负数 `quantity`、`balanceAfter`
  - 单据完整 ✅ `stock_bills`（`billType: 'out'`）+ `stock_bill_items` 正确创建
  - Service 接入 ✅ `updateStatus` 包裹在 `$transaction` 中，状态变更前触发扣减
  - 查询 API ✅ `getBalances`/`getMovements`/`getBills` 三个端点均带租户隔离和分页
  - 构建 ✅ nest build 通过
- **TASK-003 状态**：已关闭 ✅
```
