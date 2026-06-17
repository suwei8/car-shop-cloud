# TASK-109：车主微信小程序 MVP（查工单 / 卡余额 / 完工通知）

> 状态说明：该任务已被当前产品方向废弃，仅作历史参考。

> **优先级**：P2
> **状态**：❌ 已废弃/历史保留
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
| 修改的文件列表 | `apps/api/prisma/schema.prisma`（新增 CustomerWxBinding 模型及 Tenant/Customer 关系字段）, `packages/shared/src/types/index.ts`（JwtPayload 新增 audience/customerId 字段）, `packages/shared/src/types/index.d.ts`（同步更新编译产物）, `apps/api/src/common/guards/jwt-auth.guard.ts`（customer-portal 路径跳过全局 Guard；audience=customer 的 token 访问商户端接口抛出 ForbiddenException）, `apps/api/src/auth/jwt.strategy.ts`（拒绝 audience=customer token；为 employee token 标记 audience）, `apps/api/src/auth/auth.service.ts`（login/refresh 签发 audience='employee' JWT）, `apps/api/src/app.module.ts`（注册 CustomerPortalModule）, `apps/api/src/notification/notification.service.ts`（集成 WechatMpProvider，支持 wechat_mp channel，新增 sendWechatMpOrFallback 方法）, `.env.example`（新增 JWT_CUSTOMER_SECRET / WX_MINI_APPID / WX_MINI_SECRET / WX_TPL_WORK_ORDER_COMPLETED） |
| 新建的文件/目录列表 | `apps/api/src/customer-portal/`（整个模块目录）：`customer-jwt.strategy.ts`（jwt-customer passport 策略，独立 secret，校验 audience=customer）, `customer-jwt-auth.guard.ts`（车主端 Guard，使用 jwt-customer 策略）, `customer-portal-auth.service.ts`（wx.login 换 openid、手机号绑定、多租户绑定、签发车主 JWT、切换门店）, `customer-portal.service.ts`（工单列表/详情、储值卡/套餐卡查询，按 customerId 严格隔离，select 白名单排除敏感字段）, `customer-portal.controller.ts`（/api/customer-portal/ 前缀，含 auth/me/bindings/work-orders/cards 端点）, `customer-portal.module.ts`（模块定义，注册 CustomerJwtStrategy + SmsCodeService）, `dto/customer-portal.dto.ts`（WxLogin/Bind/SwitchShop DTO）, `customer-jwt-auth.guard.spec.ts`（7 个隔离测试用例）, `customer-portal.service.spec.ts`（7 个数据隔离+字段白名单测试）, `customer-portal-auth.service.spec.ts`（8 个认证/绑定测试）; `apps/api/src/notification/providers/wechat-mp.provider.ts`（微信订阅消息 provider，支持 mock 模式）; `apps/mini-customer/`（整个小程序项目）：`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/manifest.json`, `src/App.vue`, `src/main.ts`, `src/pages.json`, `src/utils/api.ts`, `src/stores/auth.ts`, `src/pages/index/index.vue`（首页：门店名+工单进度条+储值卡+套餐卡）, `src/pages/work-orders/index.vue`（工单列表）, `src/pages/work-orders/detail.vue`（工单详情）, `src/pages/my/index.vue`（我的：绑定手机号+切换门店） |
| 车主/员工 token 隔离方案与验证 | **方案**：采用"双密钥 + 双策略 + 双重守卫"三层隔离。① 双密钥：员工 JWT 用 `JWT_SECRET`，车主 JWT 用 `JWT_CUSTOMER_SECRET`（独立密钥，fallback 为 `JWT_SECRET:customer`），两个 passport strategy 各自验证对应密钥签发的 token，密钥不同则签名校验天然隔离。② 双策略：`JwtStrategy`（name='jwt'）在 validate 中检查 `audience==='customer'` 则拒绝；`CustomerJwtStrategy`（name='jwt-customer'）在 validate 中检查 `audience!=='customer'` 则拒绝。③ 双重守卫：全局 `JwtAuthGuard` 对路径包含 `/customer-portal/` 的请求跳过（交由 controller 级 `CustomerJwtAuthGuard` 处理），对其它路径校验后额外检查 `user.audience==='customer'` 则抛出 `ForbiddenException`。**测试验证**（7 个用例全部通过）：① `customer-jwt-auth.guard.spec.ts` 中 "车主 Token 访问商户端接口：抛出 ForbiddenException" ✅；② "员工 Token 访问商户端接口：正常通过" ✅；③ "@Public() 路由：跳过 JWT 校验" ✅；④ "customer-portal 路由：全局 Guard 跳过" ✅；⑤ `CustomerJwtStrategy` 验证 audience=customer 的 payload 通过 ✅；⑥ audience=employee 的 payload 被拒绝 ✅；⑦ 缺少 customerId 的 payload 被拒绝 ✅。 |
| 数据隔离与字段白名单验证 | **数据隔离**（3 个用例全部通过）：① 工单列表严格按 `customerId + tenantId` 过滤（WHERE 断言验证）；② A 车主无法查看 B 车主工单详情（findFirst 返回 null → NotFoundException）；③ 储值卡/套餐卡查询同样按 customerId + tenantId 隔离。**字段白名单**（4 个用例全部通过）：工单详情使用 Prisma `select` 白名单，显式排除 `remark`（内部备注）、`advisorId`（服务顾问）、`technicianId`（技师 ID）、`costPrice`（成本价）、`partId`（配件内部 ID）等敏感字段；工单列表同样不包含 `advisorId` 和 `remark`；返回 JSON 中不包含任何手机号字段。 |
| 小程序运行验证方式 | 使用 `uni build -p mp-weixin` 编译成功，输出 `dist/build/mp-weixin` 目录，提示"Run method: open Weixin Mini Program Devtools, import dist/build/mp-weixin run"。开发环境无真实 appid，使用微信开发者工具测试号模式导入即可运行。H5 模式 `uni` 可启动 dev server 在浏览器中调试。 |
| 构建是否通过（nest build + 小程序构建） | ✅ nest build 通过（无错误），✅ `uni build -p mp-weixin` 通过（Compiler version: 5.11 vue3, Build complete） |
| 测试是否通过（新增用例数） | ✅ 全部通过。新增 22 个测试用例（customer-jwt-auth.guard.spec 7 个 + customer-portal.service.spec 7 个 + customer-portal-auth.service.spec 8 个）。总计 146 个测试全部通过（16 个测试套件）。 |
| 已知限制或遗留问题 | 1. **Prisma migration**：`CustomerWxBinding` 模型已定义在 schema.prisma 中且 `prisma generate` 成功，但 `prisma migrate dev` 需要运行中的 PostgreSQL 实例，部署时执行 `pnpm db:migrate` 即可生成并应用迁移。2. **微信订阅消息**：`WechatMpProvider` 已实现完整的 subscribe message 发送逻辑（含 access_token 缓存），但未配置 `WX_MINI_APPID/SECRET` 时自动进入 mock 模式（`isConfigured()=false`，返回 `{ok: true}`），回执中视为"代码与 mock 完整，真实发送需配置 appid"。3. **完工通知集成**：`NotificationService.sendWechatMpOrFallback` 已实现"优先微信订阅消息 → 降级短信"策略，但 `work-order.service.ts` 中当前的完工通知仍走纯短信通道（因需查询 CustomerWxBinding 的 customerId，现有 work-order 通知逻辑仅有 customerPhone），后续可替换为 `sendWechatMpOrFallback` 调用。4. **小程序 UI**：3 个页面（首页/工单/我的）已实现核心功能，视觉设计较为基础，未做复杂交互和错误边界处理。5. **BASE_URL 配置**：小程序通过 `VITE_API_BASE_URL` 环境变量配置，默认空字符串（同域部署），生产环境需在构建时注入。 |
| 执行耗时 | 约 40 分钟（含后端模块开发、隔离架构设计、小程序项目创建、测试编写、构建验证） |

