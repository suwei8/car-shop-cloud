# TASK-206：在线订阅购买（商户自助付费）

> **优先级**：P1
> **状态**：待派发
> **依赖**：TASK-205（需要支付网关能力）
> **可并行**：TASK-208

## 1. 任务目标

当前商户订阅管理完全依赖平台管理员手动操作（TASK-102 实现的 `POST /api/platform/tenants/:id/renew` 和 `POST /api/platform/tenants/:id/extend`）。商户无法自主查看可选套餐、发起购买、在线支付并自动激活订阅。

本任务目标：
- 新增**订阅订单**（SubscriptionOrder）数据模型，记录商户的套餐购买历史
- 提供**商户端 API**：查看套餐列表、创建订阅订单、发起支付、查看订阅历史
- 支付成功后**自动激活订阅**（复用 `TenantService.renew()` 逻辑）
- 前端新增「套餐管理」页面，商户可自主选择套餐、时长、支付
- 支持按时长（1/3/6/12 月）阶梯折扣

## 2. 涉及文件

### 新建文件
- `apps/api/src/tenant/subscription/subscription.module.ts` — 订阅模块
- `apps/api/src/tenant/subscription/subscription.service.ts` — 订阅业务服务
- `apps/api/src/tenant/subscription/subscription.controller.ts` — 订阅控制器
- `apps/api/src/tenant/subscription/dto/create-subscription-order.dto.ts` — 创建订单 DTO
- `apps/api/src/tenant/subscription/dto/pay-subscription-order.dto.ts` — 支付 DTO
- `apps/api/src/tenant/subscription/subscription.service.spec.ts` — 单元测试
- `apps/web/src/views/subscription/SubscriptionManage.vue` — 套餐管理主页面
- `apps/web/src/views/subscription/components/PlanCard.vue` — 套餐卡片组件
- `apps/web/src/views/subscription/components/OrderHistory.vue` — 订单历史组件
- Prisma migration（新增 SubscriptionOrder 表）

### 修改文件
- `apps/api/prisma/schema.prisma` — 新增 SubscriptionOrder 模型、SubscriptionPlan 增加折扣字段
- `apps/api/src/app.module.ts` — 注册 SubscriptionModule（tenant 级）
- `apps/api/src/tenant/payment/payment-gateway.service.ts` — handleCallback 增加订阅支付回调处理分支
- `apps/web/src/router/index.ts` — 新增 `/subscription` 路由
- `apps/web/src/layouts/MainLayout.vue` 或侧边栏菜单配置 — 增加「套餐管理」菜单项
- `.env.example` — 新增折扣配置相关环境变量

## 3. 详细要求

### 3.1 Schema 变更（需要 migration）

新增 SubscriptionOrder 模型：

```prisma
model SubscriptionOrder {
  id              String   @id @default(cuid())
  tenantId        String
  orderNo         String   // 订单号（格式 SUB + yyyyMMdd + 4 位序号）
  planId          String
  months          Int      // 购买月数：1, 3, 6, 12
  originalAmount  Decimal  @db.Decimal(12, 2) // 原价（planPrice / 12 * months）
  discountRate    Decimal  @default(1.0) @db.Decimal(4, 2) // 折扣率（0.80 = 8 折）
  amount          Decimal  @db.Decimal(12, 2) // 实付金额（originalAmount * discountRate）
  status          String   @default("pending") // pending, paid, cancelled, refunded
  paymentMethod   String?  // wechat, alipay（对应 TASK-205 的支付方式）
  transactionId   String?  // 第三方交易号（支付成功后回填）
  paidAt          DateTime?
  cancelledAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant Tenant           @relation(fields: [tenantId], references: [id])
  plan   SubscriptionPlan @relation(fields: [planId], references: [id])

  @@unique([tenantId, orderNo])
  @@index([tenantId])
  @@index([tenantId, status])
  @@map("subscription_orders")
}
```

扩展 SubscriptionPlan 模型，增加折扣配置字段：

