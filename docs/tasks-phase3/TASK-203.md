# TASK-203：技术债清理（Phase 2 审核标记项集中修复）

> **优先级**：P0
> **状态**：待派发
> **依赖**：无
> **可并行**：TASK-201、TASK-204

## 1. 任务目标

Phase 2 审核过程中标记了多项非阻塞技术债，均已记录但未修复。这些问题虽然不影响功能正确性，但存在以下风险：
- FeatureFlag 每次请求查 DB，高并发下会成为性能瓶颈
- data-import execute 端点缺少参数校验，`previewData` 缺失时 `JSON.parse(undefined)` 导致 500 内部错误
- 代登录使用通用的 `platform:tenant:update` 权限，粒度不够，不符合最小权限原则
- `remove` 方法只改 status 不写审计日志，与 `suspend` 行为不一致
- subscription-task 定时任务更新状态后未清除 SubscriptionGuard 缓存

完成后：所有标记的技术债清零，代码质量达到上线标准。

## 2. 涉及文件

### 新建文件
- `scripts/init-production.sh` — 生产环境初始化脚本（D9）

### 修改文件
- `apps/api/src/platform/feature-flag/feature-flag.service.ts` — 添加 Redis 缓存（D2）
- `apps/api/src/platform/feature-flag/feature-flag.module.ts` — 注入 Redis 依赖（D2）
- `apps/api/src/tenant/data-import/data-import.controller.ts` — 参数校验修复（D7）
- `apps/api/src/platform/tenant/tenant.controller.ts` — 代登录权限独立化（D3）
- `apps/api/src/platform/tenant/tenant.service.ts` — remove 方法统一行为（D4）
- `apps/api/src/platform/subscription-task/subscription-task.service.ts` — cron 执行后清缓存（D5）
- `apps/api/prisma/seed-data/permissions.ts` — 新增 `platform:tenant:impersonate` 权限（D3）

## 3. 详细要求

### 3.1 D2：FeatureFlag 加 Redis 缓存（60s TTL）

**问题**：当前 `FeatureFlagService` 的 `isFlagEnabled` 和 `getTenantFlagsAsMap` 每次调用都查询数据库。

**修改文件**：`apps/api/src/platform/feature-flag/feature-flag.service.ts`

**实现方案**：

1. 注入 Redis（使用 `ioredis`，项目已有该依赖，参考 `sms-code.service.ts` 的用法），在构造函数中创建 Redis 实例：

```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import Redis from 'ioredis';

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);
  private redis: Redis | null = null;
  private readonly CACHE_TTL = 60; // 秒

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    try {
      const redisUrl = this.config.get<string>('API_REDIS_URL')
        || this.config.get<string>('REDIS_URL')
        || 'redis://localhost:6379';
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      this.redis.connect().catch((err) => {
        this.logger.warn(`Redis connection failed, falling back to DB: ${err.message}`);
        this.redis = null;
      });
      this.redis.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
      });
    } catch (err) {
      this.logger.warn('Redis initialization failed, using DB only');
      this.redis = null;
    }
  }
  // ...
}
```

2. 缓存 key 格式：`ff:{tenantId}:{flagCode}`（单个 flag）、`ff:map:{tenantId}`（完整 map）

3. `isFlagEnabled` 方法改造：

```typescript
async isFlagEnabled(tenantId: string, flagCode: string): Promise<boolean> {
  const cacheKey = `ff:${tenantId}:${flagCode}`;

  // 尝试从 Redis 读取
  if (this.redis) {
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        return cached === '1';
      }
    } catch (err) {
      this.logger.warn(`Redis get failed for ${cacheKey}: ${err.message}`);
    }
  }

  // DB 查询
  const flag = await this.prisma.tenantFeatureFlag.findFirst({
    where: {
      tenantId,
      featureFlag: { code: flagCode },
    },
  });
  const enabled = flag?.enabled ?? false;

  // 写入缓存
  if (this.redis) {
    try {
      await this.redis.setex(cacheKey, this.CACHE_TTL, enabled ? '1' : '0');
    } catch (err) {
      this.logger.warn(`Redis setex failed for ${cacheKey}: ${err.message}`);
    }
  }

  return enabled;
}
```

4. `getTenantFlagsAsMap` 方法改造：

