# TASK-H-010 — 登录手机号数据库唯一约束

> 优先级：P0
> 状态：✅ 已关闭
> 前置任务：`TASK-H-008 登录手机号归属确定性`、`TASK-H-009 历史重复登录手机号审计`
> 产品边界：当前只做门店内部员工/老板端；登录手机号阶段性全局唯一；不做车主端；不做同手机号选择租户/门店。

## 1. 背景

`TASK-H-008` 已经在应用层阻止跨租户同手机号登录归属不确定，`TASK-H-009` 已经提供历史数据审计脚本。

但应用层检查仍存在并发竞态：两个请求如果同时创建相同手机号，可能在数据库写入前都通过查询检查。上线前需要用数据库唯一约束兜底，把“登录手机号全局唯一”从业务规则固化为数据约束。

当前 `User` schema：

```prisma
@@unique([tenantId, phone])
@@index([phone])
```

这只能保证租户内手机号唯一。PostgreSQL 对 `tenantId = null` 的平台账号也不能通过该复合唯一键严格约束平台手机号唯一。

## 2. 目标

1. 在 Prisma schema 中为 `User.phone` 增加全局唯一约束。
2. 新增 Prisma migration，创建数据库唯一索引。
3. 移除冗余的普通 `phone` 索引，避免同一列重复索引。
4. 保留 `@@unique([tenantId, phone])` 以降低对既有查询/约束命名的影响，除非 Prisma 明确要求调整。
5. 迁移前必须有重复数据保护：如果目标库存在重复 `users.phone`，migration 应明确失败，提示先运行 H-009 并清理数据。
6. 不修改登录、注册、微信绑定、员工管理业务逻辑。

## 3. 实现范围

允许修改：

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/<timestamp>_add_unique_user_phone/migration.sql`
- 必要时更新任务文档回执

建议 schema 变更：

```prisma
@@unique([tenantId, phone])
@@unique([phone], map: "users_phone_key")
@@index([tenantId])
```

普通 `@@index([phone])` 应删除，因为唯一索引已经能服务按 `phone` 查询。

建议 migration：

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "users"
    GROUP BY "phone"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add users_phone_key: duplicate users.phone values exist. Run pnpm audit:login-phones -- --strict and clean duplicates first.';
  END IF;
END $$;

DROP INDEX IF EXISTS "users_phone_idx";
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
```

实际 SQL 可按 Prisma/PostgreSQL 生成结果调整，但必须满足：

- 先检查重复；
- 再删除普通索引；
- 再创建唯一索引；
- 不删除业务数据。

## 4. 禁止事项

1. 不要清洗、删除、合并、更新任何用户数据。
2. 不要修改登录/注册/微信绑定/员工管理业务逻辑。
3. 不要引入同手机号选择租户/门店 UI。
4. 不要接入真实短信。
5. 不要删除 `@@unique([tenantId, phone])`，除非先说明原因并在回执中解释影响。
6. 不要改动本文件第 8 节“架构师审核区域”。

## 5. 测试要求

必须执行：

```bash
pnpm audit:login-phones -- --strict
pnpm --filter @car/api run prisma:generate
pnpm build:api
git diff --check
```

建议执行本地 migration 验证：

```bash
pnpm --filter @car/api run prisma:migrate:prod
```

如果本地数据库不可用或 migration 无法执行，必须在回执说明原因，并至少确认 SQL 结构正确。

## 6. 验收标准

1. `schema.prisma` 中 `User.phone` 有全局唯一约束。
2. migration SQL 包含重复手机号前置检查。
3. migration SQL 不包含任何数据清洗或用户数据写操作。
4. `pnpm audit:login-phones -- --strict` 当前通过。
5. API 构建通过。
6. H-009 审计脚本仍可正常运行。

## 7. 回执区域（执行 Agent 填写）

> 执行 Agent 只允许在本节追加内容，不得改动第 8 节。