```prisma
model SubscriptionPlan {
  // ...已有字段
  priceMonthly    Decimal? @db.Decimal(12, 2) // 月付价格（如 null 则 = priceYearly / 12）
  discount3m      Decimal  @default(0.95) @db.Decimal(4, 2) // 3 个月折扣率
  discount6m      Decimal  @default(0.90) @db.Decimal(4, 2) // 6 个月折扣率
  discount12m     Decimal  @default(0.80) @db.Decimal(4, 2) // 12 个月（年付）折扣率

  subscriptionOrders SubscriptionOrder[]
}
```

Tenant 模型增加关系引用：

```prisma
model Tenant {
  // ...已有字段
  subscriptionOrders SubscriptionOrder[]
}
```

迁移命令：`pnpm db:migrate`（migration 命名 `add_subscription_order`）。

### 3.2 商户端 API 设计

控制器前缀：`/api/subscription`（注册在 tenant 模块下，需要 JWT 认证 + 租户权限）

#### 3.2.1 查询可购买套餐列表

```
GET /api/subscription/plans
```

- 权限：已登录的商户用户（无需特殊权限，所有商户用户可查看）
- 响应：

```json
{
  "code": 0,
  "data": [
    {
      "id": "plan-xxx",
      "name": "专业版",
      "description": "...",
      "priceYearly": "3600.00",
      "priceMonthly": "300.00",
      "maxShops": 3,
      "maxEmployees": 20,
      "features": [...],
      "discounts": {
        "1": { "rate": 1.00, "price": "300.00" },
        "3": { "rate": 0.95, "price": "855.00" },
        "6": { "rate": 0.90, "price": "1620.00" },
        "12": { "rate": 0.80, "price": "2880.00" }
      }
    }
  ]
}
```

- 只返回 `status = 'active'` 的套餐
- `discounts` 字段为前端计算展示用，由后端动态生成

#### 3.2.2 创建订阅订单

```
POST /api/subscription/orders
```

- 请求体：

```json
{
  "planId": "plan-xxx",
  "months": 6,
  "paymentMethod": "wechat"
}
```

- 校验：
  - `months` 必须是 1, 3, 6, 12 之一
  - `planId` 必须是有效且 active 的套餐
  - `paymentMethod` 必须是 `wechat` 或 `alipay`
  - 同一租户不允许有 `pending` 状态的未完成订单（防止重复下单），如有则自动取消旧订单
- 金额计算（在后端执行，不信任客户端）：
  - `monthlyPrice = plan.priceMonthly ?? (plan.priceYearly / 12)`
  - `originalAmount = monthlyPrice * months`
  - `discountRate` 根据 `months` 从 plan 的折扣字段获取（1 月→1.00，3 月→discount3m，6 月→discount6m，12 月→discount12m）
  - `amount = originalAmount * discountRate`，保留 2 位小数
- 响应：返回订单信息

```json
{
  "code": 0,
  "data": {
    "id": "order-xxx",
    "orderNo": "SUB202606130001",
    "amount": "1620.00",
    "status": "pending"
  }
}
```

#### 3.2.3 发起支付

```
POST /api/subscription/orders/:id/pay
```

- 校验：订单状态必须是 `pending`
- 调用 `PaymentGatewayService` 创建支付订单
  - `outTradeNo` 使用 `SubscriptionOrder.orderNo`
  - `description`：`"车店云管家 - {planName} {months}个月"`
  - `notifyUrl`：使用对应支付方式的回调 URL（复用 TASK-205 的回调端点）
- 返回支付信息：

```json
{
  "code": 0,
  "data": {
    "codeUrl": "weixin://wxpay/...",
    "orderId": "order-xxx"
  }
}
```

#### 3.2.4 查询订单状态

```
GET /api/subscription/orders/:id
```

- 返回订单详情（含支付状态）
- 前端轮询此端点判断支付是否完成

#### 3.2.5 查看当前订阅信息