```typescript
async getTenantFlagsAsMap(tenantId: string): Promise<Record<string, boolean>> {
  const cacheKey = `ff:map:${tenantId}`;

  // 尝试从 Redis 读取
  if (this.redis) {
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        return JSON.parse(cached);
      }
    } catch (err) {
      this.logger.warn(`Redis get failed for ${cacheKey}: ${err.message}`);
    }
  }

  // DB 查询
  const flags = await this.prisma.tenantFeatureFlag.findMany({
    where: { tenantId },
    include: { featureFlag: true },
  });
  const result: Record<string, boolean> = {};
  for (const f of flags) {
    result[f.featureFlag.code] = f.enabled;
  }

  // 写入缓存
  if (this.redis) {
    try {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    } catch (err) {
      this.logger.warn(`Redis setex failed for ${cacheKey}: ${err.message}`);
    }
  }

  return result;
}
```

5. 新增 `invalidateCache` 方法，在 `setTenantFlag` 中调用：

```typescript
async invalidateCache(tenantId: string, flagCode?: string): Promise<void> {
  if (!this.redis) return;
  try {
    // 删除 map 缓存
    await this.redis.del(`ff:map:${tenantId}`);
    // 如果指定了 flagCode，删除单个 flag 缓存
    if (flagCode) {
      await this.redis.del(`ff:${tenantId}:${flagCode}`);
    } else {
      // 删除该 tenant 所有单 flag 缓存（使用 scan 避免 keys 命令）
      const pattern = `ff:${tenantId}:*`;
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    }
  } catch (err) {
    this.logger.warn(`Redis invalidate failed for tenant ${tenantId}: ${err.message}`);
  }
}

async setTenantFlag(tenantId: string, featureFlagId: string, enabled: boolean) {
  const result = await this.prisma.tenantFeatureFlag.upsert({
    where: { tenantId_featureFlagId: { tenantId, featureFlagId } },
    update: { enabled },
    create: { tenantId, featureFlagId, enabled },
  });

  // 获取 flagCode 用于精准失效
  const flag = await this.prisma.featureFlag.findUnique({ where: { id: featureFlagId } });
  await this.invalidateCache(tenantId, flag?.code);

  return result;
}
```

6. **异常降级**：所有 Redis 操作都 try/catch，Redis 不可用时 `this.redis` 设为 `null`，自动 fallback 到 DB 查询。

7. **修改模块** `feature-flag.module.ts`，注入 `ConfigModule`（已全局注册，无需显式导入）：

模块文件无需变更（`ConfigService` 已通过 `ConfigModule.forRoot({ isGlobal: true })` 全局可用）。

### 3.2 D7：data-import execute 端点参数校验修复

**问题**：当前 `execute` 方法中 `previewData` 参数（类型为 `string`，来自 `@Body('previewData')`）缺失时，`JSON.parse(previewData)` 会抛出 `SyntaxError`，导致 500。

**修改文件**：`apps/api/src/tenant/data-import/data-import.controller.ts`

**修改位置**：`execute` 方法，第 57-69 行区域。

在 `JSON.parse(previewData)` 之前添加校验：

```typescript
async execute(
  @UploadedFile() file: any,
  @Body('previewData') previewData: string,
  @CurrentUser() user: JwtPayload,
) {
  if (!file) {
    throw new BadRequestException('请上传Excel文件');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new BadRequestException('文件大小不能超过5MB');
  }

  if (!previewData) {
    throw new BadRequestException('缺少预览数据，请先执行预览步骤');
  }

  let previewResult: any;
  try {
    previewResult = JSON.parse(previewData);
  } catch {
    throw new BadRequestException('预览数据格式错误');
  }

  // ...后续逻辑不变
}
```

**注意**：同时将 `preview` 方法中的 `throw new Error(...)` 也改为 `throw new BadRequestException(...)`（当前使用 `Error` 会导致 500 而非 400）：

```typescript
// preview 方法
if (!file) {
  throw new BadRequestException('请上传Excel文件');
}

if (file.size > 5 * 1024 * 1024) {
  throw new BadRequestException('文件大小不能超过5MB');
}
```

需要在文件顶部的 import 中添加 `BadRequestException`：

```typescript
import {
  Controller, Get, Post, Body, UploadedFile, UseInterceptors,
  HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
```