### 第 2 轮整改回执（2026-06-13）

| 项目 | 内容 |
|------|------|
| 缺陷描述 | `NotificationService` 构造函数注入了 `WechatMpProvider`（index [2]），但 `NotificationModule` 未将其注册为 provider，导致 Nest DI 无法解析依赖，`node dist/apps/api/src/main.js` 启动即崩溃。 |
| 修改的文件 | `apps/api/src/notification/notification.module.ts`（providers 数组新增 `WechatMpProvider`）；`apps/api/src/notification/notification.service.ts`（构造函数 `wechatMpProvider` 参数增加 `@Optional()` 装饰器，import 新增 `Optional`） |
| 修复方案 | 双保险：① 在 `NotificationModule.providers` 中注册 `WechatMpProvider`（其依赖 `ConfigService` 由全局 `ConfigModule` 提供，`PrismaService` 由已导入的 `PrismaModule` 提供，均可解析）；② 构造函数参数加 `@Optional()` 确保即使未来 provider 注册遗漏也不会导致启动崩溃（fallback 逻辑 `wechatMpProvider \|\| new WechatMpProvider(config, prisma)` 已有保底）。业务逻辑和安全隔离设计完全不变。 |
| nest build | ✅ 通过（无错误） |
| node dist/apps/api/src/main.js 实际启动 | ✅ 通过。日志确认 `NotificationModule dependencies initialized`、所有路由注册成功，最终输出 `Nest application successfully started`，无任何 DI 报错。关键日志片段：`[InstanceLoader] NotificationModule dependencies initialized +0ms` … `[NestApplication] Nest application successfully started +163ms` |
| pnpm --filter api test | ✅ 全部通过。18 个测试套件，163 个测试用例，0 失败。 |
| 登录后调用普通接口 | ✅ `POST /api/auth/login`（phone=13900000001）→ 获得 accessToken（1125 字符）→ `GET /api/customers` 返回 HTTP 200，`code: 0`，20 条客户数据。证明 `NotificationService` 所在依赖链路完全可用。 |
| 业务逻辑/安全隔离是否受影响 | 否。本次修复仅涉及 DI 注册层面，未改动任何业务逻辑、JWT 隔离策略、字段白名单或数据处理代码。 |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 审核结果（第 1 轮 — 产品经理）

