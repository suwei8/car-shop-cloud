# TASK-H-012 — 唯一约束业务文案集中映射

> 优先级：P1
> 状态：✅ 已关闭
> 前置任务：`TASK-H-011 登录手机号唯一约束错误统一映射`
> 产品边界：当前只做门店内部员工/老板端；优先收口门店人工输入型标识的唯一约束错误提示。

## 1. 背景

`TASK-H-011` 已经把 `User.phone` 的数据库唯一约束冲突映射成明确业务文案。但当前项目里还有多处“业务上已有明确冲突提示、数据库也有唯一约束”的场景，仍然可能在并发写入时直接落到 Prisma `P2002`，然后返回通用文案：

```ts
数据已存在（唯一约束冲突）
```

这会让门店用户看到不够具体的提示，也会让接口行为在“预检查命中”和“数据库兜底命中”两种路径下不一致。

## 2. 目标

1. 在全局异常过滤器中继续扩展 `P2002` → 业务文案映射表。
2. 对以下门店人工输入型唯一标识，数据库兜底命中时返回与业务预检查一致或等价的提示：
   - `User.phone` → `该手机号已被其他账号使用`
   - `Part(tenantId, code)` → `配件编码已存在`
   - `StoredValueCard(tenantId, cardNo)` → `卡号已存在`
   - `PackageCard(tenantId, cardNo)` → `卡号已存在`
3. 其他唯一约束仍保持通用 `数据已存在（唯一约束冲突）`。
4. 不把没有数据库唯一约束的字段硬塞进 filter 映射。

## 3. 非目标

以下内容不属于本任务：

- `Vehicle.plateNo`：当前 schema 只有索引，没有唯一约束；
- `Customer.phone`：当前 schema 只有索引，没有唯一约束；
- 新增 Prisma schema / migration；
- 修改各业务 service 的预检查逻辑；
- 重构成复杂配置系统或新建独立模块。

## 4. 实现范围

允许修改：

- `apps/api/src/common/filters/http-exception.filter.ts`
- `apps/api/src/common/filters/http-exception.filter.spec.ts`

建议实现方式：

1. 在 `AllExceptionsFilter` 中保留一个小而明确的私有映射函数。
2. 兼容 Prisma `meta.target` 可能返回：
   - 字段数组：如 `['tenantId', 'code']`、`['tenantId', 'cardNo']`
   - 约束名：如 `parts_tenantId_code_key`、`stored_value_cards_tenantId_cardNo_key`
3. 映射规则必须“精确识别具体模型/约束”，不能再用宽泛关键词匹配。

建议支持的目标：

```ts
['phone']
['tenantId', 'phone']
'users_phone_key'
'users_tenantId_phone_key'

['tenantId', 'code']
'parts_tenantId_code_key'

['tenantId', 'cardNo']
'stored_value_cards_tenantId_cardNo_key'
'package_cards_tenantId_cardNo_key'
```

实现时要注意：

- `['tenantId', 'code']` 不能无脑全部映射成“配件编码已存在”，否则未来 `Role.code`、`Dictionary.code` 等也会误伤；
- 必须结合约束名或其他可判定信息做保守匹配；
- 如果某类目标无法稳定识别，宁可保留通用文案，也不要误报。

## 5. 禁止事项

1. 不要修改 Prisma schema / migration。
2. 不要修改 `PartService`、`StoredValueCardService`、`PackageCardService` 等业务 service。
3. 不要为了这个任务引入新的异常处理中间层或大型配置系统。
4. 不要把没有数据库唯一约束的字段加入映射。
5. 不要改动本文件第 8 节“架构师审核区域”。

## 6. 测试要求

必须新增或更新单测，至少覆盖：

1. `P2002 + users_phone_key` → `该手机号已被其他账号使用`
2. `P2002 + parts_tenantId_code_key` → `配件编码已存在`
3. `P2002 + stored_value_cards_tenantId_cardNo_key` → `卡号已存在`
4. `P2002 + package_cards_tenantId_cardNo_key` → `卡号已存在`
5. `P2002 + customers_phone_key` 或其他非目标约束 → 通用文案
6. `P2002 + roles_tenantId_code_key` → 通用文案

