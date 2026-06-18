# TASK-H-022 认证与开户 JWT payload 类型收口

## 背景

登录、刷新令牌、获取当前用户和开户注册流程都需要从 `userRoles` 中提取角色与权限，并组装员工端 JWT payload。此前这些逻辑散落在多个 service 中，容易出现：

- roles / permissions 去重实现不一致；
- `dataScope` 推导规则重复维护；
- 开户后自动登录 payload 与普通登录 payload 字段不完全一致；
- 严格 TypeScript 环境下 `Set` / `flatMap` 推导可读性较差。

## 目标

把员工端认证 claims 构造逻辑收口到单一工具模块，保证登录、刷新、getMe 和开户注册使用同一套类型与字段约定。

## 范围

- 新增 `apps/api/src/auth/auth-payload.util.ts`：
  - 定义认证 claims 所需的最小结构类型；
  - 统一提取并去重 roles / permissions；
  - 统一推导 `dataScope`；
  - 统一构建员工端 `JwtPayload`，包含 `audience: 'employee'`。
- 更新 `apps/api/src/auth/auth.service.ts`：
  - 登录和刷新令牌复用统一 payload 构造函数；
  - `getMe` 复用统一 claims 提取函数。
- 更新 `apps/api/src/auth/registration.service.ts`：
  - 開户后自动登录复用统一 payload 构造函数；
  - 明确首个管理员账号使用 `dataScope: 'all'`。

## 非目标

- 不调整 JWT 签名密钥、过期时间和 refresh token 存储策略。
- 不改变角色、权限、员工、租户初始化数据结构。
- 不新增平台管理员登录逻辑。

## 验收命令

```bash
git diff --check -- apps/api/src/auth/auth-payload.util.ts apps/api/src/auth/auth.service.ts apps/api/src/auth/registration.service.ts docs/tasks-hardening/TASK-H-022.md docs/tasks-hardening/README.md
pnpm --filter @car/api exec jest src/auth/auth.service.spec.ts src/auth/registration.service.spec.ts --runInBand
pnpm build:api
```

## 回执区域

- 修改文件清单：
  - `apps/api/src/auth/auth-payload.util.ts`
  - `apps/api/src/auth/auth.service.ts`
  - `apps/api/src/auth/registration.service.ts`
  - `docs/tasks-hardening/TASK-H-022.md`
  - `docs/tasks-hardening/README.md`
- 实际执行的命令：
  - `git diff --check -- apps/api/src/auth/auth-payload.util.ts apps/api/src/auth/auth.service.ts apps/api/src/auth/registration.service.ts docs/tasks-hardening/TASK-H-022.md docs/tasks-hardening/README.md`
  - `pnpm --filter @car/api exec jest src/auth/auth.service.spec.ts src/auth/registration.service.spec.ts --runInBand`
  - `pnpm build:api`
- 测试结果：`git diff --check` 通过；认证与开户注册 Jest 单元测试通过；`pnpm build:api` 仍被仓库既有 TypeScript 严格模式错误阻塞（本任务相关的 `registration.service.ts` 隐式 transaction 类型已修复）。
- 已知限制：未连接真实生产认证环境，仅执行单元测试；全量 API 构建仍存在历史类型债务，需后续任务继续清理。
- 未完成项：全量 `pnpm build:api` 的历史类型错误不在本任务范围内，建议继续按 TASK-H-020 拆分修复。

## 审核区域

- 状态：待审核
- 审核人：
- 审核意见：
