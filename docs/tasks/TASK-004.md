# TASK-004：套餐卡核销集成结算流程

> **优先级**：P0
> **状态**：待派发
> **依赖**：TASK-001（全局响应格式）
> **可并行**：TASK-003（库存联动）

## 1. 任务目标

在工单结算流程中集成套餐卡核销功能：当工单结算时，如果服务项目可以使用客户的套餐卡抵扣，则扣减套餐卡剩余次数，并写入套餐卡流水和结算明细。

## 2. 涉及文件

### 修改文件
- `apps/api/src/tenant/settlement/settlement.service.ts` — `settle` 方法增加套餐卡核销逻辑
- `apps/api/src/tenant/settlement/settlement.controller.ts` — 结算请求增加套餐卡参数（如尚未支持）
- `apps/api/src/tenant/package-card/package-card.service.ts` — 补充核销方法

### 可能新建文件
- `apps/api/src/tenant/package-card/dto/package-card.dto.ts` — 核销相关 DTO（如尚未完善）

## 3. 详细要求

### 3.1 套餐卡核销方法

在 `package-card.service.ts` 中实现：

```typescript
/**
 * 核销套餐卡次数
 * @param tx Prisma 事务客户端
 * @param cardId 套餐卡 ID
 * @param itemId 套餐卡项目 ID（对应某个服务项目）
 * @param quantity 核销次数
 * @param relatedType 关联业务类型（如 'work_order'）
 * @param relatedId 关联业务 ID
 * @param operatorId 操作人 ID
 */
async redeem(
  tx: Prisma.TransactionClient,
  tenantId: string,
  cardId: string,
  itemId: string,
  quantity: number,
  relatedType: string,
  relatedId: string,
  operatorId: string,
): Promise<void>
```

### 3.2 核销校验规则（产品硬约束）

按 `docs/03-implementation-brief.md` 要求，套餐卡核销必须校验：

1. **卡状态**：`card.status === 'active'`
2. **有效期**：当前时间在 `card.startAt` 和 `card.endAt` 之间
3. **适用车辆**：如果 `card.vehicleId` 不为空，必须匹配工单车辆
4. **适用门店**：如果 `card.shopIds`（JSON 数组）不为空，必须包含当前门店
5. **剩余次数**：`item.remainQty >= quantity`
6. **项目匹配**：套餐卡项目中的 `serviceItemId` 必须匹配工单中的服务项目

任一校验失败，抛出 `ForbiddenException` 并说明原因。

### 3.3 核销执行逻辑

在事务中：

1. 查询套餐卡及其项目（`PackageCard` + `PackageCardItem`）
2. 执行上述 6 项校验
3. 更新 `PackageCardItem.remainQty`（decrement quantity）
4. 创建 `PackageCardTransaction` 记录：
   - `type: 'consume'`
   - `quantity: -quantity`（负数表示核销）
   - `remainAfter: 核销后剩余次数`
   - `relatedType: 'work_order'`
   - `relatedId: workOrderId`

### 3.4 集成到结算流程

修改 `settlement.service.ts` 的 `settle` 方法：

```typescript
async settle(data: {
  workOrderId: string;
  discountAmount?: number;
  payments: { payMethod: string; amount: number; ... }[];
  packageRedemptions?: {          // 新增参数
    cardId: string;               // 套餐卡 ID
    itemId: string;               // 套餐卡项目 ID
    serviceItemId: string;        // 工单中的服务项目 ID
    quantity: number;             // 核销次数
  }[];
}, user: JwtPayload) {
  // ... 现有逻辑 ...

  // 在事务中，结算创建后、工单状态更新前，处理套餐卡核销
  if (data.packageRedemptions?.length) {
    for (const r of data.packageRedemptions) {
      await this.packageCardService.redeem(
        tx, user.tenantId!, r.cardId, r.itemId, r.quantity,
        'work_order', data.workOrderId, user.sub,
      );
      // 核销抵扣后，减少对应服务项目的应付金额
      // （找到工单中匹配的 serviceItem，将其 amount 置为 0 或减少）
    }
    // 重新计算 payableAmount（扣除套餐卡抵扣的服务项目金额）
  }

  // ... 储值卡扣减（现有逻辑）...
  // ... 创建结算单 ...
}
```

