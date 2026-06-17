# TASK-H-011 — 登录手机号唯一约束错误统一映射

> 优先级：P0
> 状态：✅ 已关闭
> 前置任务：`TASK-H-008 登录手机号归属确定性`、`TASK-H-010 登录手机号数据库唯一约束`
> 产品边界：当前只做门店内部员工/老板端；登录手机号阶段性全局唯一；不做车主端；不做同手机号选择租户/门店。

## 1. 背景

`TASK-H-010` 已经把 `User.phone` 固化为数据库唯一索引 `users_phone_key`。应用层虽然已有手机号重复检查，但并发场景下仍可能直接命中数据库唯一约束。

当前全局异常过滤器 `AllExceptionsFilter` 对 Prisma `P2002` 的处理仍是通用文案：

```ts
message = '数据已存在（唯一约束冲突）';
```

这对门店用户不够清晰。对于登录手机号相关冲突，接口应该统一返回明确的业务提示，例如“该手机号已被其他账号使用”或“手机号已存在”，而不是 Prisma/数据库层语义。

## 2. 目标

1. 在全局异常过滤器中识别 `PrismaClientKnownRequestError.code === 'P2002'` 的唯一约束目标。
2. 当唯一约束命中 `User.phone` 相关索引时，统一返回明确业务文案。
3. 保持其他唯一约束仍返回通用 409，不误伤非手机号场景。
4. 增加最小单测，覆盖手机号索引命中和非手机号唯一约束命中。
5. 不修改业务 service 逻辑，不在各 service 里散落 `try/catch Prisma`。

## 3. 实现范围

允许修改：

- `apps/api/src/common/filters/http-exception.filter.ts`
- `apps/api/src/common/filters/http-exception.filter.spec.ts`（可新建）

建议实现方式：

1. 在 filter 中解析 `exception.meta?.target`。
2. 兼容 Prisma 可能返回：
   - 数组字段名：如 `['phone']`；
   - 约束名/索引名：如 `users_phone_key`；
   - 复合唯一字段：如 `['tenantId', 'phone']`；
   - 旧索引/约束名：如 `users_tenantId_phone_key`。
3. 如果能判断是 `User.phone` 唯一冲突，返回：

```ts
message = '该手机号已被其他账号使用';
```

4. 非手机号唯一约束仍返回：

```ts
message = '数据已存在（唯一约束冲突）';
```

可以新增一个小的私有 helper，例如：

```ts
private resolvePrismaUniqueMessage(exception: Prisma.PrismaClientKnownRequestError): string
```

## 4. 禁止事项

1. 不要修改登录、注册、微信绑定、员工管理、平台开户等 service 业务逻辑。
2. 不要新增或修改 Prisma schema / migration。
3. 不要接入真实短信。
4. 不要为了这个任务引入 E2E 框架。
5. 不要改动本文件第 8 节“架构师审核区域”。

## 5. 测试要求

必须新增或更新最小单测，至少覆盖：

1. `P2002 + target = ['phone']` → 409 + `该手机号已被其他账号使用`
2. `P2002 + target = ['tenantId', 'phone']` → 409 + `该手机号已被其他账号使用`
3. `P2002 + target = 'users_phone_key'` 或等价约束名 → 409 + `该手机号已被其他账号使用`
4. `P2002 + 非手机号目标` → 409 + `数据已存在（唯一约束冲突）`
5. `P2025` 仍保持 `记录不存在`

建议执行：

```bash
pnpm --filter @car/api exec jest src/common/filters/http-exception.filter.spec.ts --runInBand
pnpm build:api
git diff --check
```

## 6. 验收标准

1. 并发命中 `User.phone` 唯一约束时，接口返回明确业务提示。
2. 其他唯一约束不被误映射为手机号错误。
3. 逻辑集中在全局异常过滤器，不分散到 service。
4. 单测覆盖 filter 的 Prisma 唯一约束分支。
5. API 构建通过。

## 7. 回执区域（执行 Agent 填写）

> 执行 Agent 只允许在本节追加内容，不得改动第 8 节。

### 执行回执

- **执行时间**：2026-06-17
- **状态**：✅ 完成
- **变更文件**：
  - `apps/api/src/common/filters/http-exception.filter.ts` — 新增 `resolvePrismaUniqueMessage` 私有方法，在 P2002 分支调用；当 `meta.target` 包含 `phone` 或 `users_phone` 相关字段时返回"该手机号已被其他账号使用"，其余返回通用文案。
  - `apps/api/src/common/filters/http-exception.filter.spec.ts` — 新建，7 个用例覆盖：
    1. `target = ['phone']` → 手机号文案
    2. `target = ['tenantId', 'phone']` → 手机号文案
    3. `target = 'users_phone_key'` → 手机号文案
    4. `target = ['email']` → 通用文案
    5. `target` 缺失 → 通用文案
    6. P2025 → 记录不存在
    7. HttpException → 转发状态码与消息
- **验证结果**：`jest` 全部通过（7/7），`pnpm build:api` 构建成功。

## 8. 架构师审核区域

> 架构师填写。

### 审核时间
2026-06-17

### 审核结论

✅ 通过，任务关闭。

本任务已把 `User.phone` 唯一约束命中的 Prisma `P2002` 统一映射为明确业务提示，且逻辑集中在全局异常过滤器，没有污染各业务 service。

### 架构师复核

1. MiMo 按边界完成了 filter 和最小单测，没有修改 schema、migration 或业务 service。
2. MiMo 初版存在一个准确性问题：它把任何包含 `phone` 的唯一约束都映射成“该手机号已被其他账号使用”，范围过宽，未来可能误伤客户资料或其他非登录手机号约束。
3. 我已手动收窄规则，只识别以下 `User.phone` 相关目标：
   - `['phone']`
   - `['tenantId', 'phone']`
   - `users_phone_key`
   - `users_tenantId_phone_key`
4. 已补一条反向测试，确认诸如 `customers_phone_key` 之类非 `User.phone` 约束仍返回通用 409 文案。

### 最终验证

| 命令 | 结果 |
|------|------|
| `pnpm --filter @car/api exec jest src/common/filters/http-exception.filter.spec.ts --runInBand` | 通过，8 tests passed |
| `pnpm build:api` | 通过 |
| `git diff --check` | 通过 |

### 遗留建议

1. 后续如果新增其他需要用户可理解的唯一约束错误，例如车牌号、卡号、配件编码，可以继续沿用同一 filter 扩展，但必须按“明确识别具体约束”的方式逐项增加，不能用宽泛关键词匹配。
2. 如果未来增加真正的 API/E2E 测试框架，可以补一个并发创建同手机号用户的集成用例，验证最终返回文案确实是该业务提示。