### 3.3 D9：生产环境初始化脚本

**新建文件**：`scripts/init-production.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# 车店云管家 — 生产环境初始化脚本
# 执行数据库迁移 + 种子数据（幂等，可重复执行）
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$PROJECT_ROOT"

log_info "===== 生产环境初始化开始 ====="

# Step 1: 数据库迁移
log_info "[1/2] 执行数据库迁移 (prisma migrate deploy)..."
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
log_info "数据库迁移完成"

# Step 2: 种子数据（幂等 upsert）
log_info "[2/2] 执行种子数据初始化..."
npx ts-node apps/api/prisma/seed.ts
log_info "种子数据初始化完成"

log_info "===== 生产环境初始化完成 ====="
```

脚本须设置可执行权限：`chmod +x scripts/init-production.sh`

**关于 seed.ts 幂等性**：当前 `prisma/seed.ts` 中的所有操作已使用 `upsert`（`where` + `update: {}` + `create: {...}`），可重复执行无错误。无需额外修改 seed.ts 的逻辑。Agent 需验证 `pnpm db:seed` 连续执行两次不报错。

### 3.4 D3：代登录权限独立化

**问题**：当前 `impersonate` 端点使用 `@RequirePermissions('platform:tenant:update')` 通用编辑权限。代登录是高敏感操作，应使用独立权限。

**修改 1**：`apps/api/prisma/seed-data/permissions.ts`

在平台权限列表中新增一条：

```typescript
// 在 { code: 'platform:tenant:delete', ... } 之后添加
{ code: 'platform:tenant:impersonate', name: '代登录商户', module: 'platform' },
```

**修改 2**：`apps/api/src/platform/tenant/tenant.controller.ts`

将 `impersonate` 方法的装饰器从：

```typescript
@RequirePermissions('platform:tenant:update')
```

改为：

```typescript
@RequirePermissions('platform:tenant:impersonate')
```

完整修改（第 85-93 行）：

```typescript
@Post(':id/impersonate')
@RequirePermissions('platform:tenant:impersonate')
@ApiOperation({ summary: '代登录' })
impersonate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
  if (!user.isPlatform) {
    throw new ForbiddenException('仅平台管理员可执行代登录');
  }
  return this.service.impersonate(id, user.sub);
}
```

**关于 seed.ts**：seed.ts 中使用 `prisma.permission.findMany({ where: { code: { startsWith: 'platform:' } } })` 自动将所有 `platform:` 前缀权限分配给 `platform_admin` 角色（见 seed.ts 第 93-108 行）。因此新增权限到 `permissions.ts` 并重新 seed 即可自动分配，**无需额外修改 seed.ts 逻辑**。

### 3.5 D4：统一 remove/suspend 语义

**问题**：当前 `tenant.service.ts` 的 `remove` 方法（第 125-131 行）只更新 `status: 'suspended'`，不写 AuditLog、不设 `subscriptionStatus`、不清缓存。而 `suspend` 方法（第 228-247 行）会写 AuditLog + 设 `subscriptionStatus` + `invalidateGuardCache`。

**修改文件**：`apps/api/src/platform/tenant/tenant.service.ts`

将 `remove` 方法改为：

```typescript
async remove(id: string) {
  const tenant = await this.findOne(id);

  await this.prisma.tenant.update({
    where: { id },
    data: {
      status: 'suspended',
      subscriptionStatus: 'suspended',
    },
  });

  await this.audit.log({
    action: 'remove',
    targetType: 'tenant',
    targetId: id,
    changes: {
      previousStatus: tenant.status,
      previousSubscriptionStatus: tenant.subscriptionStatus,
    },
  });

  this.invalidateGuardCache(id);

  return { message: '已停用' };
}
```

**注意**：`remove` 方法原先返回更新后的 tenant 对象。改为返回 `{ message: '已停用' }` 与 `suspend` 方法保持一致。但由于**不要改变 API 的请求/响应格式**这一约束，需要确认 `remove` 的当前响应在前端是否有消费。如果前端依赖返回的 tenant 对象，则改为：

