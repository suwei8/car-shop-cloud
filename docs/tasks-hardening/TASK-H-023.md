# TASK-H-023 Prisma 错误类型导入修复

## 背景

`pnpm build:api` 的严格 TypeScript 检查显示 `http-exception.filter.ts` 仍通过 `Prisma.PrismaClientKnownRequestError` 访问 Prisma 运行时错误类型。但当前 Prisma Client 版本下，该错误类不再从 `@prisma/client` 的 `Prisma` namespace 暴露，导致全局异常过滤器编译失败。

该过滤器负责把 Prisma P2002 / P2025 等数据库错误映射为统一业务响应，一旦类型导入失效，会影响 API build，也会让唯一约束错误文案兜底不可验证。

## 目标

- 改为从 Prisma runtime library 直接导入 `PrismaClientKnownRequestError`。
- 保持现有 P2002 / P2025 映射行为不变。
- 同步更新单元测试里的错误实例构造方式，确保测试覆盖仍然有效。

## 范围

- `apps/api/src/common/filters/http-exception.filter.ts`
- `apps/api/src/common/filters/http-exception.filter.spec.ts`
- `docs/tasks-hardening/README.md`

## 非目标

- 不调整唯一约束文案映射规则。
- 不处理其他模块的历史 TypeScript strict 错误。
- 不更改 Prisma Client 版本。

## 验收命令

```bash
git diff --check -- apps/api/src/common/filters/http-exception.filter.ts apps/api/src/common/filters/http-exception.filter.spec.ts docs/tasks-hardening/TASK-H-023.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest src/common/filters/http-exception.filter.spec.ts --runInBand
pnpm build:api
```

## 回执区域

- 修改文件清单：
  - `apps/api/src/common/filters/http-exception.filter.ts`
  - `apps/api/src/common/filters/http-exception.filter.spec.ts`
  - `docs/tasks-hardening/TASK-H-023.md`
  - `docs/tasks-hardening/README.md`
- 实际执行的命令：
  - `git diff --check -- apps/api/src/common/filters/http-exception.filter.ts apps/api/src/common/filters/http-exception.filter.spec.ts docs/tasks-hardening/TASK-H-023.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest src/common/filters/http-exception.filter.spec.ts --runInBand`
  - `pnpm build:api`
- 测试结果：`git diff --check` 通过；全局异常过滤器 Jest 单测通过；`pnpm build:api` 的 Prisma 错误类型相关报错已消除，剩余 102 个错误属于其他历史 strict 类型债务。
- 已知限制：全量 API build 尚未通过，需继续按 TASK-H-020 拆分修复其他模块。
- 未完成项：继续清理 remaining strict TypeScript errors。

## 审核区域

- 状态：待审核
- 审核人：
- 审核意见：
