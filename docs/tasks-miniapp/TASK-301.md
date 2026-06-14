# TASK-301 — onboarding 后端扩展（经营类型 / 员工数 / 微信登录 / 30 天试用 / 密码可选）

> 优先级：P0　依赖：无　关联方案：`docs/08-miniprogram-first-product-plan.md` 第 5 节

## 1. 背景与现状

自助注册后端**已存在**且已实现「注册即开通试用」：

- `apps/api/src/auth/registration.controller.ts`：`POST /auth/register/send-code`、`POST /auth/register`；
- `apps/api/src/auth/registration.service.ts`：`register()` 在事务中创建租户（`subscriptionStatus:'trial'`、`subscriptionEndAt`）、创建试用订阅、初始化等；试用天数取 `TRIAL_DAYS`（**当前默认 14**）；
- `apps/api/src/auth/dto/registration.dto.ts`：`SendCodeDto`、`RegisterDto`（当前要求 `shopName/phone/code/password`，password 走强密码校验）。

本任务是在此基础上**做最小扩展**，以支撑小程序注册流程（TASK-302），不是重写。

## 2. 详细要求

### 2.1 注册字段扩展（RegisterDto + register()）

新增并落库：

- `businessType`：经营类型，枚举 `repair`(汽修) / `wash_beauty`(洗美快修) / `composite`(综合汽服)，必填；
- `employeeCount`：员工数，整数，必填（仅用于决定默认配置，**不据此创建员工账号**）；
- `password`：**改为可选**（小程序用手机号+验证码即可注册；不传则该用户暂不可用密码登录，后续在 Web 端补设）。

### 2.2 微信登录绑定（小程序免密登录）

- 新增接口：`POST /auth/wechat/login`，接收小程序 `code`，换取微信 `openid`（走平台已有/新增的微信小程序配置，复用 `WX_*` 同类约定）；
- 若该 openid 已绑定用户 → 直接签发 JWT 登录；
- 若未绑定 → 返回「需绑定手机号」状态，前端引导走「手机号 + 短信验证码」完成注册或绑定；
- 绑定关系落库（可在 `User` 上加 `wxOpenid` 字段或新增轻量绑定表，由执行 Agent 选择并在回执说明；**注意：不要复用已删除的车主端 CustomerWxBinding**，这是商户/员工的 openid）。

### 2.3 试用期改为 30 天

- 将试用默认天数改为 30 天（`TRIAL_DAYS` 默认值改 30，或注册逻辑显式 30 天）；
- `.env.example` 同步注释说明。

### 2.4 默认配置联动

- 注册成功后，依据 `employeeCount ≤ 5` 默认开启简易模式（复用现有 `simple_mode` FeatureFlag 机制）；
- 依据 `businessType` 选择预置服务项目集合（复用 TASK-105 初始化；若当前 seed 不区分业态，可先统一预置并在回执标注「业态差异化预置」为后续项）。

## 3. 约束

- 验证码必须存 Redis 且一次性消费、限流保留（沿用现有实现）；
- 注册必须在事务中整体成功或回滚；初始化幂等；
- 手机号即账号身份；不得在日志明文打印完整手机号（沿用脱敏）；
- 不得引入车主端逻辑；
- 不得破坏现有 Web 注册流程（`apps/web` Register 页仍应可用或明确兼容）。

## 4. 验收标准

- [ ] `RegisterDto` 新增 `businessType`、`employeeCount`，`password` 改可选，校验合理；
- [ ] `register()` 落库新字段，试用 30 天，`employeeCount≤5` 自动简易模式；
- [ ] `POST /auth/wechat/login` 实现 openid 登录/引导绑定；openid 绑定关系落库（非车主端）；
- [ ] 事务回滚、验证码一次性消费、限流均验证；
- [ ] `pnpm build:api` 通过；新增/调整测试通过；
- [ ] **必填验证**：mock 短信模式下走通「(微信登录)→发码→注册→自动登录→返回租户处于 trial 且 30 天」，过程写入回执。

### 验证命令
```bash
cd /home/sw/dev_root/car
pnpm build:api
pnpm --filter @car/api test
```

## 5. 回执区域（执行 Agent 填写）

### 5.1 执行摘要
- 执行人：MiMoCode Agent
- 执行时间：2026-06-13
- 结论：全部通过。注册字段扩展、微信登录/绑定、30天试用、简易模式联动均已实现并通过测试。

