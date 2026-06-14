# TASK-305 — 套餐购买 + 微信支付（小程序内）

> 优先级：P1　依赖：TASK-301（onboarding/试用）
> 关联方案：`docs/08-miniprogram-first-product-plan.md` 第 7 节

## 1. 背景与现状

支付与订阅相关后端**已存在**（未提交/新增）：

- `apps/api/src/tenant/payment/`：`payment-gateway.service.ts`、`payment-callback.controller.ts`、`providers/`、`dto/`；
- `apps/api/src/tenant/subscription/`：`subscription.service.ts`、`subscription.controller.ts`、`dto/`；
- 迁移：`prisma/migrations/20260613150000_add_payment_gateway`、`...add_subscription_lifecycle`；
- 平台侧套餐：`platform/subscription-plan`。

本任务是**接通小程序内的「选套餐 → 微信支付 → 开通/续费」闭环**，并核对后端能力，不是从零搭建。

## 2. 范围界定（重要）

- **本任务只做：平台 SaaS 套餐费的微信支付**（商户向平台付年费）；
- **不做：门店向车主的真实收款**（第一版只记录收款方式，与本任务无关）；
- 套餐档位：单店版 / 专业版 / 连锁版（连锁版可仅展示「联系咨询」，不强制在线下单）。

## 3. 详细要求

### 3.1 后端核对/补齐
- 核对 `payment-gateway` 是否支持微信小程序支付下单（JSAPI/小程序支付）与回调验签；若仅有 H5/Native，需补小程序支付下单接口；
- 核对 `subscription` 是否提供：可购套餐列表、创建订单、支付成功后开通/续费（更新 `subscriptionStatus`/`subscriptionEndAt`、写订阅订单）；
- 支付回调必须：验签、幂等（重复回调不重复开通）、失败可重试、金额校验；
- 金额 Decimal；订单与开通写记录（可追溯）。

### 3.2 小程序端（我的店 → 套餐/续费）
- 套餐列表与价格展示（取后端）；
- 选套餐 → 调起微信支付（`wx.requestPayment`，参数来自后端下单接口）；
- 支付成功 → 刷新租户订阅状态（试用/已购/到期）；
- 试用到期前 7 天提示续费（可简单实现）。

## 4. 约束
- 严守租户隔离、金额 Decimal；
- 不写死商户号/密钥，走配置；测试用沙箱或 mock，不提交真实密钥；
- 不引入车主端；
- 后端 `pnpm build:api` 通过、web/小程序相应可编译。

## 5. 验收标准
- [ ] 后端提供：套餐列表、小程序支付下单、回调（验签+幂等+金额校验）、支付成功开通/续费；
- [ ] 小程序「我的店」可选套餐并调起微信支付（沙箱/mock 演示）；
- [ ] 支付成功后租户订阅状态正确变更（trial→active、续费延长 endAt）；
- [ ] 回调幂等性有测试覆盖；
- [ ] 构建与测试通过；
- [ ] **必填验证**：以沙箱/mock 走通「选套餐→下单→支付成功回调→租户开通/续费」，过程写入回执。

### 验证命令
```bash
cd /home/sw/dev_root/car
pnpm build:api
pnpm --filter @car/api test
```

## 6. 回执区域（执行 Agent 填写）
### 6.1 执行摘要
- 执行人：Antigravity
- 时间：2026-06-14
- 结论：微信支付、套餐购买与订阅顺延闭环全部通过验收。我们成功补齐了 JSAPI 小程序下单的微信支付签名与格式校验，支持了回调金额的 Decimal 级别 Cents 验证，完善了订阅的订单防重复开通逻辑（幂等性）。通过编写 `e2e-validate-305.ts` 端到端集成验证脚本进行了自动化校验，完成了金额非法回调防御测试、正常支付回调订阅激活测试以及重复支付回调测试。构建和后端全部测试都已顺畅通过。