```typescript
async remove(id: string) {
  const tenant = await this.findOne(id);

  const updated = await this.prisma.tenant.update({
    where: { id },
    data: {
      status: 'suspended',
      subscriptionStatus: 'suspended',
    },
  });

  await this.audit.log({
    action: 'remove',
    targetType: 'tenant',
    targetId: id,
    changes: {
      previousStatus: tenant.status,
      previousSubscriptionStatus: tenant.subscriptionStatus,
    },
  });

  this.invalidateGuardCache(id);

  return updated;
}
```

Agent 须检查前端是否消费 `remove` 的响应数据来决定返回值格式。安全起见，**优先保留返回 updated tenant 对象**。

### 3.6 D5：subscription-task cron 更新后调用 invalidateCache

**问题**：`subscription-task.service.ts` 第 5 行 import 了 `SubscriptionGuard`，构造函数第 15 行也注入了 `private subscriptionGuard: SubscriptionGuard`，但 `scanAndUpdateSubscriptions` 方法中状态变更后**没有调用** `this.subscriptionGuard.invalidateCache(tenantId)`。虽然缓存 TTL=60s 可自愈，但这会导致状态变更后最多 60 秒的不一致。

**修改文件**：`apps/api/src/platform/subscription-task/subscription-task.service.ts`

在状态变更写入 AuditLog 之后（约第 77 行），增加缓存失效调用：

```typescript
// 在 await this.auditService.log({...}) 之后添加
this.subscriptionGuard.invalidateCache(tenant.id);
```

完整的 `for` 循环体变为：

```typescript
if (newStatus !== tenant.subscriptionStatus) {
  const oldStatus = tenant.subscriptionStatus;

  await this.prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      subscriptionStatus: newStatus,
      subscriptionEndAt: sub.endAt,
    },
  });

  if (newStatus === 'suspended') {
    await this.prisma.tenantSubscription.update({
      where: { id: sub.id },
      data: { status: 'expired' },
    });
  }

  await this.auditService.log({
    tenantId: tenant.id,
    action: 'subscription_status_change',
    targetType: 'tenant',
    targetId: tenant.id,
    changes: { from: oldStatus, to: newStatus, subscriptionId: sub.id },
  });

  // 清除 SubscriptionGuard 缓存，使状态变更即时生效
  this.subscriptionGuard.invalidateCache(tenant.id);

  this.logger.log(
    `Tenant ${tenant.id} (${tenant.name}): ${oldStatus} → ${newStatus}`,
  );
  updated++;
}
```

### 3.7 单元测试

每项修复都需要有对应的测试。以下为测试要求：

#### 3.7.1 FeatureFlag Redis 缓存测试

新建或修改 `apps/api/src/platform/feature-flag/feature-flag.service.spec.ts`：

- **缓存命中测试**：第一次调用 `isFlagEnabled` 查 DB 并缓存，第二次直接从 Redis 返回（mock Redis 的 `get` 返回缓存值，验证 Prisma 只调用 1 次）
- **缓存失效测试**：调用 `setTenantFlag` 后，对应 key 被删除
- **Redis 降级测试**：Redis 抛出异常时，`isFlagEnabled` 仍能正常返回 DB 查询结果
- **TTL 测试**：验证 `setex` 被调用时 TTL 参数为 60

#### 3.7.2 data-import 参数校验测试

修改现有的 `apps/api/src/tenant/data-import/data-import.service.spec.ts`（或新建 controller spec）：

- **缺少 previewData**：调用 execute 且 body 中无 previewData，应返回 400 + `'缺少预览数据，请先执行预览步骤'`
- **无效 JSON**：previewData 为非 JSON 字符串，应返回 400 + `'预览数据格式错误'`

#### 3.7.3 代登录权限测试

修改或新建 `tenant.controller.spec.ts`：

- 验证 `impersonate` 端点的 `@RequirePermissions` 装饰器值为 `'platform:tenant:impersonate'`

#### 3.7.4 remove 行为测试

修改或新建 `tenant.service.spec.ts`：

- 调用 `remove(id)` 后，验证 `audit.log` 被调用（action 为 `'remove'`）
- 验证 `subscriptionStatus` 被设为 `'suspended'`
- 验证 `invalidateGuardCache` 被调用

#### 3.7.5 subscription-task 缓存清除测试

修改现有 `apps/api/src/platform/subscription-task/subscription-task.service.spec.ts`：

- 状态变更后，验证 `subscriptionGuard.invalidateCache(tenantId)` 被调用

## 4. 验收标准

