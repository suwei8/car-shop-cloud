# TASK-006：核心业务单元测试

> **优先级**：P0
> **状态**：✅ 已关闭
> **依赖**：TASK-001 ~ TASK-005（所有业务逻辑已稳定）

## 1. 任务目标

为涉及金额计算、余额变动、库存扣减的核心业务 Service 编写单元测试，覆盖正常路径和异常路径，确保金融级正确性。

## 2. 涉及文件

### 新建文件
- `apps/api/src/tenant/settlement/settlement.service.spec.ts`
- `apps/api/src/tenant/stored-value-card/stored-value-card.service.spec.ts`
- `apps/api/src/tenant/work-order/work-order.service.spec.ts`
- `apps/api/src/tenant/work-order/work-order.state-machine.spec.ts`
- `apps/api/src/tenant/package-card/package-card.service.spec.ts`
- `apps/api/src/tenant/stock/stock.service.spec.ts`（如 stock.service 已实现）

### 可能修改文件
- `apps/api/package.json` — 添加 `@nestjs/testing` 依赖（如尚未安装）
- `apps/api/jest.config.ts` 或 `jest` 配置（如尚未配置）

## 3. 详细要求

### 3.1 测试框架配置

确保项目可运行测试：

```bash
# 检查是否已安装测试依赖
# 如果没有，需要安装：
# @nestjs/testing, jest, ts-jest, @types/jest
```

在 `package.json` 中添加测试脚本：

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage"
  }
}
```

### 3.2 settlement.service.spec.ts — 结算服务测试

**测试用例**：

```
describe('SettlementService.settle')
  ✓ 正常结算：工单状态从 completed 变为 settled
  ✓ 储值卡支付：余额正确扣减（先扣赠送再扣本金）
  ✓ 储值卡余额不足：抛出 ForbiddenException
  ✓ 储值卡状态异常（frozen）：抛出 ForbiddenException
  ✓ 套餐卡核销：剩余次数正确扣减
  ✓ 套餐卡过期：抛出 ForbiddenException
  ✓ 套餐卡次数不足：抛出 ForbiddenException
  ✓ 多支付方式组合：现金 + 储值卡同时使用
  ✓ 欠款结算：paidAmount < payableAmount 时 debtAmount 正确
  ✓ 工单已结算：重复结算抛出 ForbiddenException
  ✓ 工单不存在：抛出 NotFoundException
  ✓ 跨租户结算：抛出 NotFoundException

describe('SettlementService.reverse')
  ✓ 正常反结算：工单状态回退到 completed
  ✓ 储值卡退回：余额正确退回
  ✓ 套餐卡退回：次数正确退回
  ✓ 非 settled 状态反结算：抛出 ForbiddenException
```

### 3.3 stored-value-card.service.spec.ts — 储值卡服务测试

**测试用例**：

```
describe('StoredValueCardService')
  ✓ 售卡：创建卡片 + 首笔充值流水
  ✓ 售卡赠送金额：本金和赠送余额分别正确
  ✓ 充值：余额增加 + 流水记录
  ✓ 消费：先扣赠送再扣本金
  ✓ 消费余额不足：抛出 ForbiddenException
  ✓ 退款：只退本金，金额正确
  ✓ 退款超过本金：抛出 ForbiddenException
  ✓ 卡号重复：抛出 ConflictException
  ✓ 卡片冻结状态操作：抛出 ForbiddenException
  ✓ 流水查询：分页正确
```

### 3.4 work-order.state-machine.spec.ts — 状态机测试

**测试用例**：

```
describe('validateTransition')
  ✓ draft → confirmed：合法
  ✓ draft → cancelled：合法
  ✓ draft → settled：非法，抛出 BadRequestException
  ✓ confirmed → in_progress（或 dispatching）：合法
  ✓ in_progress → completed：合法
  ✓ completed → settled：合法
  ✓ settled → handed_over（如果有）：合法
  ✓ settled → draft：非法
  ✓ cancelled → 任何状态：非法
  ✓ 未知状态：抛出 BadRequestException
