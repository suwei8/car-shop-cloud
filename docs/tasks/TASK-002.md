# TASK-002：工单状态机实现

> **优先级**：P0
> **状态**：待派发
> **依赖**：TASK-001（全局响应格式）
> **可并行**：TASK-005（数据权限）

## 1. 任务目标

为工单模块实现严格的状态流转校验，确保工单只能按照产品定义的状态机进行流转，拒绝非法状态跳转。

## 2. 涉及文件

### 新建文件
- `apps/api/src/tenant/work-order/work-order.state-machine.ts` — 状态机定义与校验逻辑

### 修改文件
- `apps/api/src/tenant/work-order/work-order.service.ts` — `updateStatus` 方法接入状态机校验

## 3. 详细要求

### 3.1 状态机定义

根据产品文档 `docs/01-product-plan.md` 第 126-144 行，工单合法状态流转如下：

```
draft (草稿)
  └→ confirmed (已确认/待派工)
       └→ dispatching (派工中)
            └→ in_progress (施工中)
                 └→ completed (已完成/待结算)
                      └→ settled (已结算)
                           └→ handed_over (已交车)

任何状态 → cancelled (已作废)  [仅限未结算的工单]
```

**合法流转表**（代码中用 Map 或对象定义）：

```typescript
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:        ['confirmed', 'cancelled'],
  confirmed:    ['dispatching', 'cancelled'],
  dispatching:  ['in_progress', 'cancelled'],
  in_progress:  ['completed', 'cancelled'],
  completed:    ['settled', 'cancelled'],
  settled:      ['handed_over'],
  handed_over:  [],
  cancelled:    [],
};
```

### 3.2 校验逻辑

```typescript
// work-order.state-machine.ts
export function validateTransition(currentStatus: string, targetStatus: string): void {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed) {
    throw new BadRequestException(`未知工单状态: ${currentStatus}`);
  }
  if (!allowed.includes(targetStatus)) {
    throw new BadRequestException(
      `不允许从「${statusLabel(currentStatus)}」流转到「${statusLabel(targetStatus)}」，` +
      `允许的目标状态: ${allowed.map(statusLabel).join('、') || '无'}`
    );
  }
}

export function statusLabel(status: string): string {
  // 返回中文标签
}
```

### 3.3 接入 Service

修改 `work-order.service.ts` 的 `updateStatus` 方法：

```typescript
async updateStatus(id: string, status: string, user: JwtPayload) {
  const order = await this.findOne(id, user);  // 已有方法，会校验 tenantId
  validateTransition(order.status, status);    // 新增：状态机校验
  return this.prisma.workOrder.update({
    where: { id, tenantId: user.tenantId! },
    data: { status },
  });
}
```

### 3.4 状态标签映射

```typescript
const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  confirmed: '已确认',
  dispatching: '派工中',
  in_progress: '施工中',
  completed: '已完成',
  settled: '已结算',
  handed_over: '已交车',
  cancelled: '已作废',
};
```

## 4. 验收标准

- [ ] `PUT /work-orders/:id/status` 传入非法状态跳转时返回 400 并提示允许的目标状态
- [ ] 合法状态跳转正常工作（如 draft → confirmed）
- [ ] 已结算工单 (settled) 不能回退到 draft 或其他非 handed_over 状态
- [ ] 已作废工单 (cancelled) 不能跳转到任何状态
- [ ] 已交车工单 (handed_over) 不能跳转到任何状态
- [ ] `nest build` 编译通过
- [ ] 不影响现有工单创建、列表、详情等功能

## 5. 注意事项

- 当前代码中工单状态值可能与产品文档有差异（如缺少 `dispatching`、`handed_over`），需要以 schema.prisma 和现有代码中实际使用的状态值为准进行适配
- 如果现有代码中没有 `dispatching` 和 `handed_over` 状态，可以先按现有状态值定义流转表，在注释中标注后续需要补充的状态
- 不要修改 Prisma schema
- 不要修改工单创建逻辑

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下内容追加到本文件末尾：**

### 回执

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/src/tenant/work-order/work-order.service.ts` |
| 新建的文件列表 | `apps/api/src/tenant/work-order/work-order.state-machine.ts` |
| 构建是否通过 (nest build) | 通过 |
| 最终定义的状态流转表 | `draft → [quoted, confirmed, cancelled]`, `quoted → [confirmed, cancelled]`, `confirmed → [dispatching, cancelled]`, `dispatching → [in_progress, cancelled]`, `in_progress → [completed, cancelled]`, `completed → [settled, cancelled]`, `settled → []`, `cancelled → []` |
| 已知限制或遗留问题 | `settled` 无后续状态（`handed_over` 未在 schema.prisma 中定义，待后续补充） |
| 执行耗时 | ~2min |

---

## 7. 架构师审核区域

> **架构师审核后填写：**

```markdown
### 审核结果

- **审核时间**：2026-06-11
- **审核结论**：✅ 通过
- **审核意见**：
  - 状态机模块 ✅ `ALLOWED_TRANSITIONS` 覆盖 8 个状态，含 `quoted` 和 `dispatching`
  - 校验逻辑 ✅ 非法跳转抛出 `BadRequestException`，提示允许的目标状态
  - Service 接入 ✅ `updateStatus` 先 `findOne` 再 `validateTransition` 再 update
  - 终态处理 ✅ `settled` 和 `cancelled` 为空数组，不可再流转
  - 已知限制 ✅ `handed_over` 未在 schema 中定义，合理跳过
  - **小建议**：`UpdateWorkOrderStatusDto` 的 `@IsIn` 缺少 `quoted`，虽然状态机允许 `draft→quoted`，DTO 层会拦截。后续如需使用 `quoted` 状态需补充 DTO。不影响当前功能。
- **TASK-002 状态**：已关闭 ✅
```
