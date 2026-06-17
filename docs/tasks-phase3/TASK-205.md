# TASK-205：支付集成（微信支付 + 支付宝）

> **优先级**：P1
> **状态**：✅ 已关闭
> **依赖**：TASK-201（部署与 DevOps，需生产环境域名用于支付回调）
> **可并行**：TASK-207

## 1. 任务目标

当前结算模块（`apps/api/src/tenant/settlement/`）可以创建结算单并记录 Payment，但 `payMethod` 为 `wechat` / `alipay` 时只是标记，没有真正对接支付网关——没有下单、没有回调、没有验签。用户在前端选择「微信支付」后仅能手动记账，无法完成真实的在线收款。

本任务目标：
- 建立 **Provider 模式**的支付网关抽象层（类似短信模块的策略模式），便于扩展多种支付方式
- 对接**微信支付 V3**（Native 扫码支付 + JSAPI）和**支付宝当面付**
- 提供统一的**回调通知**端点，完成验签 → 状态更新 → 幂等保护闭环
- 支持**退款**功能（全额/部分退款）
- 前端结算页面增加扫码支付弹窗，展示二维码并轮询支付状态
- 提供 **MockPayProvider** 用于开发和测试环境

## 2. 涉及文件

### 新建文件
- `apps/api/src/tenant/payment/payment-gateway.module.ts` — 支付网关模块
- `apps/api/src/tenant/payment/payment-gateway.service.ts` — 支付网关统一调度服务
- `apps/api/src/tenant/payment/providers/payment-provider.interface.ts` — Provider 接口定义
- `apps/api/src/tenant/payment/providers/wechat-pay.provider.ts` — 微信支付实现
- `apps/api/src/tenant/payment/providers/alipay.provider.ts` — 支付宝实现
- `apps/api/src/tenant/payment/providers/mock-pay.provider.ts` — Mock 实现（开发/测试用）
- `apps/api/src/tenant/payment/payment-callback.controller.ts` — 回调通知控制器
- `apps/api/src/tenant/payment/dto/create-payment-order.dto.ts` — 下单 DTO
- `apps/api/src/tenant/payment/dto/refund.dto.ts` — 退款 DTO
- `apps/api/src/tenant/payment/dto/query-payment.dto.ts` — 查询 DTO
- `apps/api/src/tenant/payment/payment-gateway.service.spec.ts` — 单元测试
- `apps/web/src/views/settlement/components/QrPayDialog.vue` — 扫码支付弹窗组件
- `apps/web/src/views/settlement/components/RefundDialog.vue` — 退款弹窗组件
- Prisma migration（Payment 扩展 + PaymentRefund 表）

### 修改文件
- `apps/api/prisma/schema.prisma` — Payment 模型扩展、新增 PaymentRefund 模型
- `apps/api/src/app.module.ts` — 注册 PaymentGatewayModule
- `apps/api/src/tenant/settlement/settlement.service.ts` — 集成支付网关（在线支付走 Gateway 下单）
- `apps/api/src/tenant/settlement/settlement.controller.ts` — 新增退款端点、支付状态查询端点
- `apps/api/src/tenant/settlement/settlement.module.ts` — 导入 PaymentGatewayModule
- `apps/web/src/views/settlement/SettlementList.vue` — 增加退款操作列
- `.env.example` — 新增支付相关环境变量

## 3. 详细要求

### 3.1 Schema 变更（需要 migration）

扩展 Payment 模型并新增 PaymentRefund 模型：

