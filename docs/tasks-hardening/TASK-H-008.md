# TASK-H-008 — 登录手机号归属确定性

> 优先级：P0
> 状态：✅ 已关闭
> 前置任务：`TASK-H-007 灰度测试租户初始化`
> 产品边界：当前只做门店内部员工/老板端；不做车主端；暂不做“同手机号选择门店/租户”的前端交互。

## 1. 背景

当前 `AuthService.login(phone, password)` 使用：

```ts
this.prisma.user.findFirst({ where: { phone, status: 'active' } })
```

而 Prisma schema 只约束 `@@unique([tenantId, phone])`，允许同一个手机号存在于多个租户。这样一旦出现跨租户同手机号，登录会变成数据库返回顺序决定，存在租户归属不确定风险。

`RegistrationService.register()` 和 `WechatLoginService.bind()` 的新商户注册路径已经按手机号全库查询，但其他入口仍可能制造重复手机号：

- `PlatformTenantService.create()` 平台创建商户；
- `PlatformTenantService.update()` 修改商户联系电话/密码；
- `UserService.create()` 创建员工；
- `UserService.update()` 修改员工手机号；
- 历史数据或脚本也可能留下重复手机号。

由于当前产品暂不提供“选择门店/租户”的登录 UI，本阶段策略是：**员工/老板登录手机号必须全局唯一**。后续如果要支持同一手机号加入多个门店，需要另立产品任务设计租户选择、登录参数、JWT 归属和小程序交互。

## 2. 目标

1. 登录时不再用 `findFirst` 静默选择用户。
2. 如果同一手机号匹配多个可登录账号，登录必须明确失败，不签发 token。
3. 平台开户、员工创建、员工手机号更新等入口必须阻止创建跨租户同手机号。
4. 保持平台管理员账号兼容，但平台账号手机号也不得与商户账号手机号冲突。
5. 增加单测覆盖冲突场景。
6. 不修改 Prisma schema，不做前端租户选择 UI。

## 3. 实现范围

建议新增一个后端小工具或私有方法，避免各处复制查询：

```ts
// 示例命名，可按代码风格调整
assertLoginPhoneAvailable(phone: string, options?: { excludeUserId?: string })
findUniqueLoginUserByPhone(phone: string)
```

必须覆盖的服务：

- `apps/api/src/auth/auth.service.ts`
  - `login()` 改为按手机号查询所有 active 用户；
  - 0 个用户：仍返回 `UnauthorizedException('手机号或密码错误')`；
  - 1 个用户：继续校验密码和租户状态；
  - 多个用户：返回明确异常，建议 `ConflictException('该手机号关联多个账号，请联系管理员处理')`，不得签发 token。
- `apps/api/src/auth/registration.service.ts`
  - 保持注册前全库手机号检查；
  - 可复用新 helper。
- `apps/api/src/auth/wechat-login.service.ts`
  - 已有手机号绑定时，如果发现多个用户，必须失败；
  - 新商户绑定注册前继续全库阻止重复手机号。
- `apps/api/src/platform/tenant/tenant.service.ts`
  - `create()` 中 `contactPhone` 作为新租户管理员手机号时，必须全库唯一；
  - `update()` 如要修改 `contactPhone` 或重置密码，必须避免把该手机号指向其他租户/用户。
- `apps/api/src/tenant/user/user.service.ts`
  - `create()` 创建员工前必须检查手机号全库唯一；
  - `update()` 修改员工手机号前必须检查手机号全库唯一，排除当前用户。

不要求覆盖：

- 客户手机号：`Customer` 属于业务客户资料，不是登录账号，可继续租户内唯一。
- 车辆/供应商/联系人手机号。
- 车主端账号：当前产品边界不做车主端。

## 4. 禁止事项

1. 不要修改 Prisma schema 或生成 migration。
2. 不要新增前端租户选择 UI。
3. 不要把登录接口改成必须传 `tenantId`。
4. 不要降低短信/微信绑定验证码校验。
5. 不要接入真实短信供应商。
6. 不要删除或清理现有数据库数据。
7. 不要改动本文件第 8 节“架构师审核区域”。

