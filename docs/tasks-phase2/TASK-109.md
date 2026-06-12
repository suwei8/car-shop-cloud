# TASK-109：车主微信小程序 MVP（查工单 / 卡余额 / 完工通知）

> **优先级**：P2
> **状态**：待派发
> **依赖**：TASK-104（通知基础设施）；建议在 P0/P1 任务全部完成后派发
> **可并行**：TASK-110

## 1. 任务目标

为车主（门店的客户）提供一个微信小程序：扫码/手机号验证后查看自己的维修进度、储值卡/套餐卡余额、历史消费记录。这是小店老板愿意付费的差异化卖点——帮他在车主面前"显得专业"并锁住会员资产。

MVP 范围严格控制为 3 个页面 + 1 套车主侧 API，**不做**在线支付、预约下单、商城。

## 2. 涉及文件

### 后端新建
- `apps/api/src/customer-portal/` — 车主侧独立模块（module/controller/service）
- Prisma migration：`CustomerWxBinding` 模型（openid 与 customer 绑定）

### 小程序新建
- `apps/mini-customer/` — 新 workspace 包，使用 **uni-app（Vue3）编译到微信小程序**（与 apps/mobile 同技术栈，降低维护成本）；不要复用 apps/mobile 代码库，独立新建

### 修改
- `pnpm-workspace.yaml` — 注册新包
- `.env.example` — 微信小程序 appid/secret 配置

## 3. 详细要求

### 3.1 车主身份模型与登录

```prisma
model CustomerWxBinding {
  id         String   @id @default(cuid())
  tenantId   String
  customerId String
  openid     String
  unionid    String?
  createdAt  DateTime @default(now())
  @@unique([tenantId, openid])
  @@index([customerId])
  @@map("customer_wx_bindings")
}
```

登录流程：
1. 小程序 `wx.login` 获取 code → `POST /api/customer-portal/auth/login`（@Public）→ 后端 code2session 换 openid
2. 首次使用需绑定：输入手机号 + 短信验证码（复用 TASK-106 的 sms-code 体系）→ 按手机号匹配 Customer → 建立绑定
3. **多租户归属**：同一手机号可能是多家店的客户。绑定时按手机号查询所有租户下的 Customer，全部绑定；小程序内提供"切换门店"能力（接口返回该 openid 关联的所有 customer + 门店列表）
4. 签发**车主专用 JWT**（payload 含 `customerId/tenantId`、`audience: 'customer'`），现有员工守卫体系必须拒绝该 token 访问商户端接口（实现方式：独立 secret 或 payload 标记 + 守卫校验，回执说明方案）

### 3.2 车主侧 API（全部按 customerId 严格隔离）

- `GET /customer-portal/work-orders` — 本人车辆的工单列表（车牌、状态、进店时间、金额）；进行中的置顶
- `GET /customer-portal/work-orders/:id` — 详情（服务项目、金额、状态时间线）；**不暴露**成本价、内部备注、技师手机号
- `GET /customer-portal/cards` — 储值卡余额 + 套餐卡剩余次数
- `GET /customer-portal/me` — 绑定信息与门店列表、切换门店

### 3.3 小程序页面（3 个）

1. **首页**：当前门店名、进行中工单卡片（状态进度条）、储值卡余额卡片、套餐卡剩余次数
2. **工单列表/详情**：历史工单、点击查看明细
3. **我的**：手机号、切换门店、解绑

UI 干净简洁即可，不追求视觉设计；门店名取自 Shop 数据，体现"这是你常去那家店的小程序"。

### 3.4 完工订阅消息（可选项，做不了就降级）

- 在 TASK-104 的 Notification 体系中新增 channel `wechat_mp`：工单完工时若车主已绑定且已授权订阅消息，发送小程序订阅消息；未授权/未绑定则照旧走短信
- 若微信订阅消息模板审核等外部依赖无法在开发环境完成，可只实现代码与 mock，回执注明

### 3.5 测试

- 车主 token 不能访问商户端接口（守卫测试，必做）
- 车主 API 数据隔离测试：A 车主拿不到 B 车主工单
- 工单详情字段白名单测试（敏感字段不出现）

## 4. 验收标准

- [ ] migration 成功；绑定流程（mock 短信下）走通
- [ ] 车主 JWT 与员工 JWT 完全隔离，互相不可访问对方接口（回执附验证）
- [ ] 三个页面在微信开发者工具中可运行（无 appid 时用测试号说明）
- [ ] 工单/卡余额数据与商户后台一致
- [ ] 多门店客户可切换门店
- [ ] 敏感字段（成本、内部备注）不出现在车主接口响应
- [ ] 新增测试通过；`nest build` 通过；小程序构建（`uni build -p mp-weixin`）通过

## 5. 注意事项

- 车主侧接口独立前缀 `/api/customer-portal/`，独立模块，不要混入 tenant/
- code2session 的 appid/secret 走环境变量；未配置时登录接口返回明确错误而非崩溃
- 小程序内所有请求 BASE_URL 走配置文件（参考 apps/mobile 的配置化方案）
- 本任务工程量较大，若需拆分执行，优先保证后端 API + 隔离测试完整，小程序 UI 可作为第二回执提交

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | （填写） |
| 新建的文件/目录列表 | （填写） |
| 车主/员工 token 隔离方案与验证 | （填写，必填） |
| 数据隔离与字段白名单验证 | （填写，必填） |
| 小程序运行验证方式（开发者工具截图说明/构建日志） | （填写） |
| 构建是否通过（nest build + 小程序构建） | （填写） |
| 测试是否通过（新增用例数） | （填写） |
| 已知限制或遗留问题 | （填写） |
| 执行耗时 | （填写） |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

（待审核）