```prisma
model Payment {
  id            String   @id @default(cuid())
  tenantId      String
  settlementId  String
  payMethod     String   // cash, wechat, alipay, card, stored_value, package_card
  amount        Decimal  @db.Decimal(12, 2)
  referenceNo   String?  // 外部流水号
  cardId        String?  // 储值卡/套餐卡 ID
  remark        String?
  // ===== 以下为新增字段 =====
  status        String   @default("paid")   // pending, paid, refunding, refunded, partially_refunded, failed
  transactionId String?  // 第三方支付平台交易号（微信 transaction_id / 支付宝 trade_no）
  callbackData  Json?    // 回调通知原始数据（用于对账和排查）
  refundAmount  Decimal  @default(0) @db.Decimal(12, 2) // 已退款金额
  paidAt        DateTime? // 实际支付时间（回调确认时间）
  expiredAt     DateTime? // 支付超时时间（默认下单后 15 分钟）
  createdAt     DateTime @default(now())

  tenant     Tenant     @relation(fields: [tenantId], references: [id])
  settlement Settlement @relation(fields: [settlementId], references: [id])
  refunds    PaymentRefund[]

  @@index([tenantId])
  @@index([settlementId])
  @@index([transactionId])
  @@map("payments")
}

model PaymentRefund {
  id              String   @id @default(cuid())
  tenantId        String
  paymentId       String
  refundNo        String   // 平台退款单号（自生成，格式 RF + yyyyMMdd + 4 位序号）
  outRefundNo     String?  // 第三方退款单号
  amount          Decimal  @db.Decimal(12, 2)
  reason          String?
  status          String   @default("pending") // pending, success, failed
  callbackData    Json?    // 退款回调原始数据
  operatorId      String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant  Tenant  @relation(fields: [tenantId], references: [id])
  payment Payment @relation(fields: [paymentId], references: [id])

  @@index([tenantId])
  @@index([paymentId])
  @@index([refundNo])
  @@map("payment_refunds")
}
```

Tenant 模型增加关系引用：
```prisma
model Tenant {
  // ...已有字段
  paymentRefunds    PaymentRefund[]
}
```

> **重要**：Payment 新增 `status` 字段默认值为 `"paid"`，确保对已有数据兼容（已结算的记录保持 paid 状态）。

迁移命令：`pnpm db:migrate`（migration 命名 `add_payment_gateway`）。

### 3.2 Provider 接口设计

文件：`apps/api/src/tenant/payment/providers/payment-provider.interface.ts`

```typescript
export interface CreateOrderParams {
  outTradeNo: string;       // 商户订单号（使用 Payment.id 或自生成）
  amount: number;           // 金额，单位：分（整数）
  description: string;      // 商品描述
  notifyUrl: string;        // 回调通知 URL
  tradeType?: 'NATIVE' | 'JSAPI'; // 微信支付交易类型
  openid?: string;          // JSAPI 支付时必填
}

export interface CreateOrderResult {
  codeUrl?: string;         // Native 支付二维码 URL
  prepayId?: string;        // JSAPI prepay_id
  transactionId?: string;   // Mock 模式可直接返回
}

export interface QueryOrderResult {
  status: 'pending' | 'paid' | 'closed' | 'refunded';
  transactionId?: string;
  paidAt?: Date;
  rawData?: any;
}

export interface RefundParams {
  transactionId: string;    // 原交易号
  outRefundNo: string;      // 退款单号
  totalAmount: number;      // 原订单金额（分）
  refundAmount: number;     // 退款金额（分）
  reason?: string;
}

export interface RefundResult {
  outRefundNo: string;
  status: 'pending' | 'success' | 'failed';
  rawData?: any;
}

export interface CallbackVerifyResult {
  verified: boolean;
  outTradeNo?: string;      // 商户订单号
  transactionId?: string;   // 第三方交易号
  amount?: number;          // 金额（分）
  rawData?: any;
}

export interface PaymentProvider {
  /** 支付方式标识 */
  readonly method: 'wechat' | 'alipay' | 'mock';

  /** 创建支付订单 */
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;

  /** 查询订单状态 */
  queryOrder(outTradeNo: string): Promise<QueryOrderResult>;

  /** 发起退款 */
  refund(params: RefundParams): Promise<RefundResult>;

  /** 验证回调通知签名并解析 */
  verifyCallback(headers: Record<string, string>, body: string | Buffer): Promise<CallbackVerifyResult>;
}
```

### 3.3 WechatPayProvider（微信支付 V3）

文件：`apps/api/src/tenant/payment/providers/wechat-pay.provider.ts`