### 回执 #1 — 执行 Agent（2026-06-17）

**执行结果：已完成**

| 验收项 | 状态 |
|--------|------|
| `schema.prisma` 中 `User.phone` 有全局唯一约束 | ✅ 通过 |
| migration SQL 包含重复手机号前置检查 | ✅ 通过 |
| migration SQL 不包含任何数据清洗或用户数据写操作 | ✅ 通过 |
| `pnpm audit:login-phones -- --strict` 当前通过 | ✅ 退出码 0，无重复手机号 |
| API 构建通过 | ✅ 通过 |
| H-009 审计脚本仍可正常运行 | ✅ 同上 audit:login-phones 通过 |

**变更摘要：**

1. **`apps/api/prisma/schema.prisma`** — User 模型新增 `@@unique([phone], map: "users_phone_key")` 全局唯一约束；删除冗余的 `@@index([phone])`；保留 `@@unique([tenantId, phone])` 以维持既有租户级唯一性。
2. **`apps/api/prisma/migrations/20260617150000_add_unique_user_phone/migration.sql`** — 新增迁移：先检查重复手机号（存在则 RAISE EXCEPTION 并提示运行 H-009 审计脚本），再删除旧索引 `users_phone_idx`，最后创建唯一索引 `users_phone_key`。

**未修改内容：**

- 未清洗/删除/更新任何用户数据。
- 未修改登录、注册、微信绑定、员工管理业务逻辑。
- 未删除 `@@unique([tenantId, phone])`，因为该复合唯一约束仍服务于租户级查询，且删除可能导致既有约束命名变更。
- 未改动第 8 节。

## 8. 架构师审核区域

> 架构师填写。

### 审核时间
2026-06-17

### 审核结论

✅ 通过，任务关闭。

本任务已把 H-008 的“登录手机号全局唯一”从应用层规则推进到数据库唯一索引兜底，可防止并发创建相同登录手机号造成的数据竞态。

### 架构师复核

1. MiMo 按边界完成 schema 和 migration 变更，没有修改登录、注册、微信绑定、员工管理业务逻辑。
2. `User.phone` 新增 `@@unique([phone], map: "users_phone_key")`，普通 `@@index([phone])` 已删除；保留 `@@unique([tenantId, phone])`，避免影响既有约束和查询语义。
3. migration SQL 包含重复手机号前置检查，发现重复会 `RAISE EXCEPTION`，提示先运行 H-009 审计并清理数据。
4. migration SQL 不包含用户数据清洗、删除、合并或更新操作。
5. 本地已实际执行 `prisma migrate deploy`，迁移成功应用到当前数据库。
6. PostgreSQL 索引元数据确认 `users_phone_key` 是唯一索引，旧 `users_phone_idx` 已不存在。

### 最终验证

| 命令 | 结果 |
|------|------|
| `pnpm audit:login-phones -- --strict` | 通过，0 重复手机号，退出码 0 |
| `pnpm --filter @car/api run prisma:generate` | 通过 |
| `pnpm build:api` | 通过 |
| `pnpm --filter @car/api run prisma:migrate:prod` | 通过，已应用 `20260617150000_add_unique_user_phone` |
| `pnpm --filter @car/api exec prisma migrate status` | 通过，Database schema is up to date |
| `git diff --check` | 通过 |

### 数据库确认

当前本地数据库索引确认：

```text
users_phone_key | CREATE UNIQUE INDEX users_phone_key ON public.users USING btree (phone)
```

### 遗留建议

1. 生产部署前仍应先执行 `pnpm audit:login-phones -- --strict`，确认没有历史重复手机号。
2. 如果生产 migration 因重复手机号失败，不要绕过 migration；先按 H-009 JSON 报告人工确认账号归属并清理。
3. 后续如果产品要支持同一手机号管理多个租户，需要重新设计登录模型，再通过 migration 移除或调整此全局唯一约束。
