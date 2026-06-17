# 车店云管家当前接手说明

> 生成时间：2026-06-17
> 适用对象：接手当前工作区的下一位 Agent
> 工作区状态：**dirty worktree**，禁止回退未识别为自己创建的改动

## 1. 项目定位

- 产品：`车店云管家`
- 目标客户：`1-5 人小型汽修 / 洗美 / 快保门店`
- 当前主端：`微信小程序（门店老板/员工内部使用）`
- 辅助端：`Web 后台（导入、报表、打印、平台运营）`
- 当前不做：`车主端 / 车主小程序 / 保险业务`

权威产品方向先读：

1. `docs/09-current-product-direction.md`
2. `docs/README-AGENT-HANDOFF.md`
3. `docs/tasks-hardening/README.md`

## 2. 仓库与技术栈

- Monorepo：`pnpm workspace`
- 后端：`NestJS + Prisma + PostgreSQL`
- Web：`Vue 3 + Element Plus`
- Mobile：`uni-app`

Git 信息：

- 当前目录是 Git 仓库
- 远程仓库：`git@github.com:suwei8/car-shop-cloud.git`

## 3. 当前硬化任务状态

`docs/tasks-hardening/README.md` 已同步到当前状态。

已关闭：

- `TASK-H-001` 低风险技术收口
- `TASK-H-002` 租户隔离强约束设计与第一阶段落地
- `TASK-H-003` 文档与任务状态二次审计
- `TASK-H-005` 灰度验收链路
- `TASK-H-006` 支付网关租户隔离补强
- `TASK-H-007` 灰度测试租户初始化
- `TASK-H-008` 登录手机号归属确定性
- `TASK-H-009` 历史重复登录手机号审计
- `TASK-H-010` 登录手机号数据库唯一约束
- `TASK-H-011` 登录手机号唯一约束错误统一映射
- `TASK-H-012` 唯一约束业务文案集中映射
- `TASK-H-013` 客户手机号与车牌号唯一规则对齐

暂缓：

- `TASK-H-004` 真实短信上线验证
  - 用户已明确要求：达到生产使用阶段前不做

## 4. 最近完成的关键收口

### 4.1 登录手机号链路

- 登录手机号已收口为全局唯一
- `User.phone` 已有数据库唯一索引：`users_phone_key`
- Prisma `P2002` 命中用户手机号时，会统一返回：`该手机号已被其他账号使用`

相关任务：

- `TASK-H-008`
- `TASK-H-009`
- `TASK-H-010`
- `TASK-H-011`

### 4.2 业务唯一约束文案

全局异常过滤器已对以下数据库唯一约束做明确业务文案映射：

- `users_*phone*` → `该手机号已被其他账号使用`
- `parts_tenantId_code_key` → `配件编码已存在`
- `stored_value_cards_*cardNo*` → `卡号已存在`
- `package_cards_*cardNo*` → `卡号已存在`

相关任务：

- `TASK-H-012`

### 4.3 客户手机号 / 车牌号规则

当前不是数据库唯一约束，而是**应用层规则**：

- 客户：同租户 `status='active'` 手机号唯一
- 车辆：同租户 `status='active'` 车牌号唯一
- 车牌号已统一按大写写库和比较

`create()` 和 `update()` 两条路径都已补齐检查。

新增只读审计脚本：

- `pnpm audit:active-uniques`
- `pnpm audit:active-uniques -- --json .agent-bridge/active-uniques-audit.json`
- `pnpm audit:active-uniques -- --strict`

当前本地库审计结果：

- active 客户数：`6`
- active 车辆数：`6`
- 客户手机号冲突组：`0`
- 车牌号冲突组：`0`

相关任务：

- `TASK-H-013`

## 5. 推荐下一步

下一任务建议：`TASK-H-014`

目标：

- 评估并设计 `Customer.phone` / `Vehicle.plateNo` 的数据库层兜底方案
- 如果推进，应该是 PostgreSQL `partial unique index`
- 不能直接用 Prisma 普通 `@@unique`，因为当前业务语义不是“全表绝对唯一”，而是“同租户 active 唯一”

候选方向：

- `customers (tenant_id, phone) WHERE status = 'active'`
- `vehicles (tenant_id, upper(plate_no)) WHERE status = 'active'`

推进前提：

- 先基于 `pnpm audit:active-uniques -- --strict` 结果确认无冲突
- 单独立任务，不要把 schema/migration 和业务规则混在一起

## 6. MiMo 协作方式

当前协作约定已经稳定：

1. 先由架构师写任务书到 `docs/tasks-hardening/TASK-H-XXX.md`
2. 再用 MiMo 执行，例如：

```bash
mimo run --dir /home/sw/dev_root/car --dangerously-skip-permissions "请执行 docs/tasks-hardening/TASK-H-013.md ..."
```

3. MiMo 完成后必须把回执追加到任务书“回执区域”
4. 架构师再人工审核，必要时手动修正并在“审核区域”写结论

注意：

- MiMo 经常能完成主体，但偶尔会出现：
  - 约束匹配过宽
  - 类型遗漏
  - 路径解析不符合 monorepo 直觉
  - 回执与最终实际状态不完全一致
- 所以**不能只看 MiMo 回执，必须人工复核并重新跑关键验证**

## 7. 当前工作区注意事项

- 当前工作区有大量未提交改动，不全是本轮硬化任务产生
- 不要执行：
  - `git reset --hard`
  - `git checkout --`
  - 任何会回滚用户现有改动的操作

当前新增/关键文件包括但不限于：

- `docs/tasks-hardening/`
- `apps/api/scripts/`
- `apps/api/src/common/filters/http-exception.filter.spec.ts`
- `apps/api/src/tenant/customer/customer.service.spec.ts`
- `apps/api/src/tenant/vehicle/vehicle.service.spec.ts`
- `apps/api/prisma/migrations/20260617150000_add_unique_user_phone/`

## 8. 建议验证命令

接手后建议先执行：

```bash
pnpm build:api
pnpm audit:login-phones -- --strict
pnpm audit:active-uniques -- --strict
pnpm --filter @car/api exec jest src/common/filters/http-exception.filter.spec.ts src/tenant/customer/customer.service.spec.ts src/tenant/vehicle/vehicle.service.spec.ts --runInBand
git diff --check
```

如需灰度链路复验：

```bash
GRAY_SEED_ALLOW_WRITE=1 pnpm --filter @car/api seed:gray
API_PORT=3001 pnpm --filter @car/api run start
API_BASE_URL=http://127.0.0.1:3001/api SMOKE_ALLOW_WRITE=1 SMOKE_PHONE=18800000001 SMOKE_PASSWORD=Test123456 pnpm smoke:gray
```

## 9. 交接结论

项目当前已经从“方向和文档混乱”进入“硬化收口阶段已成型”的状态。

接手 Agent 的正确姿势不是继续随意扩功能，而是：

1. 先读当前产品边界
2. 以 `docs/tasks-hardening/README.md` 为主任务总览
3. 优先做上线前硬约束和一致性收口
4. 所有高风险改动都先任务书化，再交给 MiMo 执行，再人工审核
