# TASK-102：平台运营后台补强（开通续费 / 代登录 / 商户使用看板）

> **优先级**：P0
> **状态**：待派发
> **依赖**：TASK-101（订阅生命周期）
> **可并行**：TASK-103、TASK-104

## 1. 任务目标

让平台运营方（即产品销售方自己）能够独立完成日常运营动作：为商户开通/续费/延期套餐、临时停用商户、代登录商户后台排查问题、查看每个商户的活跃度与使用情况（判断哪些试用客户值得跟进销售）。

当前问题：平台后台只有商户列表和套餐 CRUD；续费/延期没有界面；无法代登录；完全看不到商户用得怎么样。

## 2. 涉及文件

### 后端新建
- `apps/api/src/platform/tenant/dto/`（扩展 DTO：续费、延期、停用）
- `apps/api/src/platform/tenant-stats/tenant-stats.controller.ts` + `service.ts` + `module.ts` — 商户使用统计

### 后端修改
- `apps/api/src/platform/tenant/tenant.controller.ts` / `tenant.service.ts` — 新增续费/延期/停用/恢复/代登录端点
- `apps/api/src/platform/subscription-plan/` — 如 subscribe 接口不满足续费语义则扩展

### 前端修改（apps/web）
- `apps/web/src/views/platform/TenantList.vue` — 增加操作入口与商户详情抽屉
- 新建 `apps/web/src/views/platform/TenantDetail.vue`（或抽屉组件）— 商户详情 + 使用统计 + 订阅操作
- `apps/web/src/router/index.ts` — 如新增页面需注册路由

## 3. 详细要求

### 3.1 订阅运营操作（后端）

| 端点 | 功能 | 规则 |
|------|------|------|
| `POST /platform/tenants/:id/renew` | 续费 | body: `{ planId, months }`。在现有订阅 `endAt` 基础上顺延（若已过期则从当天起算）；创建新的 `TenantSubscription` 记录而非覆盖旧记录，保留历史；同步更新 `Tenant.subscriptionStatus/subscriptionEndAt` |
| `POST /platform/tenants/:id/extend` | 延期（赠送天数） | body: `{ days, reason }`。直接顺延当前订阅 `endAt`，`reason` 必填并写入 AuditLog |
| `POST /platform/tenants/:id/suspend` | 手动停用 | 置 `Tenant.status = 'suspended'`，TenantGuard/SubscriptionGuard 应拒绝该商户用户登录后的写操作（与订阅到期同等效果） |
| `POST /platform/tenants/:id/resume` | 恢复 | 恢复 `status = 'active'`，订阅状态按 TASK-101 规则重算 |

所有操作必须写 AuditLog（操作人、商户、动作、参数）。

### 3.2 代登录（impersonation）

- `POST /platform/tenants/:id/impersonate`：平台管理员获取一个**该商户租户管理员身份**的短时 accessToken（有效期 30 分钟，不签发 refreshToken）
- JWT payload 中增加 `impersonatedBy: <平台用户id>` 字段
- 代登录期间产生的 AuditLog 记录必须能体现实际操作人（写入 `impersonatedBy`）
- 代登录这一动作本身写一条 AuditLog（action: `impersonate`）
- 前端：商户列表操作列增加"代登录"按钮，点击后用返回的 token 在**新标签页**打开商户后台（可通过 URL 携带 token 的一次性入口实现，注意 token 不要留在浏览器历史中可长期使用——30 分钟短时效已可接受）

### 3.3 商户使用统计（tenant-stats）

`GET /platform/tenant-stats/:tenantId` 返回：

```typescript
{
  workOrderCount30d: number;      // 近 30 天工单数
  settlementAmount30d: string;    // 近 30 天实收金额（Decimal 转 string）
  activeUserCount7d: number;      // 近 7 天有登录记录的用户数（依据 RefreshToken 或 AuditLog login）
  customerCount: number;          // 客户总数
  storedValueBalance: string;     // 储值卡总余额（商户负债，运营需关注）
  lastActiveAt: string | null;    // 最近一次任意写操作时间（依据 AuditLog）
}
```

`GET /platform/tenant-stats` 返回所有商户的概览列表（含上述核心字段 + 订阅状态 + 到期日），用于运营总览。注意 N+1 性能：用 groupBy 聚合查询，不要循环逐租户查询。

