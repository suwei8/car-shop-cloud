# 车店云管家

车店云管家是一个面向小型汽车服务门店的 SaaS 多租户管理系统。当前产品主线是门店老板和员工内部使用场景，优先支持微信小程序 + Web 后台，不做车主端。

## 当前定位

- 目标客户：`1-5 人` 小型汽修 / 洗美 / 快保门店
- 主端：商户端微信小程序
- 辅助端：Web 后台
- 当前不做：车主端、保险业务、真实短信上线
- 当前核心闭环：注册开户 -> 登录 -> 开单 -> 扣库存 -> 收款 -> 质保/卡项 -> 订阅续费

## Monorepo 结构

```text
apps/api/        NestJS 后端 + Prisma + PostgreSQL
apps/web/        Vue 3 + Element Plus Web 后台
apps/mobile/     uni-app 商户端
packages/shared/ 共享类型与常量
docs/            产品、架构、任务与交接文档
```

## 环境要求

- `Node.js >= 18`
- `pnpm >= 8`
- Docker / Docker Compose
- PostgreSQL 16、Redis 7、MinIO

第一次启动前：

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
```

## 常用命令

```bash
# 联调
pnpm dev
pnpm dev:api
pnpm dev:web

# 构建
pnpm build
pnpm build:api
pnpm build:web

# 数据库
pnpm db:migrate
pnpm db:seed
pnpm db:studio

# 硬化/审计
pnpm audit:tenant-scope
pnpm audit:login-phones -- --strict
pnpm audit:active-uniques -- --strict
pnpm seed:gray
pnpm smoke:gray
```

## 当前关键约束

- 所有业务表必须带 `tenant_id`
- 门店级业务数据必须带 `shop_id`
- 后端必须强制租户隔离，不能相信前端传入的 `tenantId`
- 金额使用 `Decimal`，不能用 `float`
- 库存、结算、储值卡、套餐卡必须有流水和审计日志
- 已结算工单不能直接改核心金额
- 登录手机号当前已收口为全局唯一
- 客户手机号、车牌号当前规则是“同租户 active 唯一”，暂未上数据库 partial unique index

## 当前项目状态

上线前硬化任务已经持续推进，`TASK-H-001` 到 `TASK-H-013` 已关闭，`TASK-H-004 真实短信上线验证` 暂缓到生产前。

已完成的关键收口包括：

- 登录手机号全局唯一 + 数据库唯一索引 + 错误文案统一映射
- 租户隔离 helper 与审计脚本
- 灰度种子与灰度 smoke 链路
- 业务唯一约束文案集中映射
- 客户手机号 / 车牌号 create/update 规则对齐与只读审计脚本

任务总览见：

- `docs/tasks-hardening/README.md`

## 建议阅读顺序

1. `docs/09-current-product-direction.md`
2. `docs/README-AGENT-HANDOFF.md`
3. `docs/AGENT-HANDOFF-CURRENT.md`
4. `docs/tasks-hardening/README.md`

## Git 与备份

- 远程仓库：`git@github.com:suwei8/car-shop-cloud.git`
- 当前仓库内保留了一份数据库导出快照：
  - `backups/car_shop_20260617_205746.sql`

## 下一步建议

建议下一任务为 `TASK-H-014`：

- 基于 `audit:active-uniques` 结果，单独设计 `Customer.phone` / `Vehicle.plateNo` 的 PostgreSQL `partial unique index`
- 不要直接用 Prisma 普通 `@@unique` 替代当前业务规则
