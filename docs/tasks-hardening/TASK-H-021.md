# TASK-H-021 Prisma Client 生成门禁补强

## 背景

`TASK-H-020` 审计 `pnpm build:api` 时发现大量 TypeScript 错误，其中一类表现为：

- `Prisma.sql` / `Prisma.empty` 类型不可见；
- `Prisma.PrismaClientKnownRequestError` 类型不可见；
- 大量 Prisma 查询结果退化，进一步引发 `unknown[]` 或隐式 `any` 报错。

复查后确认：在当前容器中，如果 Prisma Client 未生成或处于 stale 状态，`@prisma/client` 暴露的 `Prisma` namespace 会不完整，导致 build 报出大量误导性的类型错误。执行：

```bash
pnpm --filter @car/api exec prisma generate
```

后，`pnpm build:api` 可以通过。

## 目标

把 Prisma Client 生成纳入灰度前检查链路，避免新环境、CI 或依赖重装后因未生成 Prisma Client 导致 build 误报。

## 修改说明

### 1. 根目录新增脚本

新增：

```bash
pnpm prisma:generate
```

等价于：

```bash
pnpm --filter @car/api run prisma:generate
```

### 2. `check:gray-ready` 前置生成 Prisma Client

`check-gray-ready.sh` 在 Prisma schema validation 和 API build 前先执行：

```bash
pnpm prisma:generate
```

新的顺序为：

1. git whitespace check；
2. Prisma Client generation；
3. Prisma schema validation；
4. API build；
5. smoke compile check；
6. 数据库审计；
7. 关键硬化单测。

## 修改范围

- `package.json`
- `scripts/check-gray-ready.sh`
- `docs/tasks-hardening/TASK-H-021.md`
- `docs/tasks-hardening/README.md`

## 验收命令

```bash
pnpm prisma:generate
pnpm build:api
pnpm check:gray-ready
git diff --check
```

## 已知限制

- `pnpm check:gray-ready` 在当前环境仍会因为缺少 `DATABASE_URL` 而在数据库审计阶段失败；这是灰度前真实数据库审计的预期保护行为。
- 本任务不修正业务模块中的所有潜在类型质量问题，只解决 Prisma Client 未生成导致的误导性 build 阻塞。

## 回执区域

- 2026-06-17：已新增根 `prisma:generate`，并将 Prisma Client generation 纳入 `check:gray-ready` 的 build 前置步骤。
