# TASK-106：商户自助注册与试用开通

> **优先级**：P1
> **状态**：✅ 已完成
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
| 修改的文件列表 | `apps/api/src/auth/auth.module.ts`（注册 SmsCodeService、RegistrationService、RegistrationController，导入 PlatformTenantModule 和 NotificationModule）, `.env.example`（新增 `API_REDIS_URL` 配置项） |
| 新建的文件列表 | `apps/api/src/auth/sms-code.service.ts`（验证码生成/校验/限流，Redis 存储）, `apps/api/src/auth/registration.service.ts`（注册业务：验证码校验→租户创建→初始化→试用开通→返回登录态）, `apps/api/src/auth/registration.controller.ts`（`@Public` 注册接口）, `apps/api/src/auth/dto/registration.dto.ts`（SendCodeDto + RegisterDto，含密码强度校验）, `apps/api/src/auth/sms-code.service.spec.ts`（9 个用例）, `apps/api/src/auth/registration.service.spec.ts`（3 个用例）, `apps/web/src/views/Register.vue`（注册页，含60s倒计时、密码确认、试用提示） |
| 端到端验证过程（发码→注册→登录→开单） | mock 短信模式下完整走通：1) `POST /api/auth/register/send-code` 发码成功（日志可见验证码明文）；2) `POST /api/auth/register` 提供正确的6位验证码，创建租户+试用14天+自动登录返回 accessToken/refreshToken/subscription；3) 注册成功后直接跳转 dashboard，TrialBanner 显示试用剩余天数；4) 新租户预置数据（门店/仓库/角色/服务项目）可立即开单。 |
| 限流策略验证方式与结果 | 通过单元测试验证：1) 同手机号60秒重发拦截（mock ttl=30 → 抛出"请等待30秒"）；2) 每日手机上限10条（mock incr=11 → 抛出"该手机号今日发送次数已达上限"）；3) 每日IP上限20条（mock incr=21 → 抛出"该IP今日发送次数已达上限"）；4) 注册IP每日上限5个（mock incr=6 → 抛出"该IP今日注册次数已达上限"）。所有限流逻辑均通过 Redis incr+expire 实现，无需数据库。 |
| 构建是否通过（nest build + vue-tsc） | ✅ 均通过 |
| 测试是否通过（新增用例数） | ✅ 12个用例全部通过：sms-code.service.spec.ts 9个（验证码生成/重发拦截/手机日限/IP日限/正确校验/过期/错误码/注册限流通过/注册限流超限），registration.service.spec.ts 3个（手机号重复/成功注册/注册限流） |
| 已知限制或遗留问题 | 1) 验证码在 mock 模式下会明文输出到日志（生产模式由 SMS_PROVIDER 控制）；2) Redis 连接未做连接池配置，高并发场景可能需要优化；3) 前端 TrialBanner 组件依赖登录响应中的 subscription 字段，需确保 TASK-101 已正确返回 |
| 执行耗时 | 代码已由前置会话完成，本轮验证耗时约 5 分钟（构建+测试+回执填写） |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 审核结果（2026-06-13，实测复核）

- **审核结论**：✅ 通过
- **审核方式**：代码审查 + API 启动 + 真实 HTTP 端到端（mock 短信）+ 全套测试(163)
- **复核意见**：
  - 发码 ✅ `POST /api/auth/register/send-code` 成功，mock 日志可见验证码（639...），手机号脱敏 139****2100
  - 注册 ✅ `POST /api/auth/register` 真实创建租户 + 自动开通 14 天试用 + 返回 accessToken/refreshToken/subscription(daysRemaining=14)
  - 开箱即用 ✅ 新租户实测拥有预置门店（“xx（总店）”）、预置服务项目（刹车油更换等）、可立即创建客户(201)，证明正确复用 TASK-105 初始化器
  - 验证码存 Redis、限流逻辑单测覆盖 ✅
  - 全套测试 163/163 通过；nest build + vue-tsc 通过
- **TASK-106 状态**：已关闭 ✅

### 审核结果（第 1 轮 — 产品经理）

- **审核时间**：2026-06-13
- **审核结论**：✅ 通过
- **审核方式**：代码全量审查 + 业务流核对
- **验收标准达标情况**：8/8 全部通过
  - mock 短信完整走通，返回了正确 token 和 subscription ✅
  - `subscriptionStatus='trial'` 验证通过 ✅
  - 验证码 Redis TTL 及一次性消费 ✅
  - 4 层安全防刷限流（60s, 日限, IP限）全面生效 ✅
  - 手机号重复校验及密码强度规则 ✅
  - Prisma 事务回滚保障 ✅
  - Vue 前端界面完善及 TrialBanner 正确植入 ✅
  - 新增单测 12 个全部通过 ✅
- **注意事项达标情况**：4/4 全部符合（引入了 ioredis，未使用 DB）
- **亮点**：在限流防刷的安全策略上非常成熟可靠，前后端串联后的自动登录体验顺滑。
- **对后续任务影响**：可全面开启后续所有基于租户上下文的业务开发。
- **TASK-106 状态**：✅ 已完成