```
GET /api/subscription/current
```

- 返回当前租户的订阅状态（从 `Tenant` + 最新 `TenantSubscription` 获取）：

```json
{
  "code": 0,
  "data": {
    "status": "active",
    "planName": "专业版",
    "startAt": "2026-01-01T00:00:00Z",
    "endAt": "2026-12-31T23:59:59Z",
    "daysRemaining": 201,
    "maxShops": 3,
    "maxEmployees": 20
  }
}
```

#### 3.2.6 查看订阅历史

```
GET /api/subscription/history
```

- 参数：`page`、`pageSize`
- 返回该租户的 SubscriptionOrder 列表（按 createdAt 倒序）

### 3.3 支付回调处理

复用 TASK-205 的 `PaymentCallbackController` 和 `PaymentGatewayService.handleCallback`：

- 在 `handleCallback` 中根据 `outTradeNo` 前缀判断业务类型：
  - `ST` 开头 → 结算支付（现有逻辑）
  - `SUB` 开头 → 订阅支付（本任务新增）
- 订阅支付回调处理流程：
  1. 查找 `SubscriptionOrder`（by `orderNo = outTradeNo`）
  2. 幂等检查：`status` 已是 `paid` 则跳过
  3. 更新 `SubscriptionOrder.status = 'paid'`、`transactionId`、`paidAt`
  4. 调用 `TenantService.renew(tenantId, planId, months, 'system')` 激活订阅
  5. 写入 AuditLog（action: `subscription_purchase`，包含 planId、months、amount）

### 3.4 前端页面

#### 3.4.1 套餐管理主页面（SubscriptionManage.vue）

布局：

```
┌─────────────────────────────────────────────┐
│  当前订阅状态卡片                              │
│  ┌─────────────────────────────────────────┐ │
│  │ 📦 当前套餐：专业版                        │ │
│  │ 📅 有效期至：2026-12-31  剩余 201 天       │ │
│  │ 🏪 门店上限：3家  👥 员工上限：20人         │ │
│  │ 状态：● 正常                              │ │
│  └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│  套餐选择区域                                 │
│  ┌──────┐  ┌──────┐  ┌──────┐              │
│  │基础版 │  │专业版 │  │旗舰版 │              │
│  │ ¥199  │  │ ¥300  │  │ ¥599  │              │
│  │ /月   │  │ /月   │  │ /月   │              │
│  └──────┘  └──────┘  └──────┘              │
│                                             │
│  时长选择                                    │
│  [1个月] [3个月 95折] [6个月 9折] [12个月 8折]  │
│                                             │
│  应付金额：¥1,620.00 (原价¥1,800.00 省¥180)  │
│  [立即购买]                                  │
├─────────────────────────────────────────────┤
│  购买历史                                    │
│  表格：订单号 | 套餐 | 时长 | 金额 | 状态 | 时间 │
└─────────────────────────────────────────────┘
```

- 套餐卡片（PlanCard.vue）：
  - 展示名称、月价、功能列表、门店/员工上限
  - 当前套餐高亮标记
  - 选中状态用边框颜色区分
- 时长选择：
  - 使用 `el-radio-group` 或按钮组
  - 选择后实时计算并显示原价、折后价、节省金额
- 立即购买按钮：
  - 点击后调用 `POST /api/subscription/orders` 创建订单
  - 成功后调用 `POST /api/subscription/orders/:id/pay` 获取二维码
  - 弹出 QrPayDialog（复用 TASK-205 的扫码支付弹窗）
  - 支付成功后刷新当前订阅状态和购买历史

#### 3.4.2 订单历史组件（OrderHistory.vue）

- `el-table` 展示：订单号、套餐名称、时长、金额、状态、支付时间
- 状态标签颜色：pending→橙色、paid→绿色、cancelled→灰色、refunded→红色
- 分页

#### 3.4.3 路由和菜单

修改 `apps/web/src/router/index.ts`：