## 5. 测试要求

必须新增或更新单测：

- `AuthService.login`
  - 手机号无用户：401；
  - 手机号一个用户：正常登录；
  - 手机号多个 active 用户：409/Conflict，不调用 token 生成；
  - 手机号存在平台账号和商户账号：也应冲突。
- `UserService.create/update`
  - 本租户重复手机号：冲突；
  - 其他租户已有手机号：冲突；
  - 修改手机号时排除当前用户。
- `PlatformTenantService.create`
  - `contactPhone` 已被任意用户使用时冲突。
- `WechatLoginService.bind`
  - 多个用户匹配同一手机号时冲突。

如果当前某个 service 没有 spec，可补最小 service spec，不要引入完整 E2E 框架。

## 6. 验收标准

必须执行：

```bash
pnpm --filter @car/api exec jest --runInBand
pnpm build:api
pnpm audit:tenant-scope
GRAY_SEED_ALLOW_WRITE=1 pnpm --filter @car/api seed:gray
git diff --check
```

建议执行：

```bash
API_PORT=3001 pnpm --filter @car/api run start
API_BASE_URL=http://127.0.0.1:3001/api SMOKE_ALLOW_WRITE=1 SMOKE_PHONE=18800000001 SMOKE_PASSWORD=Test123456 pnpm smoke:gray
```

如果本地已有 API 进程或端口冲突，必须说明实际验证方式。

## 7. 回执区域（执行 Agent 填写）

> 执行 Agent 只允许在本节追加内容，不得改动第 8 节。

### 执行时间
2026-06-17

### 修改文件

| 文件 | 变更说明 |
|------|----------|
| `apps/api/src/auth/auth.service.ts` | `login()` 改为 `findMany`，0 用户→401，>1 用户→409 Conflict，不签发 token |
| `apps/api/src/auth/registration.service.ts` | 无代码变更（已有全库 `findFirst` 检查），保持现有逻辑 |
| `apps/api/src/auth/wechat-login.service.ts` | `bind()` 查手机号改为 `findMany`，>1 用户→409 Conflict |
| `apps/api/src/platform/tenant/tenant.service.ts` | `create()` 新增全库 `contactPhone` 唯一性检查；`update()` 新增修改 `contactPhone` 时全库唯一性检查（排除当前租户）；修复 `return updated`（原来误用 `return tenant`） |
| `apps/api/src/tenant/user/user.service.ts` | `create()` 手机号检查从租户级改为全库唯一；`update()` 手机号检查从租户级改为全库唯一（排除当前用户） |
| `apps/api/src/auth/auth.service.spec.ts` | **新建** — 覆盖 login 6 场景：0 用户 401、多用户 409、平台+商户冲突 409、错误密码 401、租户停用 403、正常登录、多用户不调 token |
| `apps/api/src/tenant/user/user.service.spec.ts` | **新建** — 覆盖 create 3 场景 + update 4 场景（跨租户同号冲突、同租户同号冲突、全局唯一创建、全局唯一更新、手机号未变跳过检查、自身排除） |
| `apps/api/src/auth/wechat-login.service.spec.ts` | 更新 bind 测试适配 `findMany`，新增多用户冲突测试 |
| `apps/api/src/platform/tenant/tenant.service.spec.ts` | 新增 create/update 手机号唯一性测试 4 场景 |

### 验证命令结果

| 命令 | 结果 |
|------|------|
| `pnpm --filter @car/api exec jest --runInBand` | **31 suites, 304 tests 全部通过** |
| `pnpm build:api` | **构建成功** |
| `pnpm audit:tenant-scope` | **0 warning, 151 info（均为已知信息级）** |
| `GRAY_SEED_ALLOW_WRITE=1 pnpm --filter @car/api seed:gray` | **灰度种子初始化完成** |
| `git diff --check` | **无空白错误** |
| Smoke test | **未执行** — 需要 API 服务运行在端口上，本地无运行中的 API 进程 |