- [ ] FeatureFlag `isFlagEnabled` 查询后在 Redis 中有缓存，key 为 `ff:{tenantId}:{flagCode}`，TTL 为 60 秒
- [ ] FeatureFlag `getTenantFlagsAsMap` 查询后在 Redis 中有缓存，key 为 `ff:map:{tenantId}`，TTL 为 60 秒
- [ ] `setTenantFlag` 调用后，对应 Redis 缓存被清除
- [ ] Redis 不可用时，FeatureFlag 服务 fallback 到 DB 查询，不抛异常
- [ ] data-import execute 端点：body 缺少 `previewData` 时返回 HTTP 400（非 500），message 为 `'缺少预览数据，请先执行预览步骤'`
- [ ] data-import execute 端点：`previewData` 为无效 JSON 时返回 HTTP 400，message 为 `'预览数据格式错误'`
- [ ] data-import preview/execute 端点：文件缺失时返回 HTTP 400（非 500）
- [ ] `pnpm db:seed` 连续执行两次均无错误
- [ ] `scripts/init-production.sh` 可执行，运行 migration + seed
- [ ] `impersonate` 端点使用 `@RequirePermissions('platform:tenant:impersonate')` 独立权限
- [ ] `permissions.ts` 中包含 `{ code: 'platform:tenant:impersonate', name: '代登录商户', module: 'platform' }`
- [ ] seed 后 `platform_admin` 角色自动拥有 `platform:tenant:impersonate` 权限
- [ ] `remove` 方法执行后写入 AuditLog（action: `'remove'`）
- [ ] `remove` 方法执行后 `subscriptionStatus` 被设为 `'suspended'`
- [ ] `remove` 方法执行后 `invalidateGuardCache` 被调用
- [ ] subscription-task cron 执行后，状态变更的 tenant 的 SubscriptionGuard 缓存被清除
- [ ] 所有新增/修改的单元测试通过
- [ ] `nest build`（`pnpm build:api`）编译通过
- [ ] 不改变任何 API 端点的请求/响应 JSON 格式

## 5. 注意事项

- **不要改变任何 API 的请求/响应格式**。remove 方法如果原先返回 tenant 对象，改造后仍返回 tenant 对象
- **Redis 缓存必须有异常降级**。所有 Redis 操作都要 try/catch，Redis 不可用时 fallback 到 DB 查询，绝不能因为 Redis 故障导致业务不可用
- **Redis 实例创建参考** `apps/api/src/auth/sms-code.service.ts`（项目中已有的 ioredis 用法），使用相同的连接方式和环境变量（`API_REDIS_URL` / `REDIS_URL`）
- 每项修复都要有对应的单元测试或修改现有测试
- `permissions.ts` 中使用 `as const` 做了只读断言。新增权限时注意语法正确性，添加在平台权限区域（`platform:tenant:delete` 之后）
- seed 中的权限分配逻辑已通过 `startsWith('platform:')` 自动匹配，无需额外修改 seed.ts 的分配逻辑
- `invalidateCache` 使用 Redis `SCAN` 命令而非 `KEYS` 命令，避免在 key 数量多时阻塞 Redis
- data-import controller 中原来的 `throw new Error(...)` 应全部改为 `throw new BadRequestException(...)`，确保返回 400 而非 500

---

## 6. 回执区域（Agent 完成后填写）

> **Agent 请在完成任务后，将以下表格填写完整并追加到本文件此节：**