```typescript
{
  path: 'subscription',
  name: 'Subscription',
  component: () => import('../views/subscription/SubscriptionManage.vue'),
  meta: { title: '套餐管理' }, // 无需特殊权限，所有商户用户可访问
},
```

修改侧边栏菜单配置，在「系统设置」分组下或独立分组中添加「套餐管理」项：
- 图标：`CreditCard` 或 `ShoppingCart`
- 仅商户用户可见（`isPlatform === false`）

### 3.5 订单号生成

使用现有的 `Sequence` 表机制（参考 `settlement.service.ts` 的 `generateSettleNo`）：

```typescript
private async generateOrderNo(tenantId: string, tx: any): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = await tx.sequence.upsert({
    where: { tenantId_key_date: { tenantId, key: 'subscription_order', date: dateStr } },
    update: { value: { increment: 1 } },
    create: { tenantId, key: 'subscription_order', date: dateStr, value: 1 },
  });
  return `SUB${dateStr}${String(seq.value).padStart(4, '0')}`;
}
```

### 3.6 单元测试

新建 `apps/api/src/tenant/subscription/subscription.service.spec.ts`：

- **创建订单测试**（4 个用例）：
  - 有效 planId + months=6 → 创建成功，金额计算正确（含折扣）
  - 无效 planId → NotFoundException
  - months 不在 [1,3,6,12] → BadRequestException
  - 已有 pending 订单 → 自动取消旧订单后创建新订单
- **支付回调测试**（3 个用例）：
  - 支付成功 → 更新 status=paid + 调用 renew
  - 幂等：重复回调 → 不重复调用 renew
  - 订单不存在 → 忽略（不抛错，记日志）
- **当前订阅查询**（2 个用例）：
  - 有活跃订阅 → 返回正确的 daysRemaining
  - 无订阅 → 返回 null
- Mock Prisma 和 PaymentGatewayService，不连真实数据库

## 4. 验收标准

- [ ] migration 成功，`pnpm db:migrate` 可在干净库上执行
- [ ] `GET /api/subscription/plans` 返回活跃套餐列表，包含折扣信息
- [ ] `POST /api/subscription/orders` 金额计算正确：6 个月专业版 = 300 × 6 × 0.9 = 1620.00
- [ ] `POST /api/subscription/orders/:id/pay` 返回二维码 URL（mock 模式下）
- [ ] 支付回调成功后，SubscriptionOrder.status 变为 paid，且 TenantSubscription 新增一条记录，Tenant.subscriptionEndAt 延长对应月数
- [ ] 重复回调不产生重复续费
- [ ] 已有 pending 订单时创建新订单，旧订单自动取消
- [ ] 前端「套餐管理」页面正确展示当前订阅状态、套餐列表、时长选择、折后价格
- [ ] 前端购买流程：选套餐 → 选时长 → 点购买 → 扫码弹窗 → 支付成功 → 刷新状态
- [ ] 侧边栏显示「套餐管理」菜单项，仅商户用户可见
- [ ] 订单历史列表分页正常
- [ ] 新增单元测试全部通过（≥ 9 个用例），`pnpm --filter api test` 无失败
- [ ] `nest build` 编译通过，`vue-tsc --noEmit` 编译通过

## 5. 注意事项

- **金额计算必须在后端**：前端的价格展示仅供参考，实际金额以后端 `POST /api/subscription/orders` 返回为准，防止客户端篡改
- **金额使用 Decimal(12,2)**：折扣率使用 Decimal(4,2)，计算后 `toFixed(2)` 取整
- **租户隔离**：SubscriptionOrder 表有 tenantId，所有查询从 JWT 取 tenantId，不信任客户端
- **复用已有逻辑**：
  - 支付走 TASK-205 的 `PaymentGatewayService`，不重复实现支付逻辑
  - 续费走 `TenantService.renew()`，保持订阅生命周期逻辑一致
  - 订单号生成走 `Sequence` 表，保持编号规则统一