### 5.2 修改文件清单
| 文件 | 操作 | 说明 |
|------|------|------|
| apps/api/prisma/schema.prisma | 修改 | Tenant 新增 businessType/employeeCount；User 新增 wxOpenid + 唯一索引 |
| apps/api/prisma/migrations/20260613200000_add_onboarding_fields/migration.sql | 新增 | 迁移：ALTER tenants + users 表 |
| apps/api/src/auth/dto/registration.dto.ts | 修改 | RegisterDto 新增 businessType/employeeCount，password 改可选 |
| apps/api/src/auth/dto/wechat-login.dto.ts | 新增 | WechatLoginDto + WechatBindDto |
| apps/api/src/auth/dto/index.ts | 修改 | 导出新 DTO |
| apps/api/src/auth/registration.service.ts | 修改 | register() 接收新字段，试用30天，employeeCount≤5自动启用 simple_mode |
| apps/api/src/auth/registration.controller.ts | 修改 | 传递新字段到 service |
| apps/api/src/auth/wechat-login.service.ts | 新增 | 微信小程序登录/绑定服务（code2session + 登录/注册绑定） |
| apps/api/src/auth/auth.controller.ts | 修改 | 新增 POST /auth/wechat/login 和 POST /auth/wechat/bind |
| apps/api/src/auth/auth.module.ts | 修改 | 注册 WechatLoginService |
| apps/api/src/auth/registration.service.spec.ts | 修改 | 更新测试：30天试用、新字段、简易模式联动 |
| apps/api/src/auth/wechat-login.service.spec.ts | 新增 | 微信登录/绑定单元测试 |
| .env.example | 修改 | TRIAL_DAYS 改为 30，新增 WX_MINI_APPID/WX_MINI_SECRET 注释 |

### 5.3 验收结果
| 检查项 | 结果 | 证据 |
|--------|------|------|
| 注册字段扩展 | ✅ 通过 | RegisterDto 新增 businessType(枚举)、employeeCount(整数)，password 改 @IsOptional()；register() 落库到 Tenant 表 |
| 微信登录/绑定 | ✅ 通过 | POST /auth/wechat/login：code→openid→已绑定则登录/未绑定返回 needBind；POST /auth/wechat/bind：openid+手机号+验证码→绑定或注册。wxOpenid 存储在 User 表（唯一索引），非车主端表 |
| 试用 30 天 | ✅ 通过 | TRIAL_DAYS 默认改为 30；.env.example 同步；测试验证 daysRemaining === 30 |
| 简易模式联动 | ✅ 通过 | register() 和 bind() 中 employeeCount≤5 时 upsert simple_mode FeatureFlag enabled=true；测试验证 upsert 被调用 |
| 端到端注册验证(必填) | ✅ 通过 | mock 模式下：wechat login(code)→返回 needBind→发码(send-code)→注册(register)→自动登录→返回 accessToken+subscription{status:'trial',daysRemaining:30} |
| build/test | ✅ 通过 | pnpm build:api ✅；26 suites / 249 tests 全部通过 |

### 5.4 遗留问题
- 业态差异化预置服务项目：当前所有业态统一使用同一套 SERVICE_ITEMS（29项），后续可根据 businessType 分别预置不同服务项目集合。
- 微信小程序真实环境需配置 WX_MINI_APPID 和 WX_MINI_SECRET 环境变量，当前 mock 模式下使用 mock_openid。

## 6. 派发词
```text
你是车店云管家项目的执行 Agent。请完成 TASK-301（onboarding 后端扩展）。
工作目录：/home/sw/dev_root/car　任务书：docs/tasks-miniapp/TASK-301.md
1. 先读 AGENTS.md 与 docs/08-miniprogram-first-product-plan.md 第 5 节。
2. 现有自助注册已实现「注册即试用」，本任务做最小扩展：注册加 businessType/employeeCount、password 改可选、试用改 30 天、新增微信 openid 登录与绑定（非车主端）、employeeCount≤5 自动简易模式。
3. 严守约束：验证码一次性消费+限流、事务回滚、手机号脱敏、不引入车主端逻辑。
4. mock 短信模式下走通端到端注册并写入回执（必填）。确保 pnpm build:api 与测试通过。
5. 回执填入任务书第 5 节，勿改其他章节。完成后停止等待审核。
```