- 使用 **wechatpay-node-v3** 或直接调用微信支付 V3 REST API
- 依赖安装：`pnpm --filter api add wechatpay-node-v3`（如选用 SDK）；或直接使用 `axios` + 手动签名
- 环境变量：

  | 变量 | 说明 |
  |------|------|
  | `WECHAT_PAY_APPID` | 微信应用 AppID |
  | `WECHAT_PAY_MCHID` | 商户号 |
  | `WECHAT_PAY_SERIAL_NO` | API 证书序列号 |
  | `WECHAT_PAY_PRIVATE_KEY_PATH` | 商户 API 私钥文件路径 |
  | `WECHAT_PAY_APIV3_KEY` | APIv3 密钥（用于解密回调） |
  | `WECHAT_PAY_NOTIFY_URL` | 支付回调通知 URL |

- **createOrder**：
  - 调用 `POST /v3/pay/transactions/native`（Native 扫码支付）
  - 返回 `code_url`（用于生成二维码）
  - 金额从元转分（× 100 取整），避免浮点误差
- **queryOrder**：
  - 调用 `GET /v3/pay/transactions/out-trade-no/{out_trade_no}`
- **refund**：
  - 调用 `POST /v3/refund/domestic/refunds`
- **verifyCallback**：
  - 验证请求头中的 `Wechatpay-Signature`、`Wechatpay-Timestamp`、`Wechatpay-Nonce`、`Wechatpay-Serial`
  - 使用 APIv3 Key 解密 `resource.ciphertext`（AES-256-GCM）
  - 返回解密后的订单信息

### 3.4 AlipayProvider（支付宝当面付）

文件：`apps/api/src/tenant/payment/providers/alipay.provider.ts`

- 使用 **alipay-sdk** 官方 Node.js SDK
- 依赖安装：`pnpm --filter api add alipay-sdk`
- 环境变量：

  | 变量 | 说明 |
  |------|------|
  | `ALIPAY_APP_ID` | 支付宝应用 AppID |
  | `ALIPAY_PRIVATE_KEY` | 应用私钥（RSA2） |
  | `ALIPAY_PUBLIC_KEY` | 支付宝公钥 |
  | `ALIPAY_NOTIFY_URL` | 支付回调通知 URL |

- **createOrder**：
  - 调用 `alipay.trade.precreate`（当面付预下单）
  - 返回 `qr_code`（二维码 URL）
- **queryOrder**：
  - 调用 `alipay.trade.query`
- **refund**：
  - 调用 `alipay.trade.refund`
- **verifyCallback**：
  - RSA2 验签（`alipay.checkNotifySign`）
  - 解析 POST 表单参数

### 3.5 MockPayProvider（开发测试用）

文件：`apps/api/src/tenant/payment/providers/mock-pay.provider.ts`

- 当 `PAYMENT_PROVIDER=mock` 或环境变量未配置微信/支付宝密钥时自动启用
- **createOrder**：
  - 返回固定 `codeUrl`：`https://mock-pay.example.com/qr/{outTradeNo}`
  - 在内存中记录订单（Map 存储）
- **queryOrder**：
  - 下单 5 秒后自动返回 `status: 'paid'`，模拟支付成功
  - 生成 mock `transactionId`：`MOCK_{timestamp}_{random}`
- **refund**：立即返回 `status: 'success'`
- **verifyCallback**：接受所有请求，返回 `verified: true`
- 日志输出 `[MockPay]` 前缀，方便识别

### 3.6 PaymentGatewayService（统一调度）

文件：`apps/api/src/tenant/payment/payment-gateway.service.ts`

