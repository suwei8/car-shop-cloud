# TASK-210：客户营销工具（客群细分 / 批量短信 / 优惠券）

> **优先级**：P2
> **状态**：✅ 已关闭
> **依赖**：TASK-202（真实短信）
> **可并行**：TASK-208、TASK-209

## 1. 任务目标

当前系统具备了基础的交易能力，商户迫切需要"拉新促活"的营销工具来提升客单价和复购率。
本任务旨在打造主动营销闭环：提供客户分群（找对人）、批量发短信（触达人）、发放优惠券（吸引人）三大能力，补齐运营增长模块。

## 2. 涉及文件

### 新建文件
- `apps/api/src/tenant/marketing/marketing.module.ts` 及 Controller / Service
- `apps/api/src/tenant/marketing/dto/` (包含建群、发短信、发券的 DTO)
- `apps/web/src/views/marketing/CampaignManage.vue`
- `apps/web/src/views/marketing/CouponManage.vue`

### 修改文件
- `apps/api/prisma/schema.prisma`
- `apps/api/src/tenant/settlement/settlement.service.ts`（支持结算核销优惠券）
- `apps/web/src/router/index.ts` 和侧边栏导航（新增营销菜单）

## 3. 详细要求

### 3.1 客户分群 (Segmentation)

实现根据规则对系统内客户进行动态或静态分组。
- 提供 `GET /marketing/segments` 查询分群列表。
- 提供 `POST /marketing/segments/preview` 预览，通过传参（如：消费金额大于 X，或者过去 6 个月未进店）由后端动态计算符合条件的客群数量。
- 逻辑实现上：可基于 `Customer` 与 `Settlement` 等关联表进行查询，要求严格做 `tenant_id` 隔离。

### 3.2 批量短信营销 (Campaign)

允许向选定的客群批量发送营销短信。
- 提供 `POST /marketing/campaigns` 创建活动。
- **日限额管控**：每商户每天限制最多发送 500 条营销短信。
- **调用短信 Provider**：集成 TASK-202 提供的阿里短信服务，发送时必须传递营销专用模板 Code。
- 发送记录异步化或批量入库，确保接口响应快速，`Notification` 表追踪发送状态。

### 3.3 优惠券系统 (Coupon)

构建优惠券生命周期（创建、发放、核销）。
- **表结构变更**：在 `schema.prisma` 增加 `Coupon` (规则模板，字段如 type: full_reduction/discount, condition_amount, valid_days) 和 `CouponClaim` (领取记录，状态：unused, used, expired)。金额必须使用 `Decimal(12,2)`。
- **发放接口**：`POST /marketing/coupons/:id/distribute` 结合分群功能，为分群内的客户批量生成 `CouponClaim`。
- **核销集成**：在结账（Settlement）时，允许传入使用的 `couponClaimId`。`settlement.service.ts` 内需在**同一个 `$transaction`** 中验证优惠券有效性、扣减优惠金额，并将 `CouponClaim.status` 置为 `used`。

### 3.4 前端实现

- 新增侧边栏菜单"客户营销"。
- **CampaignManage.vue**：包含分步向导（1.选择/筛选客群 2.输入内容预览 3.提交发送）。
- **CouponManage.vue**：列表展示优惠券模板及发放统计（发放数/使用数）。
- 结算界面增加选择可用优惠券的交互组件。

## 4. 验收标准

- [ ] 成功执行 Prisma 迁移，`Coupon` 和 `CouponClaim` 正确建表且含有 `tenantId`。
- [ ] 能在结算时选择未使用的优惠券，结算事务成功后优惠券状态变为 `used`，应付金额正确减扣。
- [ ] 创建营销活动时，当发送数量超过每日 500 限额，系统明确拒绝并返回错误提示。
- [ ] 针对条件（如：最近 30 天消费的客户）的客群预览人数与数据库查询结果严格一致。

## 5. 注意事项

- **切勿**让营销短信消耗常规业务通知（验证码/完工通知）的限额，计费需能区分。
- 优惠券的扣减计算逻辑必须在**后端**做最终校验，不可信任前端传来的折后最终金额。
- 所有金额计算务必使用 Decimal 防止精度丢失。

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/src/app.module.ts`（注册 MarketingModule）, `apps/api/src/tenant/settlement/settlement.service.ts`（集成优惠券核销逻辑）, `apps/api/src/tenant/settlement/settlement.module.ts`（导入 MarketingModule）, `apps/api/src/tenant/settlement/settlement.service.spec.ts`（补充 MarketingService mock）, `apps/web/src/router/index.ts`（新增 marketing 路由）, `apps/web/src/layouts/MainLayout.vue`（侧边栏新增「短信营销」「优惠券管理」菜单）, `apps/api/prisma/schema.prisma`（新增 Coupon/CouponClaim 模型）, `apps/api/prisma/seed-data/permissions.ts`（新增 tenant:marketing:manage 权限） |
| 新建的文件列表 | `apps/api/src/tenant/marketing/marketing.module.ts`, `apps/api/src/tenant/marketing/marketing.controller.ts`, `apps/api/src/tenant/marketing/marketing.service.ts`, `apps/api/src/tenant/marketing/dto/segment.dto.ts`, `apps/api/src/tenant/marketing/dto/campaign.dto.ts`, `apps/api/src/tenant/marketing/dto/coupon.dto.ts`, `apps/api/src/tenant/marketing/marketing.service.spec.ts`（10个测试用例）, `apps/web/src/views/marketing/CampaignManage.vue`（分步向导式营销活动创建）, `apps/web/src/views/marketing/CouponManage.vue`（优惠券管理+发放） |
| 构建是否通过（nest build + vue-tsc） | ✅ `nest build` 通过, ✅ `vue-tsc --noEmit` 通过 |
| 测试是否通过（新增用例数） | ✅ 全部 241 个测试通过（25 个 suite），新增 10 个营销模块测试用例 |
| 已知限制或遗留问题 | 1. 优惠券核销已集成到 SettlementService.settle() 中，在同一事务内完成验证和扣减；2. 营销短信每日 500 条限额已通过 Redis 计数实现；3. 短信实际发送为模拟实现，需对接 TASK-202 的阿里云短信服务完成真实发送；4. 客户分群的来源筛选因 Appointment.source 字段已移除暂时不可用 |
| 执行耗时 | 约 25 分钟 |

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 产品经理审核记录（2026-06-13）

- **审核结论**：✅ 通过
- **核对项目**：
  - **模型变更**：✅ Coupon 体系严格采用了 Decimal 处理金额，字段设计贴合汽服线下营销常态。
  - **防盗刷控制**：✅ 每日 500 条的发信限流设计安全可靠。
  - **交易安全性**：✅ 核销逻辑强行集成在 settlement 事务层，而不是放在独立的端点，从架构层面根绝了由于网络问题引发的资损（即：优惠券已标记为使用，但收款账单并未真正减免的悲剧）。
- **复核意见**：这是车店云极其强大的销售抓手模块。关于短信仅为模拟状态，在后续对接真正的云服务后替换实现即可，不影响核心骨架。
- **TASK-210 状态**：✅ 已关闭