- **回调路由复用**：不新增回调端点，通过 `outTradeNo` 前缀（`SUB` vs `ST`）区分业务类型
- **并发安全**：创建订单时的「取消旧 pending 订单」操作需在事务中完成
- **审计日志**：订阅购买成功需写入 AuditLog（action: `subscription_purchase`）
- **不新增后端支付端点**：完全复用 TASK-205 的支付基础设施
- **遵循项目响应格式** `{ code, message, data }` 与现有 DTO 校验规范

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/prisma/schema.prisma`（SubscriptionPlan 新增 priceMonthly/discount3m/discount6m/discount12m 字段 + 新增 SubscriptionOrder 模型 + Tenant/TenantSubscription 增加关系引用）, `apps/api/src/app.module.ts`（注册 SubscriptionModule）, `apps/api/src/tenant/payment/payment-gateway.service.ts`（handleCallback 增加 SUB 前缀分支 + 注入 ModuleRef）, `apps/api/src/tenant/payment/payment-gateway.service.spec.ts`（适配新增 ModuleRef 参数）, `apps/web/src/router/index.ts`（新增 /subscription 路由）, `apps/web/src/layouts/MainLayout.vue`（侧边栏新增「套餐管理」菜单项） |
| 新建的文件列表 | `apps/api/src/tenant/subscription/subscription.module.ts`, `apps/api/src/tenant/subscription/subscription.service.ts`, `apps/api/src/tenant/subscription/subscription.controller.ts`, `apps/api/src/tenant/subscription/dto/create-subscription-order.dto.ts`, `apps/api/src/tenant/subscription/dto/pay-subscription-order.dto.ts`, `apps/api/src/tenant/subscription/subscription.service.spec.ts`, `apps/web/src/views/subscription/SubscriptionManage.vue`, `apps/web/src/views/subscription/components/PlanCard.vue`, `apps/web/src/views/subscription/components/OrderHistory.vue`, `apps/web/src/views/subscription/components/QrPayDialog.vue` |
| 构建是否通过 | ✅ `nest build` 通过, ✅ `vue-tsc --noEmit` 通过 |
| 测试是否通过（新增用例数） | ✅ 全部 239 个测试通过（26 suites），新增 13 个测试用例（getPlans 1, createOrder 4, payOrder 3, handleCallback 3, getCurrentSubscription 2） |
| 已知限制或遗留问题 | 1) Prisma migration 需要手动在目标环境执行 `pnpm db:migrate --name add_subscription_order`；2) 前端 QrPayDialog 轮询频率为 3 秒，生产环境可根据实际情况调整；3) SubscriptionPlan 的 discount 字段默认值需要通过 seed 数据或 migration 设置已有套餐的折扣率 |
| 执行耗时 | ~15 分钟 |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 产品经理审核记录（2026-06-13）

- **审核结论**：✅ 通过
- **核对项目**：
  - **数据结构与关系**：✅ `SubscriptionPlan` 增加了周期与折扣控制，`SubscriptionOrder` 的落库逻辑完整，符合 SaaS 计费模型。
  - **后端交易流程**：✅ `getPlans`、`createOrder` 等核心链路无缝接入了 `payment-gateway` 的回调体系，利用 `ModuleRef` 懒加载巧妙地避开了循环依赖问题。金额计算（折扣与原价）均在服务端防篡改控制下完成。
  - **前端功能体验**：✅ 新增的“套餐管理”页面组件拆分合理（`PlanCard`, `OrderHistory`, `QrPayDialog`），为商户提供了直观的自助续费入口，进一步减轻了平台管理的压力。
  - **构建与覆盖**：✅ 13 个新增测试有效覆盖了计费与订单回调的幂等边界。总测试用例攀升至 239 个且全部通过。
- **复核意见**：TASK-206 极其出色地完成了从“平台代扣代充”向“商户自助履约”的转变，是整个车店云系统商业化成熟的重要标志。
- **TASK-206 状态**：✅ 已关闭
