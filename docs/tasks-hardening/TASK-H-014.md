# TASK-H-014 客户手机号与车牌号数据库兜底约束

## 背景

`TASK-H-013` 已在应用层对齐以下业务规则：

- 客户手机号：同租户 `status='active'` 唯一；
- 车辆车牌号：同租户 `status='active'` 唯一，且写入前统一大写。

这些规则仍需要数据库层兜底，避免并发写入绕过应用层 `findFirst` 检查。

## 目标

使用 PostgreSQL partial unique index 为 active 数据增加数据库层唯一约束：

- `customers (tenant_id, phone) WHERE status = 'active'`
- `vehicles (tenant_id, upper(plate_no)) WHERE status = 'active'`

## 实施说明

- 不能使用 Prisma `@@unique`，因为业务语义不是全表唯一，而是仅 active 记录唯一；
- 迁移前应先执行 `pnpm audit:active-uniques -- --strict`，确保历史 active 数据无冲突；
- inactive 历史客户/车辆允许保留重复手机号或车牌号；
- 车牌号索引使用 `upper(plate_no)` 兜底，即使历史数据大小写不一致也按统一语义约束。

## 修改文件

- `apps/api/prisma/migrations/20260617162000_add_active_customer_vehicle_unique_indexes/migration.sql`

## 验收命令

```bash
pnpm audit:active-uniques -- --strict
pnpm --filter @car/api exec prisma validate
pnpm --filter @car/api exec jest src/tenant/customer/customer.service.spec.ts src/tenant/vehicle/vehicle.service.spec.ts --runInBand
```

## 回执区域

- 2026-06-17：已新增 PostgreSQL partial unique index 迁移，作为 `TASK-H-013` 应用层规则的数据库兜底。
