# TASK-H-033 角色管理 transaction 类型收口

## 背景

`TASK-H-032` 后，`pnpm build:api` 的首个剩余阻塞点推进到 `RoleService`：

- `create` 与 `update` 中 `$transaction` 回调参数缺少显式类型；
- 角色管理会写入角色和角色权限关系，属于权限体系基础路径；
- 本任务只补 transaction client 类型，不改变角色创建、权限重建或内置角色保护逻辑。

## 目标

1. 为角色服务引入 Prisma transaction 类型。
2. 为 `create` 与 `update` 的 `$transaction` callback 标注 `Prisma.TransactionClient`。
3. 保持角色权限写入、删除重建、返回 include 结构和内置角色保护逻辑不变。
4. 继续推进 API build 首个阻塞点，给 stock/stored-value-card 等后续模块让路。

## 范围

- `apps/api/src/tenant/role/role.service.ts`
- `docs/tasks-hardening/README.md`
- `docs/tasks-hardening/TASK-H-033.md`

## 非目标

- 不调整权限模型或角色编码规则。
- 不新增角色接口或权限校验。
- 不处理 stock/stored-value-card 等后续 build 阻塞点。

## 验收命令

```bash
git diff --check -- apps/api/src/tenant/role/role.service.ts docs/tasks-hardening/TASK-H-033.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest --listTests | rg 'role'
pnpm build:api
```

## 回执区域

- 修改文件：
  - `apps/api/src/tenant/role/role.service.ts`
  - `docs/tasks-hardening/README.md`
  - `docs/tasks-hardening/TASK-H-033.md`
- 实际执行命令：
  - `git diff --check -- apps/api/src/tenant/role/role.service.ts docs/tasks-hardening/TASK-H-033.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest --listTests | rg 'role'`
  - `pnpm build:api`
- 测试结果：
  - `git diff --check -- ...` 通过，未发现 whitespace 问题。
  - `pnpm --filter @car/api exec jest --listTests | rg 'role'` 未找到 role 专属 Jest spec（命令退出 1，无输出）。
  - `pnpm build:api` 仍失败，但 role 相关 2 个错误已消除；剩余 25 个错误从 `stock.service.ts` 等后续模块开始。
- 已知限制：
  - 当前仓库未发现 role 专属 Jest spec；本任务已通过 build 输出确认 role 错误消除。
- 未完成项：
  - 继续按 build 输出处理 stock/stored-value-card/subscription/user/warranty/work-order 等后续模块。

## 审核区域

- 待审核。