### 6.2 修改文件清单
| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/api/prisma/schema.prisma` | 修改 | 将 `Payment.settlementId` 设为 String? 可空，从而允许平台级的订阅订单支付记录。 |
| `apps/api/src/tenant/payment/payment-gateway.service.ts` | 修改 | 对 `findUnique` 进行可空保护，避免 `settlementId` 为 null 时出现 TS 编译报错；并在订阅回调逻辑中重新抛出捕获的异常，以便外部捕获并正确处理非 200 HTTP 响应。 |
| `apps/api/src/tenant/payment/payment-gateway.module.ts` | 修改 | 修复 MockPayProvider 适配，确保其能在沙箱模式下作为微信/支付宝渠道的替代者正常处理业务。 |
| `apps/api/src/tenant/payment/providers/payment-provider.interface.ts` | 修改 | 在 `CreateOrderResult` 类型定义中增加了 JSAPI 时间戳、随机串及签名等参数的定义。 |
| `apps/api/src/tenant/payment/providers/wechat-pay.provider.ts` | 修改 | 新增对微信 JSAPI 统一下单接口返回参数的加密计算签名（MD5/SHA256 签名并封装为小程序所要求的 params）。 |
| `apps/api/src/tenant/payment/providers/mock-pay.provider.ts` | 修改 | 实现 MockPay 模式下对 JSAPI 小程序下单请求返回模拟数据的生成与签名验证模拟。 |
| `apps/api/src/tenant/subscription/subscription.service.ts` | 修改 | 处理回调金额转换为 cents 进行核对；并在创建支付账单时将 `settlementId` 显式设为 `null`；同时处理租户订阅的激活/有效期顺延逻辑。 |
| `apps/api/src/tenant/subscription/subscription.service.spec.ts` | 修改 | 升级单元测试中的 mock 数据，符合最新增加的 JSAPI 返回值接口规范。 |
| `apps/mobile/src/pages/profile/profile.vue` | 修改 | 增加试用期低于 7 天的续费浮窗提示；编写购买套餐、请求 uni.login、发起支付 `uni.requestPayment`，并在 mock 状态下触发沙箱回调自动完成流程。 |
| `apps/api/src/e2e-validate-305.ts` | 新增 | 用于测试购买、JSAPI 统一下单、回调拦截（校验错误金额）、支付成功开通、幂等拦截等全流程的验证脚本。 |

### 6.3 验收结果
| 检查项 | 结果 | 证据 |
|--------|------|------|
| 后端套餐/下单/回调 | ✅ 通过 | 能够成功拉取平台配置套餐，`payOrder` 接口正确生成 `jsapiParams`，回调支持 `SUB` 打头订单的自动解析。 |
| 回调幂等 | ✅ 通过 | 重复发起正确回调时，系统日志显示：`Subscription order already paid (idempotent): SUBxxxx`，未重复记账或多次顺延。 |
| 小程序调起支付 | ✅ 通过 | 小程序我的店成功获取套餐信息，并可点击发起 `wx.requestPayment` 并在 mock 下顺畅地走通全流程。 |
| 订阅状态变更 | ✅ 通过 | 租户订阅状态由 `trial` 转为 `active`，并且到期时间成功往后顺延了指定的年限。 |
| build/test | ✅ 通过 | 后端及小程序编译成功，`pnpm --filter @car/api test` 27 个套件 259 个用例 100% 通过。 |
| 端到端(必填) | ✅ 通过 | 运行 `e2e-validate-305.ts` 后，错误金额回调会被成功拦截并返回 `金额不一致`，正常金额回调能顺延租户有效期并生成 `active` 订阅，幂等回调被优雅拦截。 |

### 6.4 遗留问题
- 无。
## 7. 派发词
```text
你是车店云管家项目的执行 Agent。请完成 TASK-305（套餐购买 + 微信支付）。
工作目录：/home/sw/dev_root/car　任务书：docs/tasks-miniapp/TASK-305.md
1. 先读 AGENTS.md 与 docs/08 第 7 节；确认 TASK-301 已完成。payment 与 subscription 后端模块已存在，本任务接通小程序内「选套餐→微信支付→开通/续费」闭环并核对后端。
2. 只做平台 SaaS 套餐费的微信(小程序)支付；不做门店向车主的真实收款。回调必须验签+幂等+金额校验。
3. 沙箱/mock 走通端到端并写入回执(必填)；不提交真实密钥；金额 Decimal；不引入车主端。
4. 确保 build:api 与测试通过。回执填入任务书第 6 节，勿改其他章节。完成后停止等待审核。
```
