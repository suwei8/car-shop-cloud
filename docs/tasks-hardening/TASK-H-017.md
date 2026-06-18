# TASK-H-017 灰度 smoke 脚本可编译检查与链路入口补强

## 背景

`TASK-H-016` 已完成小程序主路径 API 对齐审计，并修正了小程序一键完工调用不存在接口的问题。下一步需要确保灰度 smoke 链路本身在没有启动 API 服务时也能被 CI/本地预检发现语法和加载问题。

本次检查发现 `apps/api/scripts/gray-smoke.ts` 在创建服务项目步骤存在重复声明，导致脚本在真正执行前就会 TypeScript 编译失败。该问题会阻断灰度链路复验。

## 目标

1. 修复 `gray-smoke.ts` 的脚本语法/编译问题；
2. 新增 smoke 脚本只编译/加载检查模式，避免预检阶段必须启动 API；
3. 在根目录和 API 包增加 `smoke:gray:check`；
4. 将 smoke 编译检查纳入 `check:gray-ready`，让灰度前只读检查覆盖 smoke 脚本可执行性。

## 修改说明

### 1. 修复 gray-smoke 创建服务项目步骤

移除重复的：

```ts
const r = await api('POST', '/service-items', {
```

确保 `pnpm --filter @car/api run smoke:gray` 至少能加载脚本并输出 API_BASE_URL 缺失提示。

### 2. 增加 `SMOKE_COMPILE_ONLY=1`

当设置：

```bash
SMOKE_COMPILE_ONLY=1 pnpm --filter @car/api run smoke:gray
```

脚本只完成 ts-node 加载与初始化输出，然后跳过 API 调用并以 0 退出。该模式用于 CI 或本地灰度前只读检查，不写入数据、不依赖 API 服务。

### 3. 增加脚本入口

- 根目录：`pnpm smoke:gray:check`
- API 包：`pnpm --filter @car/api run smoke:gray:check`

### 4. 纳入灰度就绪检查

`pnpm check:gray-ready` 在 API build 后执行 smoke 编译检查，随后再进入数据库审计和关键单测。

## 修改范围

- `apps/api/scripts/gray-smoke.ts`
- `apps/api/package.json`
- `package.json`
- `scripts/check-gray-ready.sh`
- `docs/tasks-hardening/TASK-H-017.md`
- `docs/tasks-hardening/README.md`

## 验收命令

```bash
pnpm smoke:gray:check
pnpm --filter @car/api run smoke:gray
pnpm check:gray-ready
git diff --check
```

## 已知限制

- `pnpm --filter @car/api run smoke:gray` 在未设置 `API_BASE_URL` 时仍应失败，这是正常保护行为；本任务只保证脚本能成功编译并输出明确用法。
- `pnpm check:gray-ready` 在未设置 `DATABASE_URL` 时仍会失败，这是 `TASK-H-015` 定义的灰度前数据库审计要求。
- 真正的写入链路仍需在 API 服务启动后使用 `SMOKE_ALLOW_WRITE=1 API_BASE_URL=... pnpm smoke:gray` 单独执行。

## 回执区域

- 2026-06-17：已修复 `gray-smoke.ts` 编译阻断问题，新增 `smoke:gray:check`，并将 smoke 编译检查纳入 `check:gray-ready`。