- **审核时间**：2026-06-13
- **审核结论**：✅ 通过
- **审核方式**：代码审查 + 架构推演
- **验收标准达标情况**：7/7 全部通过
  - migration 与 Mock 流程闭环 ✅
  - "双密钥+双守卫" Token 强隔离 ✅
  - 车主端数据接口强隔离（按 CustomerId 过滤） ✅
  - 敏感数据 select 白名单拦截机制验证通过 ✅
  - 小程序独立编译构建成功 ✅
  - 多租户/多门店客户切换逻辑就绪 ✅
  - 测试用例覆盖核心安全边界（146/146） ✅
- **注意事项达标情况**：4/4 符合
- **亮点**：对安全边界的处理极其优秀，身份鉴权架构杜绝了越权查询 B 端数据的可能性。工单详情的字段白名单过滤保证了价格和备注等商业隐私的绝对安全。
- **对后续任务影响**：为将来车主主动买套餐、在线结账打下了良好的端侧基础。
- **TASK-109 状态**：✅ 已完成

### 复核补充（第 2 轮 — 2026-06-13，TASK-110 审核期间发现）

- **结论修正**：❌ 重新打回需整改（第 1 轮为纯代码审查，未实际启动 API，漏检运行时 DI 错误）
- **阻断级缺陷**：本任务给 `apps/api/src/notification/notification.service.ts` 注入了 `WechatMpProvider`（构造参数 index [2]），但 `notification.module.ts` 未将 `WechatMpProvider` 注册为 provider。后果：`nest build`（仅转译）可通过，但 `node dist/apps/api/src/main.js` 启动即崩溃：
  ```
  Nest can't resolve dependencies of the NotificationService (PrismaService, ConfigService, ?).
  Please make sure that the argument WechatMpProvider at index [2] is available in the NotificationModule context.
  ```
  即整个后端服务无法启动，影响所有 API（不仅车主端）。
- **教训**：本任务及后续审核必须以"`node dist/.../main.js` 实际启动成功"为硬验收项，不能只看 `nest build`。
- **整改要求见对话中的整改提示词。**
- **TASK-109 状态**：🔧 需整改（第 2 轮）

### 复审结果（第 3 轮 — 2026-06-13，整改后实测复核）

- **审核结论**：✅ 通过（整改通过）
- **审核方式**：实际启动 API + 全套测试 + 真实接口调用（吸取教训，不再纯代码审查）
- **复核意见**：
  - DI 修复 ✅ notification.module.ts 已注册 WechatMpProvider；service 构造参数加 @Optional() 防御
  - **实际启动 ✅**（核心）：`node dist/apps/api/src/main.js` 输出 "Nest application successfully started"，无任何 DI 报错
  - 全套测试 ✅ `pnpm --filter api test` 18 套件 163 用例全部通过
  - 链路可用 ✅ 登录 + GET /api/customers 返回 200
- **TASK-109 状态**：✅ 已关闭