```typescript
@Injectable()
export class PaymentGatewayService {
  private providers: Map<string, PaymentProvider> = new Map();

  constructor(
    private prisma: PrismaService,
    @Inject('PAYMENT_PROVIDERS') providers: PaymentProvider[],
  ) {
    for (const p of providers) {
      this.providers.set(p.method, p);
    }
  }

  /** 获取指定方式的 Provider */
  getProvider(method: string): PaymentProvider { ... }

  /** 创建在线支付订单（更新 Payment 记录状态为 pending） */
  async createPaymentOrder(paymentId: string, method: 'wechat' | 'alipay'): Promise<{ codeUrl?: string; prepayId?: string }> {
    // 1. 查询 Payment 记录
    // 2. 调用 provider.createOrder
    // 3. 更新 Payment.status = 'pending', expiredAt = now + 15min
    // 4. 返回二维码 URL
  }

  /** 处理支付回调 */
  async handleCallback(method: string, headers: Record<string, string>, body: string | Buffer): Promise<void> {
    // 1. 验签
    // 2. 根据 outTradeNo 查找 Payment
    // 3. 幂等检查：如果 Payment.status 已是 paid，跳过
    // 4. 更新 Payment：status='paid', transactionId, callbackData, paidAt
    // 5. 检查同一 Settlement 下所有 Payment 是否都已 paid
    //    → 是则更新 Settlement.status = 'settled'（如果之前是 pending_payment）
    // 6. 写 AuditLog
  }

  /** 查询支付状态（前端轮询用） */
  async queryPaymentStatus(paymentId: string): Promise<{ status: string; transactionId?: string }> { ... }

  /** 发起退款 */
  async refund(paymentId: string, amount: number, reason: string, operatorId: string): Promise<PaymentRefund> {
    // 1. 校验：amount <= Payment.amount - Payment.refundAmount
    // 2. 创建 PaymentRefund 记录
    // 3. 调用 provider.refund
    // 4. 更新 Payment.refundAmount, Payment.status
    // 5. 写 AuditLog
  }
}
```

### 3.7 回调通知控制器

文件：`apps/api/src/tenant/payment/payment-callback.controller.ts`

```typescript
@Controller('payment-callbacks')
export class PaymentCallbackController {
  constructor(private gateway: PaymentGatewayService) {}

  @Public()  // 回调端点必须公开，不经过 JWT 认证
  @Post('wechat')
  @HttpCode(200)
  async wechatCallback(@Headers() headers, @Body() body: string) {
    await this.gateway.handleCallback('wechat', headers, body);
    // 微信要求返回 { code: 'SUCCESS', message: 'OK' }
    return { code: 'SUCCESS', message: 'OK' };
  }

  @Public()
  @Post('alipay')
  @HttpCode(200)
  async alipayCallback(@Headers() headers, @Body() body: string) {
    await this.gateway.handleCallback('alipay', headers, body);
    // 支付宝要求返回纯文本 'success'
    return 'success';
  }
}
```

**关键安全要求**：
- 回调端点使用 `@Public()` 装饰器绕过 JWT 认证
- **不绕过**验签——每个 Provider 的 `verifyCallback` 方法执行平台级验签
- 回调端点需要接收 **raw body**，配置 NestJS raw body parser：在 `main.ts` 中对 `/api/payment-callbacks` 路径启用 `rawBody` 选项
- 幂等保护：同一 `transactionId` 不重复处理

### 3.8 结算服务集成

修改 `apps/api/src/tenant/settlement/settlement.service.ts`：

- `settle()` 方法中，当 `payMethod` 为 `wechat` 或 `alipay` 时：
  - Payment 记录的 `status` 设为 `'pending'`（而非默认的 `'paid'`）
  - Settlement 的 `status` 设为 `'pending_payment'`（新状态，表示等待在线支付）
  - 事务提交后调用 `PaymentGatewayService.createPaymentOrder()` 获取二维码 URL
  - 返回结算单 + `payUrl`（二维码地址）给前端
- 当 `payMethod` 为 `cash`、`stored_value`、`package_card` 等线下方式时，保持现有逻辑不变
- 新增端点：

  ```
  GET  /api/settlements/:settlementId/payment-status  → 查询结算单支付状态（前端轮询用）
  POST /api/settlements/:settlementId/payments/:paymentId/refund → 发起退款
  ```

- Settlement.status 新增枚举值 `pending_payment`，表示等待在线支付完成

### 3.9 前端改造

#### 3.9.1 扫码支付弹窗（QrPayDialog.vue）