建议执行：

```bash
pnpm --filter @car/api exec jest src/common/filters/http-exception.filter.spec.ts --runInBand
pnpm build:api
git diff --check
```

## 7. 验收标准

1. 以上 4 类目标约束返回明确业务文案。
2. 非目标唯一约束不被误映射。
3. 逻辑仍集中在全局异常过滤器。
4. 单测覆盖正反两类映射。
5. API 构建通过。

## 8. 回执区域（执行 Agent 填写）

> 执行 Agent 只允许在本节追加内容，不得改动第 9 节。

### 执行回执

- **执行时间**：2026-06-17
- **修改文件**：
  - `apps/api/src/common/filters/http-exception.filter.ts` — 在 `resolvePrismaUniqueMessage` 中新增两段约束名精确匹配：
    - `parts_tenantId_code_key` → `配件编码已存在`
    - `stored_value_cards_tenantId_cardNo_key` / `package_cards_tenantId_cardNo_key` → `卡号已存在`
  - `apps/api/src/common/filters/http-exception.filter.spec.ts` — 新增 4 条测试用例覆盖正向映射和反向通用兜底
- **单测结果**：12 passed, 12 total
- **构建结果**：`pnpm build:api` 通过
- **映射策略**：仅通过约束名精确匹配（如 `parts_tenantId_code_key`），不使用字段组合宽泛匹配，避免 `Role.code`、`Dictionary.code` 等误伤
- **验证项**：
  - ✅ `P2002 + users_phone_key` → `该手机号已被其他账号使用`
  - ✅ `P2002 + parts_tenantId_code_key` → `配件编码已存在`
  - ✅ `P2002 + stored_value_cards_tenantId_cardNo_key` → `卡号已存在`
  - ✅ `P2002 + package_cards_tenantId_cardNo_key` → `卡号已存在`
  - ✅ `P2002 + customers_phone_key` → 通用文案
  - ✅ `P2002 + roles_tenantId_code_key` → 通用文案

## 9. 架构师审核区域

> 架构师填写。

### 审核时间
2026-06-17

### 审核结论

✅ 通过，任务关闭。

本任务已把一批“门店人工输入型标识”的数据库唯一约束冲突收敛到全局异常过滤器，保证并发命中数据库兜底时，返回的业务文案与 service 预检查路径尽量一致。

### 架构师复核

1. MiMo 按边界只修改了 `http-exception.filter.ts` 与对应 spec，没有触碰 schema、migration 或业务 service。
2. MiMo 初版采用“约束名精确匹配”扩展了三类目标：
   - `parts_tenantId_code_key` → `配件编码已存在`
   - `stored_value_cards_tenantId_cardNo_key` → `卡号已存在`
   - `package_cards_tenantId_cardNo_key` → `卡号已存在`
3. 复核时我补了一处兼容性改进：
   - `cardNo` 两类约束虽然模型不同，但业务文案一致，因此安全补充了 `meta.target = ['tenantId', 'cardNo']` 的数组形态支持；
   - `['tenantId', 'code']` 没有补，因为它会与 `Role.code` 等其他模型冲突，误报风险高。
4. 当前策略符合“宁可保守兜底，也不要误报”的原则：
   - `User.phone` 继续精确映射；
   - `Part.code` 只在可确定为 `parts_*` 约束名时映射；
   - `StoredValueCard.cardNo` / `PackageCard.cardNo` 在约束名和字段数组两种形态下都能映射；
   - 非目标约束仍返回通用文案。

### 最终验证

| 命令 | 结果 |
|------|------|
| `pnpm --filter @car/api exec jest src/common/filters/http-exception.filter.spec.ts --runInBand` | 通过，13 tests passed |
| `pnpm build:api` | 通过 |
| `git diff --check` | 通过 |

### 遗留建议

1. `Vehicle.plateNo`、`Customer.phone` 当前没有数据库唯一约束，不应继续往 filter 里硬加映射；如果后续需要数据库兜底，应先立新任务补 schema/migration。
2. 后续新增其他唯一约束业务文案时，优先采用“精确约束名 + 安全字段数组”的保守识别方式，避免再次回到关键词误匹配。
