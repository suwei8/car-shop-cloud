# TASK-106：商户自助注册与试用开通

> **优先级**：P1
> **状态**：待派发
> **依赖**：TASK-101（试用订阅）、TASK-105（租户初始化器）、TASK-104（短信验证码复用通知模块）
> **可并行**：TASK-107、TASK-108

## 1. 任务目标

潜在客户无需联系销售即可自助开通 14 天试用：注册页填写店名 + 手机号 + 短信验证码 + 密码 → 自动创建租户（走 TASK-105 初始化器）→ 自动开通试用（走 TASK-101）→ 直接进入后台。这是把"销售演示"变成"自助体验"的关键，能极大降低获客成本。

## 2. 涉及文件

### 后端新建
- `apps/api/src/auth/registration.controller.ts` + `registration.service.ts`（或并入 auth 模块）
- 验证码逻辑：`apps/api/src/auth/sms-code.service.ts`

### 后端修改
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/notification/`（复用 SmsProvider 发验证码，新增 scene: `sms_verify_code`）

### 前端新建（apps/web）
- `apps/web/src/views/Register.vue` — 注册页
- `apps/web/src/router/index.ts` — 注册路由（公开）
- `apps/web/src/views/Login.vue` — 增加"免费试用"入口链接

## 3. 详细要求

### 3.1 注册接口（@Public）

- `POST /api/auth/register/send-code`：body `{ phone }`。发送 6 位验证码短信（mock provider 下打日志）
  - 验证码存 Redis（项目 docker-compose 已有 Redis；如 api 尚未接入 redis 客户端，用 `ioredis` 接入），有效期 5 分钟
  - **限流**：同一手机号 60 秒 1 条、每日上限 10 条；同一 IP 每日上限 20 条。超限返回明确错误
- `POST /api/auth/register`：body `{ shopName, phone, code, password }`
  - 校验验证码（一次性，验证后删除）
  - 手机号已注册（User 表存在）→ 报错"该手机号已注册，请直接登录"
  - 创建 Tenant（name = shopName）→ 调 TASK-105 初始化器（管理员手机号 = 注册手机号，密码 = 用户设置的密码而非随机）→ TASK-101 自动开通试用
  - 注册成功直接返回登录态（accessToken + refreshToken + subscription 信息），免二次登录
  - 整体在事务中（验证码消费除外），失败不留半成品租户

### 3.2 密码与安全

- 密码强度：至少 8 位且含字母和数字（class-validator 实现，前后端一致提示）
- 注册接口整体限流（同 IP 每日注册上限 5 个租户）
- 防机器人：暂不接图形验证码，但代码结构预留（限流已是底线防护）

### 3.3 注册页（Web）

- 风格与 Login.vue 一致；字段：店铺名称、手机号、验证码（含 60 秒倒计时按钮）、密码、确认密码
- 显著展示"免费试用 14 天，无需绑卡"
- 注册成功后直接跳转 dashboard，顶部显示试用剩余天数提示条（读取登录响应的 subscription 字段；提示条组件做成全局，trial/grace 状态都显示，suspended 显示红色到期警告）

### 3.4 单元测试

- 验证码：生成、过期、错误码、一次性消费
- 限流：60 秒重发拦截、每日上限
- 注册：手机号重复、密码强度、成功路径（mock 初始化器与订阅服务）

## 4. 验收标准

- [ ] mock 短信模式下完整走通：发码（日志可见）→ 注册 → 自动登录进入 dashboard → 可立即开单（依赖 TASK-105 预置数据）
- [ ] 新租户 `subscriptionStatus = 'trial'`，14 天后到期（数据正确）
- [ ] 验证码 5 分钟过期、错误 5 次内可重试、验证后即失效
- [ ] 重发限流与注册限流生效（回执附验证方式）
- [ ] 手机号重复注册被拦截且提示明确
- [ ] 注册失败（如初始化器异常）不留下孤儿租户数据
- [ ] 试用提示条在 Web 端正常显示剩余天数
- [ ] 新增单元测试通过；`nest build` 与 `vue-tsc` 通过

## 5. 注意事项

- 验证码不要存数据库，必须 Redis；Redis 连接配置走环境变量并更新 `.env.example`
- 验证码在日志中不得明文输出在生产模式（mock 模式可输出便于测试）
- 注册端点务必 `@Public()` 且不受 TenantGuard/SubscriptionGuard 影响
- 不要改动现有登录逻辑，只做增量

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | （填写） |
| 新建的文件列表 | （填写） |
| 端到端验证过程（发码→注册→登录→开单） | （填写，必填） |
| 限流策略验证方式与结果 | （填写） |
| 构建是否通过（nest build + vue-tsc） | （填写） |
| 测试是否通过（新增用例数） | （填写） |
| 已知限制或遗留问题 | （填写） |
| 执行耗时 | （填写） |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

（待审核）
