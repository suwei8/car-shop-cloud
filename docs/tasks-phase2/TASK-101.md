# TASK-101：订阅生命周期管控（试用期 / 到期停用 / 定时任务 / 续费提醒）

> **优先级**：P0
> **状态**：✅ 已关闭（2026-06-12 审核通过）
> **依赖**：无（第二阶段首个任务）
> **可并行**：TASK-103（备份）、TASK-104（通知基础设施）

## 1. 任务目标

让"订阅"真正生效：商户可以处于试用期、有效期、宽限期、已停用四种生命周期状态，到期后系统自动限制使用。这是 SaaS 收费的前提。

当前问题：`TenantSubscription` 表有 `startAt/endAt/status` 字段，但**没有任何代码检查订阅是否过期**，商户到期后仍可无限使用；也没有试用期概念和定时任务框架。

## 2. 涉及文件

### 新建文件
- `apps/api/src/common/guards/subscription.guard.ts` — 订阅有效性守卫
- `apps/api/src/platform/subscription-task/subscription-task.service.ts` — 定时任务（到期扫描）
- `apps/api/src/platform/subscription-task/subscription-task.module.ts`
- Prisma migration（新增字段，见 3.1）

### 修改文件
- `apps/api/package.json` — 添加 `@nestjs/schedule` 依赖（用 pnpm add 安装）
- `apps/api/src/app.module.ts` — 注册 `ScheduleModule.forRoot()`、SubscriptionGuard、新模块
- `apps/api/prisma/schema.prisma` — 见 3.1
- `apps/api/src/platform/tenant/tenant.service.ts` — 创建租户时自动开通试用
- `apps/api/src/auth/auth.service.ts` — 登录响应中附带订阅状态信息

## 3. 详细要求

### 3.1 Schema 变更（需要 migration）

```prisma
// TenantSubscription.status 扩展取值：trial, active, expired, cancelled
// Tenant 增加冗余字段便于快速判断（由定时任务/订阅变更时维护）：
model Tenant {
  // ...已有字段
  subscriptionStatus String   @default("trial")  // trial, active, grace, suspended
  subscriptionEndAt  DateTime?
}
```

迁移命令：`pnpm db:migrate`（migration 命名 `add_subscription_lifecycle`）。

### 3.2 生命周期规则

| 状态 | 进入条件 | 系统行为 |
|------|---------|---------|
| `trial` | 新租户创建时自动开通，默认 14 天（天数可通过环境变量 `TRIAL_DAYS` 配置） | 全功能可用 |
| `active` | 平台为租户开通付费订阅（`subscribe` 接口） | 全功能可用 |
| `grace`（宽限期） | `endAt` 已过，但未超过 7 天（`GRACE_DAYS` 可配置） | 全功能可用，登录响应返回提醒字段 |
| `suspended` | 宽限期结束 | **只读模式**：拦截所有写操作 |

### 3.3 SubscriptionGuard（订阅守卫）

- 注册为全局守卫，顺序在 `TenantGuard` 之后
- 平台用户（`isPlatform: true`）和 `@Public()` 端点直接放行
- 商户用户：读取 `Tenant.subscriptionStatus`（建议带 60 秒内存缓存，避免每个请求查库）
  - `trial / active / grace` → 放行
  - `suspended` → 放行 GET 请求；非 GET 请求抛出 `ForbiddenException`，message 为 `"订阅已到期，系统处于只读模式，请联系服务商续费"`，响应 code 使用 `403`
- 登录接口（auth）不拦截——到期商户必须能登录看到自己的数据和提示

### 3.4 定时任务（@nestjs/schedule）

`subscription-task.service.ts`，每日凌晨 02:00 执行（`@Cron('0 0 2 * * *')`）：

1. 扫描所有 `Tenant`，根据其最新一条 `TenantSubscription` 的 `endAt` 计算应处状态：
   - `endAt > now` → `trial` 或 `active`（按 subscription.status 区分）
   - `now > endAt` 且未超宽限期 → `grace`
   - 超过宽限期 → `suspended`，并将对应 `TenantSubscription.status` 置为 `expired`
2. 更新 `Tenant.subscriptionStatus` / `subscriptionEndAt`
3. 状态发生变更时写入 `AuditLog`（action: `subscription_status_change`，含变更前后状态）
4. 提供手动触发端点 `POST /api/platform/subscription-tasks/run`（平台权限），便于测试和运营手工触发

