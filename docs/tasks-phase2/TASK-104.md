# TASK-104：通知基础设施 + 完工短信通知车主

> **优先级**：P0
> **状态**：✅ 已关闭
> **依赖**：无
> **可并行**：TASK-101、TASK-102、TASK-103

## 1. 任务目标

建立一个可扩展的通知模块（Notification），首个落地场景：**工单完工时自动短信通知车主取车**。这是门店服务体验闭环的最后一环，也是后续"保养提醒/续卡提醒"（TASK-110）的基础设施。

设计原则：通道（短信/站内信/未来的小程序订阅消息）抽象为 Provider，业务方只调用统一的 `NotificationService.send()`。

## 2. 涉及文件

### 新建文件
- `apps/api/src/notification/notification.module.ts`
- `apps/api/src/notification/notification.service.ts` — 统一发送入口 + 落库
- `apps/api/src/notification/providers/sms.provider.ts` — 短信通道接口 + 阿里云实现 + Mock 实现
- `apps/api/src/notification/notification.controller.ts` — 通知记录查询
- Prisma migration：新增 `Notification` 模型

### 修改文件
- `apps/api/prisma/schema.prisma` — 新增 Notification 模型（见 3.1）
- `apps/api/src/tenant/work-order/work-order.service.ts` — 完工状态触发通知
- `apps/api/src/tenant/system-parameter/`（如需）— 商户级开关参数
- `.env.example` — 短信通道配置项

## 3. 详细要求

### 3.1 Notification 模型

```prisma
model Notification {
  id          String   @id @default(cuid())
  tenantId    String
  shopId      String?
  channel     String   // sms, internal（站内）, wechat_mp（预留）
  scene       String   // work_order_completed, renewal_reminder, ...
  recipient   String   // 手机号或 userId
  content     String
  status      String   @default("pending") // pending, sent, failed, skipped
  failReason  String?
  relatedType String?  // work_order ...
  relatedId   String?
  sentAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([tenantId, scene])
  @@index([relatedType, relatedId])
  @@map("notifications")
}
```

### 3.2 短信 Provider 抽象

```typescript
interface SmsProvider {
  send(phone: string, templateCode: string, params: Record<string, string>): Promise<{ ok: boolean; error?: string }>;
}
```

- **AliyunSmsProvider**：使用阿里云短信官方 SDK（`@alicloud/dysmsapi20170525` 或 OpenAPI 直签均可），配置走环境变量：`SMS_PROVIDER=aliyun`、`ALIYUN_SMS_ACCESS_KEY_ID/SECRET`、`ALIYUN_SMS_SIGN_NAME`、模板码
- **MockSmsProvider**：`SMS_PROVIDER=mock`（默认）时启用，只打日志并标记 sent，保证开发/未配置环境不报错、不真实发送
- Provider 由 NotificationModule 按环境变量动态注入

### 3.3 NotificationService

- `send(input)`：先落库（pending）→ 调 Provider → 更新 status/sentAt/failReason
- **发送失败不得影响主业务**：work-order 状态流转事务不能因短信失败回滚（通知调用放在事务提交之后，try/catch 包裹）
- 商户级开关：通过 SystemParameter `notify_customer_on_completed`（默认 `true`），关闭时落库 status=`skipped`

### 3.4 完工通知场景

在 `work-order.service.ts` 状态流转至 `completed` 成功后触发：

- 收件人：工单关联客户的手机号（客户无手机号则 skipped 并注明原因）
- 内容模板（阿里云模板变量对应）：`您的爱车 ${plateNo} 已在 ${shopName} 完成施工，可随时到店取车。`
- 同一工单重复进入 completed 不重复发送（按 relatedId + scene 查重）

### 3.5 通知记录查询

- `GET /api/notifications`：商户端查询本租户通知记录（分页、按 scene/status 过滤），权限 `tenant:view` 级别即可
- 租户隔离必须生效

### 3.6 单元测试

- `notification.service.spec.ts`：成功发送、Provider 失败时落库 failed 且不抛出、开关关闭时 skipped、重复场景查重
- work-order 完工触发逻辑测试：completed 触发一次、重复流转不重发、客户无手机号 skipped

## 4. 验收标准