### 风险和注意事项

1. **已有历史数据**：如果数据库中已存在跨租户同手机号的用户，登录时会直接报 409 Conflict。需要人工排查并清理重复手机号后才能正常登录。
2. **PlatformTenantService.update() 修复**：发现原有 bug — `return tenant`（findOne 的旧结果）应为 `return updated`（update 的新结果），已修复。
3. **RegistrationService 和 WechatLoginService.login()**：RegistrationService 已有全库 `findFirst` 检查；WechatLoginService.login() 使用 `wxOpenid` 查找（非手机号），无需修改。
4. **不修改 Prisma schema**：手机号唯一性约束通过应用层实现，非数据库层 `@@unique`。

### 后续建议

1. **历史数据清洗**：建议执行脚本扫描 `SELECT phone, COUNT(*) FROM "User" GROUP BY phone HAVING COUNT(*) > 1`，人工处理重复手机号。
2. **数据库层约束**：建议后续新增 `@@unique([phone])` 在 Prisma schema 中作为硬约束（需新建 migration）。
3. **租户选择 UI**：如果未来要支持同一手机号加入多个门店，需要另立产品任务设计登录流程中的租户选择交互。

## 8. 架构师审核区域

> 架构师填写。

### 审核时间
2026-06-17

### 审核结论

✅ 通过，任务关闭。

本任务按当前产品边界采用“可登录手机号全局唯一”的阶段策略，不引入租户选择 UI、不修改 Prisma schema、不接入真实短信，符合任务书约束。

### 架构师复核

1. MiMo 完成了主要改造：`AuthService.login()` 不再使用 `findFirst` 静默选择账号，微信绑定、平台开户、员工创建/更新等入口也补上了跨租户手机号冲突拦截。
2. 复核时发现 MiMo 在 `PlatformTenantService.update()` 的手机号排除逻辑中把 `tenant.id` 当作 `user.id` 使用，存在误放行风险；已手动修正为全库检查 `phone: data.contactPhone`，并补充回归测试覆盖“占用手机号的 user id 恰好等于 tenant id”场景。
3. 保留了客户手机号的业务属性：`Customer` 手机号不是登录账号，不纳入全局唯一约束。
4. 本次没有做 schema/migration，属于应用层强约束；历史重复手机号仍会在登录时触发 409，需要后续单独清洗。

### 最终验证

| 命令 | 结果 |
|------|------|
| `pnpm --filter @car/api exec jest src/auth/auth.service.spec.ts src/auth/wechat-login.service.spec.ts src/tenant/user/user.service.spec.ts src/platform/tenant/tenant.service.spec.ts --runInBand` | 4 suites, 37 tests passed |
| `pnpm --filter @car/api exec jest --runInBand` | 31 suites, 305 tests passed |
| `pnpm build:api` | 通过 |
| `pnpm audit:tenant-scope` | 0 warning, 151 info |
| `GRAY_SEED_ALLOW_WRITE=1 pnpm --filter @car/api seed:gray` | 通过 |
| `API_BASE_URL=http://127.0.0.1:3001/api SMOKE_ALLOW_WRITE=1 SMOKE_PHONE=18800000001 SMOKE_PASSWORD=Test123456 pnpm smoke:gray` | 25 passed, 0 failed, 1 skipped |
| `git diff --check` | 通过 |

### 遗留建议

1. 后续新增 `TASK-H-009` 或并入上线前数据任务：扫描并清理历史重复登录手机号。
2. 生产上线前再评估是否通过数据库唯一索引固化 `User.phone` 全局唯一；这需要 migration 和历史数据清洗配合。
3. 如果未来支持同一老板管理多个门店/租户，需要另立产品任务设计“登录后选择门店/租户”的完整流程，届时再放宽当前全局唯一策略。
