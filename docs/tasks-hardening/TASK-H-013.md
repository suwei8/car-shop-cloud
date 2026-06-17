# TASK-H-013 — 客户手机号与车牌号唯一规则对齐

> 优先级：P1
> 状态：✅ 已关闭
> 前置任务：`TASK-H-012 唯一约束业务文案集中映射`
> 产品边界：当前只做门店内部员工/老板端；客户手机号、车牌号属于门店业务资料，不是登录账号。

## 1. 背景

当前 `CustomerService.create()` 和 `VehicleService.create()` 都做了重复检查：

- 客户：同租户 `phone + status='active'` 冲突时报 `该手机号客户已存在`
- 车辆：同租户 `plateNo + status='active'` 冲突时报 `该车牌号已存在`

但存在两个问题：

1. `update()` 没有做相同规则的重复校验，更新时可绕过 create 路径；
2. schema 里目前只有普通索引，没有数据库唯一约束，因此并发场景下仍可能写入重复 active 数据。

注意：这两类规则当前明显不是“全表绝对唯一”，而更接近“**同租户 active 记录唯一**”。直接上普通唯一索引会和现有业务规则冲突。

## 2. 本任务目标

1. 把 `Customer.phone` 与 `Vehicle.plateNo` 的“同租户 active 唯一”规则，在 `update()` 路径补齐。
2. 增加只读审计脚本，扫描当前数据库中：
   - 同租户 active 客户手机号重复；
   - 同租户 active 车牌号重复。
3. 输出机器可读 JSON 和人工可读摘要，作为后续是否上数据库 partial unique index 的依据。
4. 不修改 Prisma schema，不创建 migration。

## 3. 实现范围

允许修改：

- `apps/api/src/tenant/customer/customer.service.ts`
- `apps/api/src/tenant/vehicle/vehicle.service.ts`
- `apps/api/src/tenant/customer/customer.service.spec.ts`（可新建）
- `apps/api/src/tenant/vehicle/vehicle.service.spec.ts`（可新建）
- `apps/api/scripts/audit-active-uniques.ts`
- `apps/api/package.json`
- 根目录 `package.json`

### 3.1 应用层规则补齐

客户更新：

- `CustomerService.update()` 如果修改 `phone`，必须检查同租户是否已有其他 `status='active'` 客户占用该手机号；
- 排除当前记录自身；
- 冲突时返回 `ConflictException('该手机号客户已存在')`。

车辆更新：

- `VehicleService.update()` 如果修改 `plateNo`，必须检查同租户是否已有其他 `status='active'` 车辆占用该车牌号；
- 建议统一大小写处理，沿用当前 create / import 侧的车牌号大写语义；
- 排除当前记录自身；
- 冲突时返回 `ConflictException('该车牌号已存在')`。

### 3.2 审计脚本

新增脚本：

- `apps/api/scripts/audit-active-uniques.ts`

新增命令：

- `pnpm audit:active-uniques`

建议参数：

```bash
pnpm audit:active-uniques
pnpm audit:active-uniques -- --json .agent-bridge/active-uniques-audit.json
pnpm audit:active-uniques -- --strict
```

输出至少包含：

- `customerPhoneConflicts`
- `vehiclePlateConflicts`
- 每组包含 `tenantId`、`tenantName`、重复值、涉及记录列表

退出码策略：

- 默认发现冲突也退出 0；
- `--strict` 下，只要存在冲突组则退出 1；
- 脚本错误退出 2。

控制台输出要求：

- 客户手机号要脱敏；
- 车牌号可明文；
- 不输出不必要敏感字段。

## 4. 禁止事项

1. 不要修改 Prisma schema 或生成 migration。
2. 不要新增数据库唯一索引。
3. 不要自动清洗、删除、合并任何客户或车辆数据。
4. 不要修改搜索、列表、导入等非唯一性相关业务行为，除非为本任务必需。
5. 不要改动本文件第 8 节“回执区域”之外的执行 Agent 区域，不要改第 9 节审核区。

## 5. 测试要求

必须覆盖：

1. `CustomerService.update()`
   - 手机号未变：跳过重复检查
   - 手机号改为被其他 active 客户占用：409
   - 手机号改为全新值：通过
2. `VehicleService.update()`
   - 车牌未变：跳过重复检查
   - 车牌改为被其他 active 车辆占用：409
   - 车牌改为全新值：通过
   - 大小写归一后冲突：409
3. 审计脚本：
   - 默认模式可运行
   - `--json` 可写文件
   - `--strict` 在无冲突时退出 0；如果本地库有冲突则回执说明结果

建议执行：

```bash
pnpm --filter @car/api exec jest src/tenant/customer/customer.service.spec.ts src/tenant/vehicle/vehicle.service.spec.ts --runInBand
pnpm audit:active-uniques
pnpm build:api
git diff --check
```

## 6. 验收标准