| 项目 | 内容 |
|------|------|
| 修改的文件列表 | `apps/api/src/platform/feature-flag/feature-flag.service.ts`（添加 Redis 缓存 + invalidateCache）, `apps/api/src/platform/feature-flag/feature-flag.module.ts`（注入 ConfigModule）, `apps/api/src/tenant/data-import/data-import.controller.ts`（previewData 校验 + BadRequestException）, `apps/api/src/platform/tenant/tenant.controller.ts`（impersonate 权限改为 platform:tenant:impersonate）, `apps/api/src/platform/tenant/tenant.service.ts`（remove 方法统一审计日志 + subscriptionStatus + invalidateGuardCache）, `apps/api/src/platform/subscription-task/subscription-task.service.ts`（cron 后调用 invalidateCache）, `apps/api/prisma/seed-data/permissions.ts`（新增 platform:tenant:impersonate 权限） |
| 新建的文件列表 | `scripts/init-production.sh`（生产环境初始化脚本）, `apps/api/src/platform/feature-flag/feature-flag.service.spec.ts`（9 个测试）, `apps/api/src/tenant/data-import/data-import.controller.spec.ts`（5 个测试） |
| 构建是否通过 | ✅ `pnpm build:api` (nest build) 编译通过 |
| 测试是否通过（新增用例数） | ✅ 193 个测试全部通过（22 suites），新增 17 个用例（feature-flag Redis 缓存 9 + data-import 参数校验 5 + remove 行为 1 + subscription-task 缓存清除 1 + 1） |
| 已知限制或遗留问题 | Redis 连接降级：Redis 不可用时自动 fallback 到 DB 查询，不影响业务。`init-production.sh` 需在生产环境配置 DATABASE_URL 后执行。 |
| 执行耗时 | 约 10 分钟 |

### 各项修复详情

#### D2：FeatureFlag Redis 缓存
- `isFlagEnabled` / `getTenantFlagsAsMap` 添加 Redis 读写缓存（60s TTL，key: `ff:{tenantId}:{flagCode}` / `ff:map:{tenantId}`）
- `setTenantFlag` 后自动失效对应缓存（使用 SCAN 命令安全清理）
- 所有 Redis 操作 try/catch 降级，Redis 不可用时 fallback 到 DB
- 新增 9 个测试覆盖缓存命中、失效、降级、TTL

#### D7：data-import 参数校验
- `execute` 方法：`previewData` 缺失时返回 400（`缺少预览数据，请先执行预览步骤`），无效 JSON 返回 400（`预览数据格式错误`）
- `preview` / `execute` 方法：文件缺失和超大文件的 `throw new Error()` 全部改为 `throw new BadRequestException()`
- 新增 5 个测试覆盖各种异常场景

#### D9：生产环境初始化脚本
- 新建 `scripts/init-production.sh`（prisma migrate deploy + ts-node seed，幂等可重复执行）
- 已设置可执行权限

#### D3：代登录权限独立化
- `permissions.ts` 新增 `platform:tenant:impersonate` 权限（`{ code: 'platform:tenant:impersonate', name: '代登录商户', module: 'platform' }`）
- `tenant.controller.ts` 的 `impersonate` 端点装饰器改为 `@RequirePermissions('platform:tenant:impersonate')`
- seed 中 `startsWith('platform:')` 自动匹配分配给 `platform_admin` 角色

#### D4：统一 remove/suspend 语义
- `remove` 方法现在：设 `status + subscriptionStatus = 'suspended'`、写 AuditLog（action: 'remove'，记录 previousStatus/previousSubscriptionStatus）、调用 `invalidateGuardCache`
- 保留返回 updated tenant 对象（与现有 API 响应格式一致）
- 新增 1 个测试验证完整行为

#### D5：subscription-task cron 缓存清除
- `scanAndUpdateSubscriptions` 中状态变更写入 AuditLog 后，调用 `this.subscriptionGuard.invalidateCache(tenant.id)`
- 新增 1 个测试验证 invalidateCache 被调用

---

## 7. 架构师审核区域

> 审核人填写，Agent 请勿改动此节。

### 产品经理审核记录（2026-06-13）

- **审核结论**：✅ 通过
- **审核方式**：独立代码审查子代理全量代码核对 + 后端全套测试跑通验证
- **复核意见**：
  - **D2 (Redis缓存)**：✅ 缓存读写与自动失效逻辑严谨，降级处理完备，避免了单点故障。
  - **D7 (导入参数校验)**：✅ `BadRequestException` 已应用，接口返回 400 符合 HTTP 语义。
  - **D9 (初始化脚本)**：✅ `scripts/init-production.sh` 完成了 `migrate deploy` 和 `seed` 封装，并设置了执行权限。
  - **D3 (代登录权限)**：✅ 新权限分配与装饰器应用无误。
  - **D4 (remove对齐)**：✅ 软删除行为与 `suspend` 看齐，完善了生命周期闭环。
  - **D5 (cron缓存清除)**：✅ `invalidateCache()` 在状态变更后正确调用。
  - **测试覆盖**：✅ 193/193 个用例全量通过。
- **TASK-203 状态**：✅ 已关闭