### 3.5 试用期自动开通

修改 `tenant.service.ts` 的创建逻辑：创建租户时，如果未指定套餐，自动创建一条 `TenantSubscription`：
- `status: 'trial'`、`startAt: now`、`endAt: now + TRIAL_DAYS`
- `planId` 指向一个内置试用套餐（在 seed 中创建 name 为"试用版"的 SubscriptionPlan，maxShops:1, maxEmployees:5；如 seed 中已有套餐数据，追加即可）
- 同步设置 `Tenant.subscriptionStatus = 'trial'` 和 `subscriptionEndAt`

### 3.6 登录响应附带订阅信息

`auth.service.ts` 登录成功后，响应 `data` 中增加：

```typescript
subscription: {
  status: string;        // trial / active / grace / suspended
  endAt: string | null;  // ISO 时间
  daysRemaining: number; // 剩余天数，已过期为负数
}
```

前端无需本任务修改（后续任务处理 UI 提示）。

### 3.7 单元测试

- 新建 `subscription.guard.spec.ts`：覆盖 trial/active/grace 放行、suspended 拦截写放行读、平台用户放行、Public 放行
- 新建 `subscription-task.service.spec.ts`：覆盖四种状态计算边界（恰好到期日、宽限期内、宽限期外）
- Mock Prisma，不连真实数据库，与现有 `*.spec.ts` 风格保持一致

## 4. 验收标准

- [ ] migration 成功，`pnpm db:migrate` 可在干净库上执行
- [ ] 新建租户自动获得 14 天试用订阅，`subscriptionStatus = 'trial'`
- [ ] 手工将某租户 `subscriptionEndAt` 改为 10 天前，执行手动触发端点后该租户变为 `suspended`
- [ ] `suspended` 租户的用户：登录成功、GET 请求正常、POST/PUT/DELETE 返回 403 及指定提示文案
- [ ] 平台管理员不受订阅守卫影响
- [ ] 登录响应包含 `subscription` 字段且 `daysRemaining` 计算正确
- [ ] 状态变更写入 AuditLog
- [ ] 新增单元测试全部通过，`pnpm --filter api test` 无失败
- [ ] `nest build` 编译通过

## 5. 注意事项