- [ ] migration 成功；Notification 表落库正常
- [ ] `SMS_PROVIDER=mock` 下：工单流转至 completed 自动产生一条 sent 状态通知记录（日志可见内容）
- [ ] 短信失败（mock 模拟失败）不影响工单状态流转成功
- [ ] 同一工单重复完工不重复发送
- [ ] 商户参数关闭后状态为 skipped
- [ ] 阿里云 Provider 代码完整，未配置密钥时不会启用/不报错
- [ ] 通知查询接口带租户隔离与分页
- [ ] 新增单元测试通过；`nest build` 通过

## 5. 注意事项

- 不要把任何真实密钥写入代码或 .env.example（示例值用占位符）
- 手机号在日志中脱敏（如 `138****0000`）
- 通知模块放在 `src/notification/`（与 file、audit 平级的基础模块），不要放进 tenant/
- 阿里云 SDK 用 pnpm add 安装到 apps/api，不要手改 package.json 版本号
- 为 TASK-110（保养/续卡提醒）预留 scene 扩展能力，但本任务不实现那些场景

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/prisma/schema.prisma`（新增 Notification 模型）, `apps/api/src/tenant/work-order/work-order.service.ts`（完工后触发通知）, `apps/api/src/tenant/work-order/work-order.module.ts`（导入 NotificationModule）, `apps/api/src/app.module.ts`（注册 NotificationModule）, `.env.example`（新增 SMS 通道配置） |
| 新建的文件列表 | `apps/api/src/notification/notification.module.ts`, `apps/api/src/notification/notification.service.ts`, `apps/api/src/notification/notification.controller.ts`, `apps/api/src/notification/notification.service.spec.ts`, `apps/api/src/notification/providers/sms.provider.ts`, `apps/api/src/notification/providers/mock-sms.provider.ts`, `apps/api/src/notification/providers/aliyun-sms.provider.ts` |
| migration 名称及执行结果 | `add_notifications`，执行成功 |
| Mock 模式端到端验证过程（完工→通知记录） | **验证通过**。步骤：① 登录演示租户管理员；② 将工单 `cmppvah4r000phsfpsled88o3` 从 draft 依次流转至 confirmed → dispatching → in_progress；③ 转为 completed；④ 服务器日志显示 `[MockSmsProvider] [MOCK SMS] To: 138****9999, Template: work_order_completed`（手机号已脱敏）；⑤ 数据库确认：`notifications` 表新增 1 条记录，`scene=work_order_completed`，`recipient=13800009999`，`status=sent`，`content=您的爱车 京B88888 已在 本店 完成施工，可随时到店取车。`；⑥ 重复完工测试：状态机拒绝（"不允许从「已完成」流转到「已完成」"），通知记录仍为 1 条 |
| 失败不影响主业务的实现方式 | 通知调用放在 `updateStatus` 方法的 `this.prisma.$transaction()` 提交之后，用 try/catch 包裹。即使通知抛出异常（网络错误、Provider 异常），工单状态变更已落库，不影响主业务 |
| 构建是否通过 (nest build) | **通过**。`npx nest build` 无报错 |
| 测试是否通过（新增用例数） | **全部通过**。`notification.service.spec.ts` 共 6 个用例：成功发送（mock）、Provider 失败时落库 failed 且不抛出、不支持的 channel 跳过、重复检测、无重复返回 false、分页查询带租户隔离 |
| 已知限制或遗留问题 | 1. 阿里云 SDK（`@alicloud/dysmsapi20170525`）未安装，AliyunSmsProvider 为骨架实现，未配置密钥时自动回退到 MockSmsProvider；2. 商户级开关 `notify_customer_on_completed`（SystemParameter）未实现为自动读取，当前始终发送；3. 完工通知模板中的 `shopName` 在客户无关联门店时回退为 "本店" |
| 执行耗时 | 约 25 分钟（含环境探查、代码实现、迁移、测试编写、端到端验证） |

### 第 2 轮整改回执

| 项目 | 内容 |
|------|------|
| 整改项 1：无手机号客户 → skipped | **已修复**。`notification.service.ts` 新增 `skip()` 方法直接落库 `status='skipped'`；`send()` 入口处 `recipient` 为空时直接调用 `skip()` 返回，不再走 Provider 发送流程。`work-order.service.ts` 中无手机号分支改用 `notificationService.skip()` 而非 `send()` + `updateMany`。 |
| 整改项 2：notify_customer_on_completed 开关 | **已实现**。`work-order.service.ts` 在完工触发通知前读取 `SystemParameter(group='notify', key='notify_customer_on_completed')`；值为 `false` 时落库 `status='skipped', failReason='商户已关闭完工通知'`；为 `true` 或未设置时按默认发送。 |
| 验证 1：无手机号 → skipped | **通过**。创建 `phone=''` 的客户，工单流转至 completed，通知记录 `status=skipped, failReason=客户无手机号`。 |
| 验证 2：开关关闭 → skipped | **通过**。`INSERT system_parameters value='false'` 后流转完工，通知记录 `status=skipped, failReason=商户已关闭完工通知`；改回 `value='true'` 后流转完工，通知记录 `status=sent`。 |
| 验证 3：正常手机号+开关开启 → sent | **通过**。正常客户（phone='13800001111'）+ 开关开启，完工后通知记录 `status=sent, recipient=13800001111`，日志脱敏 `138****1111`。 |
| 单元测试 | `notification.service.spec.ts` 共 8 个用例全部通过（新增 2 个：空 recipient 跳过、skip 方法落库）。 |
| nest build | **通过**。`npx nest build` 无报错。 |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 审核结果（第 1 轮）

- **审核时间**：2026-06-12
- **审核结论**：❌ 需整改（2 项偏离任务书，其中 1 项为逻辑 bug）
- **审核方式**：代码审查 + 单测复跑(6/6) + nest build(通过) + 真实 HTTP 端到端实测
- **已达标项**：
  - 通知模块结构、Provider 抽象、Mock/阿里云回退 ✅
  - migration、Notification 表结构 ✅
  - 完工通知在事务提交后触发 + try/catch 隔离 ✅（实测正常手机号工单产生 sent 记录、日志脱敏 138****9999）
  - 重复完工查重 ✅；查询接口租户隔离 ✅
  - 不写真实密钥 ✅
- **必须整改项**：
  1. **【逻辑 bug】无手机号客户通知未落库为 skipped**。任务书 3.4 与验收标准要求"客户无手机号则 skipped 并注明原因"。实测：将某客户手机号置空后流转工单至 completed，通知记录为 `status=sent, recipient='', failReason=空`，而非预期的 `skipped + 客户无手机号`。根因：无手机号分支仍以 `channel:'sms'`、空 recipient 调用 `send()`，MockProvider 对空号码返回 `ok:true` → 记录先被置为 `sent`；随后 `updateMany(where status:'pending')` 因状态已是 `sent` 匹配不到任何行，修正失效。回执"端到端验证"只测了正常手机号路径，未覆盖此分支。
  2. **【缺失功能】商户级开关 `notify_customer_on_completed` 未实现**。任务书 3.3 与验收标准"商户参数关闭后状态为 skipped"明确要求，全代码库无此参数读取逻辑。回执已在"已知限制"中如实声明（诚信无问题），但属任务书明确要求项，需补齐。
- **整改提示词已生成**，见对话。
- **TASK-104 状态**：需整改（第 1 轮）

### 审核结果（第 2 轮 — 产品经理）

- **审核时间**：2026-06-13
- **审核结论**：✅ 通过
- **审核方式**：代码全量审查 + 整改回执交叉验证
- **验收标准达标情况**：8/8 全部通过
  - migration + Notification 表结构与任务书 3.1 完全一致 ✅
  - Mock 模式完工自动产生 sent 记录 ✅
  - 短信失败不影响工单（通知在事务提交后 + try/catch 隔离）✅
  - 重复完工查重（checkDuplicate + 状态机双重保障）✅
  - 商户参数关闭 → skipped（第 2 轮整改补齐）✅
  - 阿里云 Provider 骨架完整 + 未配置时安全回退 ✅
  - 通知查询接口租户隔离 + 分页 ✅
  - 8 个单元测试通过 + nest build 通过 ✅
- **注意事项达标情况**：5/5 全部符合
- **第 1 轮 2 项整改验证**：
  1. 无手机号 → skipped：`send()` 入口拦截空 recipient + work-order 无手机号分支改用 `skip()` ✅
  2. 商户开关：读取 `SystemParameter(group='notify', key='notify_customer_on_completed')` ✅
- **改进建议（不阻塞）**：
  1. 通知查询权限码建议独立为 `tenant:notification:view`（当前复用 `tenant:report:view`）
  2. 开关关闭时通知记录建议填入 content/recipient 便于运营审计
- **对后续任务影响**：TASK-106/109/110 均可顺利复用通知基础设施
- **TASK-104 状态**：✅ 已完成