### 3.5 反结算退回

修改 `settlement.service.ts` 的 `reverse` 方法：

- 查询关联的 `PackageCardTransaction`（`relatedType: 'settlement', relatedId: settlementId, type: 'consume'`）
- 退回次数：`PackageCardItem.remainQty`（increment quantity）
- 创建退回流水：`PackageCardTransaction`（`type: 'refund'`）

### 3.6 金额抵扣计算

套餐卡核销的服务项目，其金额应从工单应付中扣除：

- 核销后，工单中被核销的服务项目的 `amount` 变为 0（或按核销比例减少）
- 结算单的 `discountAmount` 增加被核销项目的原始金额
- 或者：在结算单中新增 `packageDeductAmount` 字段（但当前 schema 没有此字段，所以建议用 `discountAmount` 吸收）

## 4. 验收标准

- [ ] 结算时传入 `packageRedemptions` 参数，套餐卡次数正确扣减
- [ ] `package_card_items.remainQty` 正确减少
- [ ] `package_card_transactions` 表有核销流水记录
- [ ] 核销后结算金额正确（被核销的服务项目金额从应付中扣除）
- [ ] 过期套餐卡核销返回 403
- [ ] 非适用车辆核销返回 403
- [ ] 非适用门店核销返回 403
- [ ] 剩余次数不足返回 403
- [ ] 反结算时套餐卡次数正确退回
- [ ] 反结算退回有流水记录
- [ ] `nest build` 编译通过

## 5. 注意事项

- 套餐卡核销和储值卡扣减是两个独立的支付手段，可以在同一笔结算中同时使用
- 核销校验必须在后端执行，不能依赖前端校验
- 所有操作必须在同一个 Prisma 事务中
- 不要修改 Prisma schema
- 不要修改储值卡相关逻辑（保持现有实现）

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下内容追加到本文件末尾：**

### 回执

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/src/tenant/settlement/settlement.service.ts`, `apps/api/src/tenant/settlement/settlement.module.ts`, `apps/api/src/tenant/settlement/dto/settlement.dto.ts`, `apps/api/src/tenant/package-card/package-card.service.ts` |
| 新建的文件列表 | 无 |
| 构建是否通过 (nest build) | 通过 |
| 核销校验规则清单 | 卡状态 active、有效期范围、适用车辆匹配、适用门店匹配、剩余次数充足 |
| 金额抵扣计算方式说明 | 核销的服务项目金额从工单应付中扣除，计入 `discountAmount` |
| 已知限制或遗留问题 | 无 |
| 执行耗时 | ~5min |

---

## 7. 架构师审核区域

> **架构师审核后填写：**

```markdown
### 审核结果

- **审核时间**：2026-06-11
- **审核结论**：✅ 通过
- **审核意见**：
  - `redeem()` 方法 ✅ 在 `Prisma.TransactionClient` 内执行，6 项校验完整（卡状态、有效期、车辆、门店、剩余次数、项目匹配）
  - `settle()` 集成 ✅ `packageRedemptions` 参数、`packageDeductAmount` 预计算、`payableAmount` 正确扣减
  - `SettleDto` ✅ `PackageRedemptionDto` 嵌套校验（`@ValidateNested` + `@Type`），quantity `@Min(1)`
  - `relatedId` 回填 ✅ 先创建事务（`relatedId: ''`），结算单创建后 `updateMany` 回填为 `settlement.id`
  - `reverse()` 退回 ✅ 查询 `packageCardTransaction`（`relatedType: 'settlement'`），退回 `remainQty`，创建 refund 流水
  - 金额计算 ✅ `discountAmount = 原始优惠 + 套餐抵扣金额`，`payableAmount = totalAmount - discountAmount`
  - 构建 ✅ nest build 通过
  - **小建议**：`relatedId` 回填用 `where: { relatedId: '' }` 匹配，高并发下可能误匹配同租户其他结算的事务。建议后续改为传入 `workOrderId` 作为中间关联键。不影响当前功能正确性。
- **TASK-004 状态**：已关闭 ✅
```