- **不要**修改现有 `TenantGuard / RolesGuard / PermissionsGuard` 的逻辑，只新增守卫
- 守卫的缓存要在订阅变更（subscribe 接口、定时任务）时失效，简单做法：缓存 TTL 控制在 60 秒内即可接受
- 金额相关字段保持 Decimal，不引入 float
- 环境变量新增项要同步写入 `.env.example`
- 遵循项目响应格式 `{ code, message, data }` 与现有 DTO 校验规范

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/prisma/schema.prisma`（Tenant 增加 subscriptionStatus/subscriptionEndAt 字段）, `apps/api/src/app.module.ts`（注册 ScheduleModule、SubscriptionGuard、SubscriptionTaskModule）, `apps/api/src/platform/tenant/tenant.service.ts`（创建租户时自动开通试用订阅）, `apps/api/src/auth/auth.service.ts`（登录响应附带 subscription 信息）, `apps/api/src/platform/subscription-plan/subscription-plan.service.ts`（subscribe 时同步更新 Tenant 订阅状态）, `apps/api/src/common/guards/index.ts`（导出 SubscriptionGuard）, `apps/api/prisma/seed.ts`（新增试用版套餐、platform:tenant:manage 权限）, `.env.example`（新增 TRIAL_DAYS/GRACE_DAYS 环境变量）, `apps/api/package.json`（安装 @nestjs/schedule） |
| 新建的文件列表 | `apps/api/src/common/guards/subscription.guard.ts`, `apps/api/src/common/guards/subscription.guard.spec.ts`, `apps/api/src/platform/subscription-task/subscription-task.service.ts`, `apps/api/src/platform/subscription-task/subscription-task.service.spec.ts`, `apps/api/src/platform/subscription-task/subscription-task.module.ts`, `apps/api/src/platform/subscription-task/subscription-task.controller.ts` |
| migration 名称及是否执行成功 | `20260612231708_add_subscription_lifecycle`，执行成功 |
| 构建是否通过 (nest build) | **通过**。`npx nest build` 无报错 |
| 测试是否通过（列出新增测试文件与用例数） | **全部通过**。`subscription.guard.spec.ts`（8 个用例：public 放行、platform 放行、trial/active/grace 放行、suspended 拦截 POST/PUT/DELETE、suspended 放行 GET）；`subscription-task.service.spec.ts`（7 个用例：未过期保持 active、宽限期内→grace、超过宽限期→suspended、cancelled→suspended、无订阅跳过、审计日志写入）。共 2 个测试文件、15 个用例 |
| suspended 只读模式验证方式与结果 | **验证通过**。步骤：① 将 demo-tenant 的 TenantSubscription.endAt 和 Tenant.subscriptionEndAt 同时改为 10 天前；② 平台管理员调用 `POST /api/platform/subscription-tasks/run` 手动触发扫描；③ demo-tenant 从 active → suspended；④ 以 demo-tenant 用户登录：成功，响应包含 `subscription.status=suspended, daysRemaining=-10`；⑤ GET `/api/customers`：正常返回 `code=0, message=ok`；⑥ POST `/api/customers`：返回 HTTP 403，message="订阅已到期，系统处于只读模式，请联系服务商续费"；⑦ 审计日志确认写入 `subscription_status_change` 记录 |
| 已知限制或遗留问题 | 1. 定时任务 `@Cron('0 0 2 * * *')` 需要应用进程持续运行才能生效，重启后 cron 重新注册；2. SubscriptionGuard 的缓存 TTL 为 60 秒，极端情况下订阅状态变更后最多 60 秒才对所有请求生效（满足任务书要求）；3. 新建租户自动开通试用依赖 seed 中存在 `plan-trial` 套餐，如不存在则回退到 `plan-basic` |
| 执行耗时 | 约 40 分钟（含环境探查、代码实现、迁移、测试编写、集成验证） |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 审核结果

- **审核时间**：2026-06-12
- **审核结论**：✅ 通过（首轮通过）
- **审核方式**：代码审查 + 单测复跑 + 真实 HTTP 端到端实测，未依赖回执声明
- **审核意见**：
  - SubscriptionGuard ✅ 仅新增、未改动 Tenant/Roles/Permissions 守卫；Public/平台用户/无 tenantId 放行；suspended 仅拦截非 GET；60 秒缓存；文案逐字正确
  - 定时任务 calculateStatus ✅ 逻辑正确：cancelled→suspended、`now<=endAt` 边界、宽限期判断；状态变更写 TenantSubscription.expired + AuditLog；`@Cron('0 0 2 * * *')`
  - 手动触发端点 ✅ 实测 `POST /api/platform/subscription-tasks/run` 平台权限可用（scanned=2）
  - 试用自动开通 ✅ seed 含"试用版"套餐；schema 字段 subscriptionStatus/subscriptionEndAt 已 migrate 落库
  - 登录响应 ✅ 实测含 `subscription:{status,endAt,daysRemaining}`，suspended 租户 daysRemaining=-10
  - **端到端实测（核心）**：
    - suspended 租户登录成功 ✅（HTTP 200）
    - GET /api/customers ✅ 放行（HTTP 200）
    - POST /api/customers ✅ 拦截（HTTP 403 + 指定文案）
    - 正向回归：租户置 active 后 POST 到达业务逻辑（返回 409 而非 403）✅ 证明不误伤正常租户
  - 单元测试 ✅ 复跑 15/15 通过
  - nest build ✅ 通过；.env.example 含 TRIAL_DAYS/GRACE_DAYS
- **非阻塞备注**（无需整改，记录备查）：
  1. SubscriptionTaskService 注入了 SubscriptionGuard 但扫描后未显式调用 invalidateCache；因缓存 TTL=60s 可自愈，符合任务书"60 秒内可接受"的要求，下游 TASK-102 续费/恢复操作建议显式失效缓存以即时生效
  2. 守卫只放行 GET，未含 HEAD；任务书仅要求 GET，符合
  3. 审核中临时将 demo-tenant 改为 active 做正向测试，已恢复为 suspended 并清理测试客户数据
- **TASK-101 状态**：已关闭 ✅