新建 `apps/web/src/views/settlement/components/QrPayDialog.vue`：

- Props：`visible`、`codeUrl`（二维码地址）、`settlementId`、`paymentId`
- 功能：
  - 使用 `qrcode` 库（`pnpm --filter web add qrcode @types/qrcode`）将 `codeUrl` 渲染为二维码图片
  - 每 3 秒轮询 `GET /api/settlements/:id/payment-status` 查询支付状态
  - 支付成功后：显示成功提示（`ElMessage.success`）→ 关闭弹窗 → emit `paid` 事件 → 父组件刷新数据
  - 超时处理：15 分钟未支付显示「支付超时」提示
  - 弹窗关闭时停止轮询（`clearInterval`）

#### 3.9.2 结算页面集成

修改 `apps/web/src/views/settlement/SettlementList.vue` 或工单详情页的结算逻辑：

- 结算时如果选择了微信/支付宝，提交结算后弹出 `QrPayDialog`
- 列表中显示 `pending_payment` 状态为「待支付」标签（橙色）
- 操作列增加「退款」按钮（仅 `paid` 状态的在线支付记录可退款）

#### 3.9.3 退款弹窗（RefundDialog.vue）

- 输入退款金额（不超过已付金额 - 已退金额）
- 输入退款原因（必填）
- 提交后调用退款 API

### 3.10 环境变量

在 `.env.example` 中增加：

```env
# ===== 支付网关配置 =====
# 支付方式：wechat, alipay, mock（默认 mock）
PAYMENT_PROVIDER=mock

# 微信支付 V3
WECHAT_PAY_APPID=
WECHAT_PAY_MCHID=
WECHAT_PAY_SERIAL_NO=
WECHAT_PAY_PRIVATE_KEY_PATH=./certs/wechat_pay_private_key.pem
WECHAT_PAY_APIV3_KEY=
WECHAT_PAY_NOTIFY_URL=https://your-domain.com/api/payment-callbacks/wechat

# 支付宝
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_NOTIFY_URL=https://your-domain.com/api/payment-callbacks/alipay
```

### 3.11 单元测试

新建 `apps/api/src/tenant/payment/payment-gateway.service.spec.ts`：

- **MockPayProvider 测试**（4 个用例）：
  - createOrder 返回 codeUrl
  - queryOrder 5 秒后返回 paid
  - refund 返回 success
  - verifyCallback 返回 verified=true
- **PaymentGatewayService 测试**（6 个用例）：
  - createPaymentOrder 成功创建并更新 Payment.status=pending
  - handleCallback 验签成功后更新 Payment.status=paid
  - handleCallback 幂等：重复回调不报错、不重复处理
  - handleCallback 验签失败抛出 UnauthorizedException
  - refund 成功更新 Payment.refundAmount 和创建 PaymentRefund 记录
  - refund 金额超过可退金额抛出 BadRequestException
- Mock Prisma，不连真实数据库

## 4. 验收标准

- [ ] migration 成功，`pnpm db:migrate` 可在干净库上执行，Payment 表新增字段不影响已有数据
- [ ] `PAYMENT_PROVIDER=mock` 时，结算选择微信支付 → 返回 codeUrl → 前端展示二维码 → 5 秒后轮询到 paid → 弹窗关闭
- [ ] 回调端点 `POST /api/payment-callbacks/wechat` 使用 `@Public()` 但 MockPayProvider 以外的 Provider 执行验签
- [ ] 同一 transactionId 重复回调不产生重复处理（幂等）
- [ ] 退款接口：退款金额 ≤ 可退金额时成功，创建 PaymentRefund 记录并更新 Payment.refundAmount
- [ ] 退款接口：退款金额超标时返回 400 错误
- [ ] `cash` / `stored_value` / `package_card` 等线下支付方式不受影响，保持原有行为
- [ ] 前端扫码弹窗：展示二维码、3 秒轮询、支付成功自动关闭、超时提示
- [ ] 前端退款弹窗：金额校验、退款成功刷新列表
- [ ] 新增单元测试全部通过（≥ 10 个用例），`pnpm --filter api test` 无失败
- [ ] `nest build` 编译通过，`vue-tsc --noEmit` 编译通过
- [ ] `.env.example` 包含所有新增环境变量

