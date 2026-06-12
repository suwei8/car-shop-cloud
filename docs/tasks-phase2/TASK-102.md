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
| 修改的文件列表 | （填写） |
| 新建的文件列表 | （填写） |
| 新增端点清单 | （填写） |
| 构建是否通过（nest build + vue-tsc） | （填写） |
| 测试是否通过（新增用例数） | （填写） |
| 代登录实现方式简述 | （填写） |
| 已知限制或遗留问题 | （填写） |
| 执行耗时 | （填写） |

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

（待审核）