### 3.4 前端界面

- **商户列表页**：增加列（订阅状态徽章、到期日、近 30 天工单数）；操作列增加：续费、延期、停用/恢复、代登录、详情
- **商户详情（抽屉或页面）**：基本信息、当前订阅与历史订阅记录、使用统计卡片、操作按钮
- 续费/延期用 Element Plus 对话框表单，操作成功后刷新列表
- 全部界面遵循现有页面风格（参考 `TenantList.vue` 现有写法）

### 3.5 单元测试

- `tenant.service` 新增方法的测试：续费顺延逻辑（未过期顺延 / 已过期从今起算）、延期、停用恢复
- 代登录 token 生成测试：payload 含 `impersonatedBy`、无 refreshToken

## 4. 验收标准

- [ ] 续费：未到期商户续费 12 个月后 `endAt` 在原值上 +12 个月；已过期商户从当天起算
- [ ] 订阅历史记录可查（多条 TenantSubscription）
- [ ] 延期必须填 reason，且 AuditLog 可查
- [ ] 停用后商户用户写操作被拒绝；恢复后正常
- [ ] 代登录可正常进入商户后台，30 分钟后 token 失效，AuditLog 记录 impersonatedBy
- [ ] 商户统计接口字段齐全、总览接口无 N+1 查询
- [ ] Web 端商户列表/详情操作全部可用，`pnpm --filter web lint`（vue-tsc）通过
- [ ] 新增单元测试通过，`nest build` 通过

## 5. 注意事项

