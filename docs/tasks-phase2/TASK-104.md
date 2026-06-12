# TASK-104：通知基础设施 + 完工短信通知车主

> **优先级**：P0
> **状态**：待派发
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
| 修改的文件列表 | （填写） |
| 新建的文件列表 | （填写） |
| migration 名称及执行结果 | （填写） |
| Mock 模式端到端验证过程（完工→通知记录） | （填写，必填） |
| 失败不影响主业务的实现方式 | （填写） |
| 构建是否通过 (nest build) | （填写） |
| 测试是否通过（新增用例数） | （填写） |
| 已知限制或遗留问题 | （填写） |
| 执行耗时 | （填写） |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

（待审核）