```

### 3.5 work-order.service.spec.ts — 工单服务测试

**测试用例**：

```
describe('WorkOrderService')
  ✓ 创建工单：orderNo 正确生成，金额正确计算
  ✓ 创建工单：车辆不存在抛出 NotFoundException
  ✓ 添加工单项目：总金额正确增加
  ✓ 更新状态：通过状态机校验
  ✓ 列表查询：分页、筛选、租户隔离
  ✓ 详情查询：跨租户返回 NotFoundException
```

### 3.6 测试 Mock 策略

- 使用 `jest.fn()` mock PrismaService 的所有方法
- 使用 `Prisma.$transaction` mock 为实际执行回调函数
- 不使用真实数据库，纯 Mock 测试

```typescript
// 示例 mock
const mockPrisma = {
  workOrder: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(async (fn) => fn(mockTx)),
  // ...
};
```

### 3.7 金额精度测试

特别注意 Decimal 类型的处理：
- Prisma 返回 Decimal 对象，mock 时需要用 `new Prisma.Decimal(value)` 或直接用 Number
- 测试中验证金额计算不产生浮点误差（如 0.1 + 0.2 !== 0.3）

## 4. 验收标准

- [ ] `pnpm --filter @car/api run test` 全部通过
- [ ] 上述列出的所有测试用例都有对应测试
- [ ] 每个 Service 至少覆盖：正常路径、参数异常、权限异常、金额计算
- [ ] 金额相关测试包含边界值（0、极小值、极大值）
- [ ] 测试可重复运行，无副作用
- [ ] 测试运行时间 < 30 秒

## 5. 注意事项

- 不要修改业务代码的逻辑（如果测试发现 bug，在回执中标注，不要自行修复）
- 测试文件放在对应的 Service 同级目录
- 使用 `@nestjs/testing` 的 `Test.createTestingModule` 创建测试模块
- 确保测试之间互相独立，不依赖执行顺序

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下内容追加到本文件末尾：**

### 回执

| 项目 | 内容 |
|------|------|
| 新建的测试文件列表 | `work-order.state-machine.spec.ts`, `work-order.service.spec.ts`, `settlement.service.spec.ts`, `stored-value-card.service.spec.ts`, `package-card.service.spec.ts`, `stock.service.spec.ts` |
| 测试用例总数 | 68 |
| 测试是否全部通过 | 通过 (6 suites, 68 tests) |
| 发现的业务 bug（如有） | 无 |
| 测试运行耗时 | ~7.4s |
| 已知限制或遗留问题 | 无 |
| 执行耗时 | ~10min |

---

## 7. 架构师审核区域

> **架构师审核后填写：**

```markdown
### 审核结果

- **审核时间**：2026-06-11
- **审核结论**：✅ 通过
- **审核意见**：
  - Jest 配置 ✅ `jest.config.ts` 含 ts-jest、`@car/shared` 路径映射、覆盖率收集
  - 测试运行 ✅ `6 suites, 68 tests, 全部通过, 8.3s`
  - `settlement.service.spec.ts` (14 tests) ✅ 正常结算、储值卡先赠后本、余额不足、重复结算、套餐卡核销抵扣、欠款计算、反结算退回（储值卡+套餐卡）、分页隔离
  - `stored-value-card.service.spec.ts` (11 tests) ✅ 售卡、充值、消费先赠后本、退款、余额不足、卡号重复、冻结状态
  - `work-order.state-machine.spec.ts` (15 tests) ✅ 全部合法/非法流转、终态不可变、未知状态、中文标签
  - `work-order.service.spec.ts` (9 tests) ✅ 创建、添加项目、状态更新（含库存触发）、分页隔离
  - `package-card.service.spec.ts` (10 tests) ✅ 售卡、核销 5 项校验、卡号重复、状态异常
  - `stock.service.spec.ts` (9 tests) ✅ 入库、工单扣减（正常/负库存/防重复/无配件）、余额/流水/单据查询
  - Mock 策略 ✅ 全部使用 `jest.fn()` mock Prisma，`$transaction` 直接执行回调，无真实数据库连接
  - 金额测试 ✅ 储值卡先赠后本逻辑、欠款计算、套餐卡抵扣金额均有覆盖
- **TASK-006 状态**：已关闭 ✅
```