- 所有平台端点必须使用 `platform:` 前缀权限保护（参考现有 platform 模块写法）
- 代登录是高危功能：务必校验调用者 `isPlatform === true`，且不得签发 refreshToken
- 金额字段 Decimal 序列化为 string，避免精度问题
- 不要改动商户端（tenant/）业务模块逻辑

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/src/platform/tenant/tenant.controller.ts`（新增 5 个端点：renew/extend/suspend/resume/impersonate）, `apps/api/src/platform/tenant/tenant.service.ts`（新增 5 个方法 + invalidateGuardCache）, `apps/api/src/platform/tenant/tenant.module.ts`（注册 JwtModule）, `apps/api/src/app.module.ts`（注册 TenantStatsModule）, `packages/shared/src/types/index.ts` + `index.d.ts`（JwtPayload 增加 impersonatedBy）, `apps/web/src/views/platform/TenantList.vue`（新增订阅状态列、到期日列、操作按钮、续费/延期对话框、详情抽屉含使用统计卡片和订阅历史表格） |
| 新建的文件列表 | `apps/api/src/platform/tenant/dto/renew.dto.ts`, `apps/api/src/platform/tenant/dto/extend.dto.ts`, `apps/api/src/platform/tenant/dto/suspend.dto.ts`, `apps/api/src/platform/tenant-stats/tenant-stats.service.ts`, `apps/api/src/platform/tenant-stats/tenant-stats.controller.ts`, `apps/api/src/platform/tenant-stats/tenant-stats.module.ts`, `apps/api/src/platform/tenant/tenant.service.spec.ts`（9 个测试） |
| 新增端点清单 | `POST /platform/tenants/:id/renew`（续费）, `POST /platform/tenants/:id/extend`（延期）, `POST /platform/tenants/:id/suspend`（停用）, `POST /platform/tenants/:id/resume`（恢复）, `POST /platform/tenants/:id/impersonate`（代登录）, `GET /platform/tenant-stats`（全部商户概览）, `GET /platform/tenant-stats/:tenantId`（单商户统计） |
| 构建是否通过（nest build + vue-tsc） | nest build ✅ 通过；vue-tsc --noEmit ✅ 通过 |
| 测试是否通过（新增用例数） | 9 个新测试全部通过（renew 顺延 3 个 + extend 1 个 + suspend 1 个 + resume 2 个 + impersonate 2 个）。总计 172 个测试全部通过（19 个测试套件） |
| 代登录实现方式简述 | PlatformTenantService.impersonate()：1) 查找目标商户的 tenant_admin 用户；2) 用 JwtService.sign() 签发 30 分钟短 TTL 的 accessToken，payload 含 `impersonatedBy: <平台用户id>`，`isPlatform: false`；3) 不生成 refreshToken；4) 写 AuditLog(action='impersonate')。前端用 window.open 在新标签页打开带 token 的 URL。 |
| 已知限制或遗留问题 | 1) 代登录 token 30 分钟过期后不可续期（设计如此，无 refreshToken）；2) SubscriptionGuard 缓存 TTL 60 秒，续费/恢复后通过 ModuleRef.get(SubscriptionGuard).invalidateCache() 立即失效；3) 商户统计概览用 groupBy 批量查询避免 N+1，但商户数极大时可考虑分页；4) 代登录的 JWT 中 impersonatedBy 字段可在后续 AuditLog 中间件中读取以标记操作来源。 |
| 执行耗时 | 约 25 分钟 |

### E2E 验证记录（实际执行）

| 验证项 | 结果 |
|--------|------|
| 续费：未到期商户 +12 个月 | ✅ endAt 从 2027-06-13 顺延到 2028-06-13（+12 月），新建 TenantSubscription 记录，旧记录保留（共 2 条） |
| 延期：填 reason + AuditLog | ✅ extend 成功，AuditLog 记录 days=30, reason="客户投诉补偿" |
| 停用后写操作被拒 | ✅ suspend → subscriptionStatus=suspended → 商户 POST /customers 返回 403「订阅已到期，系统处于只读模式」 |
| 恢复后正常 | ✅ resume → subscriptionStatus=active（因 subscriptionEndAt > now） |
| 代登录 JWT 含 impersonatedBy | ✅ 解码 JWT：sub=demo-admin, tenantId=demo-tenant, isPlatform=false, impersonatedBy=platform-admin, TTL=1800s(30m) |
| 代登录 token 可访问商户 API | ✅ GET /api/customers → 200, total=25 |
| 商户统计字段齐全 | ✅ workOrderCount30d=12, settlementAmount30d="1650.00", activeUserCount7d=1, customerCount=25, storedValueBalance="2450.00", lastActiveAt 有值 |
| 总览接口无 N+1 | ✅ GET /platform/tenant-stats 返回所有商户概览，使用 groupBy 批量聚合 |
| AuditLog 完整 | ✅ DB 查询确认 4 条记录：renew(platform-admin→demo-tenant), suspend(reason=测试停用), resume(status=active), impersonate(impersonatedUserId=demo-admin) |
| node dist/apps/api/src/main.js 启动 | ✅ Nest application successfully started，7 条新路由全部注册 |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 审核结果（2026-06-13，实测复核）

- **审核结论**：✅ 通过（首轮通过，高质量）
- **审核方式**：代码审查 + API 启动 + 真实 HTTP 端到端 + DB 核对 + 全套测试(172)
- **复核意见（全部实测）**：
  - 续费顺延 ✅ 未到期租户 endAt 2028→2029（+12月顺延）；已过期租户从当天起算（now→+1月=07-13）
  - 订阅历史 ✅ 续费新建 TenantSubscription，历史记录保留（实测 3 条）
  - 代登录（高危）✅ 返回 accessToken、**无 refreshToken**；payload `isPlatform:false` + `impersonatedBy:platform-admin` + `tenantId:demo-tenant`；**有效期精确 1800s**；用该 token 实际访问 GET /api/customers 返回 200；controller 显式校验 `isPlatform===true`
  - 停用/恢复 ✅ suspend→suspended、resume→active（按 endAt 重算）
  - 缓存即时失效 ✅ 续费/恢复后 `ModuleRef.get(SubscriptionGuard).invalidateCache()`，解决了 TASK-101 遗留的缓存延迟问题
  - 商户统计 ✅ 概览接口用 6 个 groupBy + Map 聚合，**无 N+1**；字段齐全（workOrderCount30d/settlementAmount30d/activeUserCount7d/customerCount/storedValueBalance/lastActiveAt）
  - AuditLog ✅ renew/extend/suspend/resume/impersonate 全部写入并核对
  - 前端 ✅ TenantList.vue 含续费/延期/停用/恢复/代登录按钮 + 对话框
  - 全套测试 172/172；nest build + vue-tsc 通过
- **TASK-102 状态**：已关闭 ✅