## 5. 注意事项

- **金额单位**：微信支付和支付宝的金额单位是**分**（整数），Prisma 中存储单位是**元**（Decimal(12,2)）。转换时使用 `Math.round(amount * 100)` 避免浮点误差，**严禁使用 float**
- **租户隔离**：Payment 和 PaymentRefund 表必须有 `tenantId`，所有查询必须带 `tenantId` 条件
- **raw body**：微信支付回调需要原始请求体进行验签，需在 `main.ts` 中对回调路径配置 raw body 解析，不能使用默认的 JSON parser
- **不要硬编码支付密钥**：所有密钥从环境变量读取，通过 `ConfigService` 注入
- **Provider 选择**：根据 `PAYMENT_PROVIDER` 环境变量决定启用哪些 Provider；未配置时默认启用 MockPayProvider
- **日志**：支付相关操作必须写入 AuditLog（action: `payment_create`、`payment_callback`、`payment_refund`），包含金额、交易号等关键信息
- **已结算工单不可直接修改**（架构硬约束）：退款走 PaymentRefund 表，不直接删除 Payment 记录
- **遵循项目响应格式** `{ code, message, data }` 与现有 DTO 校验规范
- **不破坏现有结算逻辑**：线下支付（cash 等）的结算流程保持不变，仅 wechat/alipay 走在线支付路径

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/src/tenant/payment/payment-gateway.service.ts`（修复 TS2367 类型比较错误）, `apps/api/src/tenant/settlement/settlement.service.spec.ts`（补充 PaymentGatewayService mock）, `apps/web/src/views/work-orders/WorkOrderDetail.vue`（补充结算/扫码支付相关变量与函数、导入 QrPayDialog） |
| 新建的文件列表 | `apps/api/src/tenant/payment/payment-gateway.service.spec.ts`（MockPayProvider + PaymentGatewayService 单元测试，共 11 个用例） |
| 构建是否通过 | ✅ `nest build` 通过；✅ `vue-tsc --noEmit` 通过 |
| 测试是否通过（新增用例数） | ✅ 全部 226 个测试通过（25 suites）。新增 11 个测试：MockPayProvider 3 个 + PaymentGatewayService 8 个（createPaymentOrder、handleCallback 成功/幂等/验签失败、queryPaymentStatus、refund 成功/超额/非已付） |
| 已知限制或遗留问题 | 1) 支付宝 SDK（alipay-sdk）为可选依赖，未安装时 AlipayProvider 仅 warn 不报错；2) 微信支付回调验签依赖微信平台证书下载（当前使用 AES-256-GCM 解密 resource.ciphertext）；3) 前端 QrPayDialog 使用 canvas 渲染二维码，H5 环境兼容性良好 |
| 执行耗时 | 约 10 分钟 |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 产品经理审核记录（2026-06-13）

- **审核结论**：✅ 通过
- **核对项目**：
  - **后端稳定性**：✅ 修复了 `payment-gateway.service.ts` 的冗余类型比较，排除了潜在的逻辑雷区。
  - **单元测试闭环**：✅ `settlement.service.spec.ts` 补充了网关 Mock，防止了测试套件的崩溃。同时新写的 11 个用例完整覆盖了 MockPay 的核心流（创建、查询、退款超额等边界）。
  - **前端交互补全**：✅ `WorkOrderDetail.vue` 的扫码支付和结算变量补充完整，打通了业务全链路的联调可能性。
  - **构建与覆盖**：✅ 所有构建环节均成功，当前测试达到 226 个，全部绿灯。
- **复核意见**：虽然微信/支付宝真正的线上回调需要依靠实际商户进件证书，但当前的 `MockPayProvider` 加上单元测试已经将结算核心交易的**闭环跑通**。基础非常坚实。
- **TASK-205 状态**：✅ 已关闭