1. `Customer` / `Vehicle` 的 create 与 update 路径规则一致。
2. 同租户 active 唯一规则有只读审计能力。
3. 不引入 schema / migration 变更。
4. API 构建通过。

## 7. 后续说明

本任务完成后，再决定是否立 `TASK-H-014`：

- 如果产品确认必须数据库兜底，则单独设计 PostgreSQL partial unique index 方案；
- 该任务应基于本任务的审计结果推进，而不是直接猜测。

## 8. 回执区域（执行 Agent 填写）

> 执行 Agent 只允许在本节追加内容，不得改动第 9 节。

### 执行回执

**执行时间**: 2026-06-17
**执行状态**: 完成

#### 变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `apps/api/src/tenant/customer/customer.service.ts` | 修改 | `update()` 增加 phone 同租户 active 唯一校验 |
| `apps/api/src/tenant/vehicle/vehicle.service.ts` | 修改 | `update()` 增加 plateNo 同租户 active 唯一校验（含大小写归一） |
| `apps/api/src/tenant/customer/customer.service.spec.ts` | 新建 | CustomerService 单元测试（4 个用例） |
| `apps/api/src/tenant/vehicle/vehicle.service.spec.ts` | 新建 | VehicleService 单元测试（7 个用例） |
| `apps/api/scripts/audit-active-uniques.ts` | 新建 | 只读审计脚本，扫描同租户 active 客户手机号/车牌号重复 |
| `apps/api/package.json` | 修改 | 新增 `audit:active-uniques` script |
| `package.json` (根) | 修改 | 新增 `audit:active-uniques` script |

#### 测试结果

```
Test Suites: 2 passed, 2 total
Tests:       14 passed, 14 total
```

覆盖场景：
- CustomerService.create — 手机号冲突 409 / 唯一通过
- CustomerService.update — 手机号未变跳过 / 手机号改为占用值 409 / 全新值通过 / 不存在 404
- VehicleService.create — 车牌冲突 409 / 唯一通过
- VehicleService.update — 车牌未变跳过 / 车牌改为占用值 409 / 全新值通过 / 大小写归一后冲突 409 / 大小写变更自身跳过 / 不存在 404

#### 构建结果

`pnpm build:api` — 通过

#### 审计脚本

`pnpm audit:active-uniques` — 可运行，支持 `--json` 和 `--strict` 参数

## 9. 架构师审核区域

> 架构师填写。

### 审核时间
2026-06-17

### 审核结论

✅ 通过，任务关闭。

本任务按预期停在“应用层规则一致 + 只读审计”阶段，没有贸然引入数据库唯一索引。这是正确收口，因为当前业务规则是“同租户 active 唯一”，不是简单的全表唯一。

### 架构师复核

1. MiMo 已按边界补齐了 `CustomerService.update()` 与 `VehicleService.update()` 的重复校验，并新增了只读审计脚本与定向单测。
2. 我手动补了一处必要收口：`VehicleService` 的车牌号不仅在冲突检查时统一大写，也在 `create()` / `update()` 入库时统一写成大写，避免规则和数据不一致。
3. 当前实现语义清晰：
   - 客户手机号：同租户 `status='active'` 唯一；
   - 车牌号：同租户 `status='active'` 唯一，且按大写标准化比较；
   - 仅大小写不同的同一车牌，视为同一条数据，不报冲突；
   - 新车牌标准化后若撞到其他 active 车辆，返回 409。
4. 审计脚本 `audit-active-uniques.ts` 只读扫描当前数据库中的 active 冲突组，支持默认输出、`--json` 和 `--strict`，符合后续上线前检查用途。
5. 当前本地数据库审计结果：
   - active 客户数：6
   - active 车辆数：6
   - 客户手机号冲突组：0
   - 车牌号冲突组：0

### 最终验证

| 命令 | 结果 |
|------|------|
| `pnpm --filter @car/api exec jest src/tenant/customer/customer.service.spec.ts src/tenant/vehicle/vehicle.service.spec.ts --runInBand` | 通过，14 tests passed |
| `pnpm audit:active-uniques` | 通过，0 冲突组 |
| `pnpm audit:active-uniques -- --json .agent-bridge/active-uniques-audit.json` | 通过，JSON 写入仓库根目录 |
| `pnpm audit:active-uniques -- --strict` | 通过，退出码 0 |
| `pnpm build:api` | 通过 |
| `git diff --check` | 通过 |

### 遗留建议

1. 下一步如果要做数据库兜底，应单独立 `TASK-H-014` 设计 PostgreSQL partial unique index：
   - `customers (tenant_id, phone) WHERE status = 'active'`
   - `vehicles (tenant_id, upper(plate_no)) WHERE status = 'active'`
2. 该任务不能直接照搬 Prisma 普通 `@@unique`，否则会和当前“仅 active 唯一”的业务规则冲突。
3. 上线前可把 `pnpm audit:active-uniques -- --strict` 加入发布检查清单。
